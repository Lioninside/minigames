(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  function svgElement(name, attributes) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes || {}).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function pointOnPolyline(points, cumulative, total, distanceAlong) {
    const target = Math.max(0, Math.min(total, distanceAlong));
    let index = 0;
    while (index < cumulative.length - 1 && cumulative[index + 1] < target) index += 1;

    const start = points[index];
    const end = points[index + 1];
    const span = Math.max(0.0001, cumulative[index + 1] - cumulative[index]);
    const progress = (target - cumulative[index]) / span;
    return {
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress
    };
  }

  function resamplePolyline(sourcePoints, closed, targetLength) {
    const points = sourcePoints.map((point) => ({ x: point.x, y: point.y }));
    if (closed) points.push({ ...points[0] });

    const cumulative = [0];
    for (let index = 1; index < points.length; index += 1) {
      cumulative.push(cumulative[index - 1] + distance(points[index - 1], points[index]));
    }

    const total = cumulative[cumulative.length - 1];
    const segmentCount = Math.max(closed ? 12 : 2, Math.ceil(total / targetLength));
    const sampled = [];
    const count = closed ? segmentCount : segmentCount + 1;
    for (let index = 0; index < count; index += 1) {
      sampled.push(pointOnPolyline(points, cumulative, total, (index / segmentCount) * total));
    }
    return sampled;
  }

  function raceTrack(left, right, top, bottom, radius) {
    const points = [];
    const addPoint = (x, y) => points.push({ x, y });
    const addArc = (cx, cy, startDegrees, endDegrees) => {
      const steps = 10;
      for (let index = 0; index <= steps; index += 1) {
        if (points.length && index === 0) continue;
        const angle = (startDegrees + ((endDegrees - startDegrees) * index) / steps) * Math.PI / 180;
        addPoint(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      }
    };

    addPoint(left + radius, top);
    addPoint(right - radius, top);
    addArc(right - radius, top + radius, -90, 0);
    addPoint(right, bottom - radius);
    addArc(right - radius, bottom - radius, 0, 90);
    addPoint(left + radius, bottom);
    addArc(left + radius, bottom - radius, 90, 180);
    addPoint(left, top + radius);
    addArc(left + radius, top + radius, 180, 270);
    return points;
  }

  class TrackNetwork {
    constructor(svg, config) {
      this.svg = svg;
      this.config = config;
      this.routes = new Map();
      this.segments = new Map();
      this.switches = new Map();
      this.occupancy = new Map();
      this.trackLayer = null;
      this.labelLayer = null;
      this.trainLayer = null;
      this.onSwitchToggleRequest = null;
    }

    build() {
      this.svg.replaceChildren();
      this.routes.clear();
      this.segments.clear();
      this.switches.clear();
      this.occupancy.clear();

      this.trackLayer = svgElement("g", { "aria-hidden": "true" });
      this.labelLayer = svgElement("g", { "aria-hidden": "true" });
      this.trainLayer = svgElement("g", { "aria-hidden": "true" });
      this.svg.append(this.trackLayer, this.labelLayer, this.trainLayer);

      this.addRoute("outer", raceTrack(160, 820, 72, 748, 135), true, 26);
      this.addRoute("middle", raceTrack(210, 770, 118, 702, 105), true, 26);
      this.addRoute("inner", raceTrack(264, 716, 164, 656, 78), true, 26);

      this.addMainSwitches();
      this.addStorageSidings();
      this.refreshSwitchVisuals();

      if (this.config.debug) this.renderDebugLabels();
    }

    addRoute(id, points, closed, targetLength) {
      const sampled = resamplePolyline(points, closed, targetLength);
      const route = { id, segmentIds: [], closed };
      const segmentCount = closed ? sampled.length : sampled.length - 1;

      for (let index = 0; index < segmentCount; index += 1) {
        const start = sampled[index];
        const end = sampled[(index + 1) % sampled.length];
        const segmentId = `${id}-${String(index).padStart(3, "0")}`;
        const segment = {
          id: segmentId,
          routeId: id,
          index,
          a: start,
          b: end,
          length: distance(start, end),
          defaultNextId: null,
          switchRole: null,
          switchId: null,
          element: null
        };
        this.segments.set(segmentId, segment);
        route.segmentIds.push(segmentId);
      }

      route.segmentIds.forEach((segmentId, index) => {
        const nextIndex = index + 1;
        const nextId = nextIndex < route.segmentIds.length
          ? route.segmentIds[nextIndex]
          : (closed ? route.segmentIds[0] : null);
        this.segments.get(segmentId).defaultNextId = nextId;
      });

      this.routes.set(id, route);
      route.segmentIds.forEach((segmentId) => this.drawSegment(this.segments.get(segmentId)));
      return route;
    }

    drawSegment(segment) {
      const inset = Math.min(3.4, segment.length * 0.18);
      const dx = (segment.b.x - segment.a.x) / segment.length;
      const dy = (segment.b.y - segment.a.y) / segment.length;
      const line = svgElement("line", {
        x1: segment.a.x + dx * inset,
        y1: segment.a.y + dy * inset,
        x2: segment.b.x - dx * inset,
        y2: segment.b.y - dy * inset,
        "data-segment-id": segment.id,
        class: "track-segment"
      });
      segment.element = line;
      this.trackLayer.append(line);
    }

    findSegmentNear(routeId, targetPoint, endpoint) {
      const route = this.routes.get(routeId);
      let best = null;
      let bestDistance = Infinity;
      route.segmentIds.forEach((segmentId) => {
        const segment = this.segments.get(segmentId);
        const point = endpoint === "start" ? segment.a : segment.b;
        const candidateDistance = distance(point, targetPoint);
        if (candidateDistance < bestDistance) {
          best = segment;
          bestDistance = candidateDistance;
        }
      });
      return best;
    }

    addMainSwitches() {
      const specs = [
        { id: "W1", source: "outer", target: "middle", point: { x: 162, y: 260 }, label: { x: 184, y: 280 } },
        { id: "W2", source: "middle", target: "inner", point: { x: 212, y: 355 }, label: { x: 239, y: 372 } },
        { id: "W3", source: "outer", target: "middle", point: { x: 162, y: 472 }, label: { x: 184, y: 451 } },
        { id: "W4", source: "middle", target: "inner", point: { x: 212, y: 575 }, label: { x: 239, y: 555 } },
        { id: "W5", source: "outer", target: "middle", point: { x: 818, y: 260 }, label: { x: 796, y: 280 } },
        { id: "W6", source: "middle", target: "inner", point: { x: 768, y: 355 }, label: { x: 741, y: 372 } },
        { id: "W7", source: "outer", target: "middle", point: { x: 818, y: 472 }, label: { x: 796, y: 451 } },
        { id: "W8", source: "middle", target: "inner", point: { x: 768, y: 575 }, label: { x: 741, y: 555 } }
      ];

      specs.forEach((spec) => this.addSwitch(spec));
    }

    addSwitch(spec) {
      const source = this.findSegmentNear(spec.source, spec.point, "end");
      const target = this.findSegmentNear(spec.target, spec.point, "start");
      const branch = this.addRoute(`branch-${spec.id.toLowerCase()}`, [source.b, target.a], false, 26);
      const branchIds = [...branch.segmentIds];
      this.segments.get(branchIds[branchIds.length - 1]).defaultNextId = target.id;

      const switchData = {
        id: spec.id,
        state: this.config.switchDefaults[spec.id],
        locked: false,
        sourceSegmentId: source.id,
        straightSegmentId: source.defaultNextId,
        divergingSegmentId: branchIds[0],
        branchSegmentIds: branchIds,
        protectedSegmentIds: [source.id, ...branchIds],
        control: null
      };

      this.segments.get(switchData.straightSegmentId).switchRole = "straight";
      this.segments.get(switchData.straightSegmentId).switchId = spec.id;
      branchIds.forEach((segmentId) => {
        this.segments.get(segmentId).switchRole = "diverging";
        this.segments.get(segmentId).switchId = spec.id;
      });
      source.switchId = spec.id;
      this.switches.set(spec.id, switchData);
      this.drawSwitchControl(switchData, spec.label);
    }

    addStorageSidings() {
      const specs = [
        { id: "siding-alpha", label: "A1", side: "left", y: 314 },
        { id: "siding-bravo", label: "A2", side: "left", y: 392 },
        { id: "siding-charlie", label: "A3", side: "left", y: 548 },
        { id: "siding-delta", label: "A4", side: "right", y: 354 },
        { id: "siding-echo", label: "A5", side: "right", y: 530 }
      ];

      specs.forEach((spec) => {
        const target = this.findSegmentNear("outer", { x: spec.side === "left" ? 160 : 820, y: spec.y }, "start");
        const bufferX = spec.side === "left" ? 38 : 942;
        const leadX = spec.side === "left" ? 136 : 844;
        const route = this.addRoute(spec.id, [
          { x: bufferX, y: spec.y },
          { x: leadX, y: spec.y },
          target.a
        ], false, 26);
        this.segments.get(route.segmentIds[route.segmentIds.length - 1]).defaultNextId = target.id;

        const label = svgElement("text", {
          x: spec.side === "left" ? bufferX : bufferX + 20,
          y: spec.y - 12,
          class: "yard-label",
          "text-anchor": spec.side === "left" ? "start" : "end"
        });
        label.textContent = spec.label;
        this.labelLayer.append(label);
      });
    }

    drawSwitchControl(switchData, position) {
      const group = svgElement("g", {
        class: "switch-control",
        tabindex: "0",
        role: "button",
        "aria-label": `${switchData.id} umstellen`
      });
      const plate = svgElement("rect", { x: position.x - 13, y: position.y - 9, width: 26, height: 18, rx: 1, class: "switch-plate" });
      const label = svgElement("text", { x: position.x, y: position.y + 0.5, class: "switch-label" });
      label.textContent = switchData.id;
      group.append(plate, label);
      group.addEventListener("click", () => this.requestSwitchToggle(switchData.id));
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.requestSwitchToggle(switchData.id);
        }
      });
      switchData.control = { group };
      this.labelLayer.append(group);
    }

    requestSwitchToggle(switchId) {
      if (typeof this.onSwitchToggleRequest === "function") this.onSwitchToggleRequest(switchId);
    }

    toggleSwitch(switchId) {
      const switchData = this.switches.get(switchId);
      if (!switchData || switchData.locked) return false;
      switchData.state = switchData.state === "straight" ? "diverging" : "straight";
      this.refreshSwitchVisuals();
      return true;
    }

    setSwitchLocked(switchId, locked) {
      const switchData = this.switches.get(switchId);
      if (!switchData || switchData.locked === locked) return;
      switchData.locked = locked;
      this.refreshSwitchVisuals();
    }

    resetSwitches() {
      this.switches.forEach((switchData) => {
        switchData.state = this.config.switchDefaults[switchData.id];
        switchData.locked = false;
      });
      this.refreshSwitchVisuals();
    }

    getSuccessor(segmentId) {
      const segment = this.segments.get(segmentId);
      if (!segment) return null;
      const switchData = [...this.switches.values()].find((item) => item.sourceSegmentId === segmentId);
      if (switchData) {
        return switchData.state === "straight" ? switchData.straightSegmentId : switchData.divergingSegmentId;
      }
      return segment.defaultNextId;
    }

    getSidingStartRoute(sidingId, trainLength) {
      const route = this.routes.get(sidingId);
      return route.segmentIds.slice(0, trainLength);
    }

    getSegmentPose(segmentId, progress) {
      const segment = this.segments.get(segmentId);
      const t = Math.max(0, Math.min(0.999, progress));
      return {
        x: segment.a.x + (segment.b.x - segment.a.x) * t,
        y: segment.a.y + (segment.b.y - segment.a.y) * t,
        angle: Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x) * 180 / Math.PI
      };
    }

    getRoutePose(route, position) {
      const safePosition = Math.max(0, Math.min(route.length - 0.001, position));
      const index = Math.floor(safePosition);
      const segmentId = route[index];
      return this.getSegmentPose(segmentId, safePosition - index);
    }

    getRouteSegmentId(route, position) {
      const safePosition = Math.max(0, Math.min(route.length - 0.001, position));
      return route[Math.floor(safePosition)];
    }

    setOccupancy(nextOccupancy) {
      const affected = new Set([...this.occupancy.keys(), ...nextOccupancy.keys()]);
      affected.forEach((segmentId) => {
        const before = this.occupancy.get(segmentId);
        const after = nextOccupancy.get(segmentId);
        const beforeKey = before ? [...before].sort().join("|") : "";
        const afterKey = after ? [...after].sort().join("|") : "";
        if (beforeKey !== afterKey) {
          this.updateSegmentAppearance(segmentId, Boolean(after && after.size > 0), after ? [...after][0] : null);
        }
      });
      this.occupancy = nextOccupancy;
    }

    refreshSwitchVisuals() {
      this.switches.forEach((switchData) => {
        const selectedSegmentIds = switchData.state === "straight"
          ? [switchData.straightSegmentId]
          : switchData.branchSegmentIds;
        const inactiveSegmentIds = switchData.state === "straight"
          ? switchData.branchSegmentIds
          : [switchData.straightSegmentId];
        selectedSegmentIds.forEach((segmentId) => this.updateSegmentAppearance(segmentId));
        inactiveSegmentIds.forEach((segmentId) => this.updateSegmentAppearance(segmentId));

        if (switchData.control) {
          switchData.control.group.classList.toggle("is-locked", switchData.locked);
          switchData.control.group.setAttribute("aria-disabled", String(switchData.locked));
          switchData.control.group.setAttribute("aria-label", `${switchData.id} ${switchData.locked ? "gesperrt" : "umstellen"}`);
        }
      });
    }

    updateSegmentAppearance(segmentId, occupiedOverride, occupiedByOverride) {
      const segment = this.segments.get(segmentId);
      if (!segment || !segment.element) return;
      const occupancy = this.occupancy.get(segmentId);
      const occupied = occupiedOverride === undefined ? Boolean(occupancy && occupancy.size) : occupiedOverride;
      const occupiedBy = occupiedByOverride === undefined && occupancy ? [...occupancy][0] : occupiedByOverride;
      const classes = ["track-segment"];
      if (segment.switchRole && segment.switchId) {
        const switchData = this.switches.get(segment.switchId);
        const selected = switchData.state === segment.switchRole;
        classes.push(selected ? "switch-selected" : "switch-inactive");
      }
      if (occupied) classes.push("occupied");
      segment.element.setAttribute("class", classes.join(" "));
      const train = this.config.trainDefinitions.find((definition) => definition.id === occupiedBy);
      if (occupied && train) {
        segment.element.style.setProperty("--occupancy-color", train.color);
      } else {
        segment.element.style.removeProperty("--occupancy-color");
      }
    }

    renderDebugLabels() {
      this.segments.forEach((segment) => {
        const pose = this.getSegmentPose(segment.id, 0.5);
        const label = svgElement("text", { x: pose.x, y: pose.y - 6, class: "debug-label", "text-anchor": "middle" });
        label.textContent = segment.id;
        this.labelLayer.append(label);
      });
    }
  }

  window.Stellwerk = window.Stellwerk || {};
  window.Stellwerk.TrackNetwork = TrackNetwork;
}());
