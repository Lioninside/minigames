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

      this.addRoute("outer", raceTrack(160, 820, 72, 748, 135), true, 28);
      this.addRoute("middle", raceTrack(210, 770, 118, 702, 105), true, 28);
      this.addRoute("inner", raceTrack(264, 716, 164, 656, 78), true, 27);

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
      const line = svgElement("line", {
        x1: segment.a.x,
        y1: segment.a.y,
        x2: segment.b.x,
        y2: segment.b.y,
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
        { id: "W1", source: "outer", target: "middle", point: { x: 162, y: 260 }, bend: { x: 185, y: 247 }, label: { x: 183, y: 278 } },
        { id: "W2", source: "middle", target: "inner", point: { x: 212, y: 355 }, bend: { x: 236, y: 342 }, label: { x: 239, y: 371 } },
        { id: "W3", source: "outer", target: "middle", point: { x: 162, y: 472 }, bend: { x: 185, y: 487 }, label: { x: 183, y: 451 } },
        { id: "W4", source: "middle", target: "inner", point: { x: 212, y: 575 }, bend: { x: 238, y: 588 }, label: { x: 239, y: 556 } },
        { id: "W5", source: "outer", target: "middle", point: { x: 818, y: 260 }, bend: { x: 795, y: 247 }, label: { x: 797, y: 278 } },
        { id: "W6", source: "middle", target: "inner", point: { x: 768, y: 355 }, bend: { x: 744, y: 342 }, label: { x: 741, y: 371 } },
        { id: "W7", source: "outer", target: "middle", point: { x: 818, y: 472 }, bend: { x: 795, y: 487 }, label: { x: 797, y: 451 } },
        { id: "W8", source: "middle", target: "inner", point: { x: 768, y: 575 }, bend: { x: 742, y: 588 }, label: { x: 741, y: 556 } }
      ];

      specs.forEach((spec) => this.addSwitch(spec));
    }

    addSwitch(spec) {
      const source = this.findSegmentNear(spec.source, spec.point, "end");
      const target = this.findSegmentNear(spec.target, spec.point, "start");
      const branch = this.addRoute(`branch-${spec.id.toLowerCase()}`, [source.b, spec.bend, target.a], false, 14);
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
        const bufferX = spec.side === "left" ? 42 : 938;
        const leadX = spec.side === "left" ? 132 : 848;
        const route = this.addRoute(spec.id, [
          { x: bufferX, y: spec.y },
          { x: leadX, y: spec.y },
          target.a
        ], false, 15);
        this.segments.get(route.segmentIds[route.segmentIds.length - 1]).defaultNextId = target.id;

        const label = svgElement("text", {
          x: spec.side === "left" ? bufferX : bufferX - 20,
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
      const disc = svgElement("circle", { cx: position.x, cy: position.y, r: 17, class: "switch-disc" });
      const label = svgElement("text", { x: position.x, y: position.y - 4, class: "switch-label" });
      const state = svgElement("text", { x: position.x, y: position.y + 8, class: "switch-state" });
      label.textContent = switchData.id;
      group.append(disc, label, state);
      group.addEventListener("click", () => this.requestSwitchToggle(switchData.id));
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.requestSwitchToggle(switchData.id);
        }
      });
      switchData.control = { group, state };
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
        if (beforeKey !== afterKey) this.updateSegmentAppearance(segmentId, Boolean(after && after.size > 0));
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
          switchData.control.state.textContent = switchData.locked ? "LOCK" : (switchData.state === "straight" ? "GER" : "ABZ");
        }
      });
    }

    updateSegmentAppearance(segmentId, occupiedOverride) {
      const segment = this.segments.get(segmentId);
      if (!segment || !segment.element) return;
      const occupied = occupiedOverride === undefined
        ? Boolean(this.occupancy.get(segmentId) && this.occupancy.get(segmentId).size)
        : occupiedOverride;
      const classes = ["track-segment"];
      if (segment.switchRole && segment.switchId) {
        const switchData = this.switches.get(segment.switchId);
        const selected = switchData.state === segment.switchRole;
        classes.push(selected ? "switch-selected" : "switch-inactive");
      }
      if (occupied) classes.push("occupied");
      segment.element.setAttribute("class", classes.join(" "));
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
