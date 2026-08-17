(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const LOGICAL_PLAN_WIDTH = 1000;

  function svgElement(name, attributes) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes || {}).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function toDisplayPoint(point) {
    return { x: point.y, y: LOGICAL_PLAN_WIDTH - point.x };
  }

  function toDisplayAngle(angle) {
    return angle - 90;
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

  function resampleOpenPolylineByLegs(sourcePoints, targetLength) {
    const sampled = [{ ...sourcePoints[0] }];
    for (let index = 0; index < sourcePoints.length - 1; index += 1) {
      const start = sourcePoints[index];
      const end = sourcePoints[index + 1];
      const segmentCount = Math.max(1, Math.ceil(distance(start, end) / targetLength));
      for (let step = 1; step <= segmentCount; step += 1) {
        const progress = step / segmentCount;
        sampled.push({
          x: start.x + (end.x - start.x) * progress,
          y: start.y + (end.y - start.y) * progress
        });
      }
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
      this.stations = new Map();
      this.occupancy = new Map();
      this.landscapeLayer = null;
      this.trackLayer = null;
      this.stationLayer = null;
      this.labelLayer = null;
      this.trainLayer = null;
      this.onSwitchToggleRequest = null;
    }

    build() {
      this.svg.replaceChildren();
      this.routes.clear();
      this.segments.clear();
      this.switches.clear();
      this.stations.clear();
      this.occupancy.clear();

      this.landscapeLayer = svgElement("g", { "aria-hidden": "true", class: "landscape-layer" });
      this.trackLayer = svgElement("g", { "aria-hidden": "true" });
      this.stationLayer = svgElement("g", { "aria-hidden": "true" });
      this.labelLayer = svgElement("g", { "aria-hidden": "true" });
      this.trainLayer = svgElement("g", { "aria-hidden": "true" });
      this.svg.append(this.landscapeLayer, this.trackLayer, this.stationLayer, this.labelLayer, this.trainLayer);
      this.drawLandscape();

      this.addRoute("outer", raceTrack(120, 880, 70, 1530, 190), true, 30);
      this.addRoute("middle", raceTrack(190, 810, 145, 1455, 150), true, 30);
      this.addRoute("inner", raceTrack(260, 740, 230, 1370, 110), true, 30);

      this.addMainSwitches();
      this.addPassingSidings();
      this.addStations();
      this.refreshSwitchVisuals();

      if (this.config.debug) this.renderDebugLabels();
    }

    drawLandscape() {
      const base = svgElement("rect", { x: 0, y: 0, width: 1600, height: 1000, class: "landscape-base" });
      const meadowA = svgElement("path", { d: "M0 120 C260 50 480 150 670 105 C910 44 1220 122 1600 44 V460 C1350 385 1050 430 790 388 C510 342 260 410 0 350 Z", class: "landscape-meadow landscape-meadow-a" });
      const meadowB = svgElement("path", { d: "M0 650 C310 555 540 670 770 625 C1040 575 1300 670 1600 562 V1000 H0 Z", class: "landscape-meadow landscape-meadow-b" });
      const lake = svgElement("path", { d: "M654 460 C730 412 866 424 940 474 C988 507 1012 573 970 622 C916 680 772 672 690 627 C626 592 608 509 654 460 Z", class: "landscape-lake" });
      const lakeShore = svgElement("path", { d: "M643 450 C728 394 882 407 958 462 C1027 510 1036 584 983 640 C918 710 755 696 676 647 C603 602 583 501 643 450 Z", class: "landscape-shore" });
      const lakeHighlight = svgElement("path", { d: "M699 493 C764 462 870 470 919 502 M689 549 C758 582 872 582 944 539 M732 621 C804 646 888 635 927 610", class: "landscape-water-lines" });
      this.landscapeLayer.append(base, meadowA, meadowB, lakeShore, lake, lakeHighlight);

      const mountains = [
        [78, 186, 174, 58, 284, 206], [240, 160, 365, 8, 492, 194], [1104, 174, 1238, 18, 1394, 196],
        [1324, 174, 1478, 46, 1600, 218], [38, 855, 180, 686, 340, 886], [1170, 862, 1330, 662, 1492, 894]
      ];
      mountains.forEach(([x1, y1, x2, y2, x3, y3], index) => {
        const mountain = svgElement("path", { d: `M${x1} ${y1} L${x2} ${y2} L${x3} ${y3} Z`, class: `landscape-mountain mountain-${index % 3}` });
        const ridge = svgElement("path", { d: `M${x2} ${y2} L${x2 - 28} ${y2 + 84} L${x2 + 18} ${y2 + 148} L${x3} ${y3}`, class: "landscape-ridge" });
        this.landscapeLayer.append(mountain, ridge);
      });

      let seed = 29;
      const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      for (let index = 0; index < 128; index += 1) {
        const side = index % 2;
        const x = side ? 1070 + random() * 455 : 40 + random() * 430;
        const y = 110 + random() * 790;
        const radius = 3.7 + random() * 5.8;
        const tree = svgElement("g", { class: "landscape-tree" });
        tree.append(
          svgElement("circle", { cx: x + 1.8, cy: y + 2.2, r: radius, class: "tree-shadow" }),
          svgElement("circle", { cx: x, cy: y, r: radius, class: "tree-canopy" }),
          svgElement("circle", { cx: x - radius * 0.24, cy: y - radius * 0.28, r: radius * 0.52, class: "tree-highlight" })
        );
        this.landscapeLayer.append(tree);
      }
    }

    addRoute(id, points, closed, targetLength, preserveVertices) {
      const sampled = preserveVertices && !closed
        ? resampleOpenPolylineByLegs(points, targetLength)
        : resamplePolyline(points, closed, targetLength);
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
          defaultPreviousId: null,
          switchRole: null,
          switchId: null,
          switchSourceId: null,
          switchTargetId: null,
          switchBranchId: null,
          element: null
        };
        this.segments.set(segmentId, segment);
        route.segmentIds.push(segmentId);
      }

      route.segmentIds.forEach((segmentId, index) => {
        const nextIndex = index + 1;
        const previousIndex = index - 1;
        const nextId = nextIndex < route.segmentIds.length
          ? route.segmentIds[nextIndex]
          : (closed ? route.segmentIds[0] : null);
        const previousId = previousIndex >= 0
          ? route.segmentIds[previousIndex]
          : (closed ? route.segmentIds[route.segmentIds.length - 1] : null);
        this.segments.get(segmentId).defaultNextId = nextId;
        this.segments.get(segmentId).defaultPreviousId = previousId;
      });

      this.routes.set(id, route);
      route.segmentIds.forEach((segmentId) => this.drawSegment(this.segments.get(segmentId)));
      return route;
    }

    drawSegment(segment) {
      const inset = Math.min(3.4, segment.length * 0.18);
      const dx = (segment.b.x - segment.a.x) / segment.length;
      const dy = (segment.b.y - segment.a.y) / segment.length;
      const start = toDisplayPoint({ x: segment.a.x + dx * inset, y: segment.a.y + dy * inset });
      const end = toDisplayPoint({ x: segment.b.x - dx * inset, y: segment.b.y - dy * inset });
      const displayLength = Math.hypot(end.x - start.x, end.y - start.y);
      const normal = {
        x: -(end.y - start.y) / displayLength * 2.55,
        y: (end.x - start.x) / displayLength * 2.55
      };
      const lineAttributes = (className, offset) => ({
        x1: start.x + normal.x * offset,
        y1: start.y + normal.y * offset,
        x2: end.x + normal.x * offset,
        y2: end.y + normal.y * offset,
        class: className
      });
      const group = svgElement("g", { "data-segment-id": segment.id, class: "track-segment" });
      const ballast = svgElement("line", lineAttributes("track-ballast", 0));
      const sleepers = svgElement("line", lineAttributes("track-sleepers", 0));
      const railLeft = svgElement("line", lineAttributes("track-rail", -1));
      const railRight = svgElement("line", lineAttributes("track-rail", 1));
      group.append(ballast, sleepers, railLeft, railRight);
      segment.element = group;
      this.trackLayer.append(group);
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
        { id: "W1", source: "outer", target: "middle", sourcePoint: { x: 120, y: 600 }, targetPoint: { x: 190, y: 470 }, label: { x: 155, y: 535 } },
        { id: "W2", source: "middle", target: "inner", sourcePoint: { x: 190, y: 600 }, targetPoint: { x: 260, y: 470 }, label: { x: 225, y: 535 } },
        { id: "W3", source: "middle", target: "outer", sourcePoint: { x: 190, y: 1070 }, targetPoint: { x: 120, y: 1210 }, label: { x: 155, y: 1140 } },
        { id: "W4", source: "inner", target: "middle", sourcePoint: { x: 260, y: 1070 }, targetPoint: { x: 190, y: 1210 }, label: { x: 225, y: 1140 } },
        { id: "W5", source: "outer", target: "middle", sourcePoint: { x: 880, y: 395 }, targetPoint: { x: 810, y: 535 }, label: { x: 845, y: 465 } },
        { id: "W6", source: "middle", target: "inner", sourcePoint: { x: 810, y: 395 }, targetPoint: { x: 740, y: 535 }, label: { x: 775, y: 465 } },
        { id: "W7", source: "middle", target: "outer", sourcePoint: { x: 810, y: 930 }, targetPoint: { x: 880, y: 1070 }, label: { x: 845, y: 1000 } },
        { id: "W8", source: "inner", target: "middle", sourcePoint: { x: 740, y: 930 }, targetPoint: { x: 810, y: 1070 }, label: { x: 775, y: 1000 } }
      ];

      specs.forEach((spec) => this.addSwitch(spec));
    }

    addSwitch(spec) {
      const source = this.findSegmentNear(spec.source, spec.sourcePoint, "end");
      const target = this.findSegmentNear(spec.target, spec.targetPoint, "start");
      const branch = this.addRoute(`branch-${spec.id.toLowerCase()}`, [source.b, target.a], false, 26);
      const branchIds = [...branch.segmentIds];
      this.segments.get(branchIds[branchIds.length - 1]).defaultNextId = target.id;

      this.registerSwitch(spec.id, source, target, branchIds, spec.label);
    }

    registerSwitch(id, source, target, branchIds, labelPosition) {
      const switchData = {
        id,
        state: this.config.switchDefaults[id],
        locked: false,
        sourceSegmentId: source.id,
        straightSegmentId: source.defaultNextId,
        divergingSegmentId: branchIds[0],
        branchSegmentIds: branchIds,
        branchTerminalSegmentId: branchIds[branchIds.length - 1],
        targetSegmentId: target.id,
        protectedSegmentIds: [source.id, source.defaultNextId, ...branchIds, target.id],
        control: null
      };

      this.segments.get(switchData.straightSegmentId).switchRole = "straight";
      this.segments.get(switchData.straightSegmentId).switchId = id;
      branchIds.forEach((segmentId) => {
        this.segments.get(segmentId).switchRole = "diverging";
        this.segments.get(segmentId).switchId = id;
      });
      source.switchId = id;
      source.switchSourceId = id;
      target.switchTargetId = id;
      this.segments.get(branchIds[0]).switchBranchId = id;
      this.switches.set(id, switchData);
      this.drawSwitchControl(switchData, labelPosition);
    }

    addPassingSidings() {
      const specs = [
        { id: "W9", routeId: "siding-sbb", entry: { x: 350, y: 70 }, exit: { x: 520, y: 70 }, outsideY: 20, label: { x: 435, y: 42 }, name: "SBB" },
        { id: "W10", routeId: "siding-bls", entry: { x: 500, y: 70 }, exit: { x: 680, y: 70 }, outsideY: 42, label: { x: 590, y: 61 }, name: "bls" },
        { id: "W11", routeId: "siding-cargo", entry: { x: 660, y: 70 }, exit: { x: 820, y: 70 }, outsideY: 58, label: { x: 740, y: 76 }, name: "cargo" },
        { id: "W12", routeId: "siding-express", entry: { x: 680, y: 1530 }, exit: { x: 510, y: 1530 }, outsideY: 1578, label: { x: 595, y: 1550 }, name: "express" },
        { id: "W13", routeId: "siding-dampfzug", entry: { x: 520, y: 1530 }, exit: { x: 340, y: 1530 }, outsideY: 1560, label: { x: 430, y: 1544 }, name: "dampfzug" },
        { id: "W14", routeId: "siding-regio", entry: { x: 360, y: 1530 }, exit: { x: 210, y: 1530 }, outsideY: 1543, label: { x: 285, y: 1538 }, name: "regio" }
      ];

      specs.forEach((spec) => {
        const source = this.findSegmentNear("outer", spec.entry, "end");
        const target = this.findSegmentNear("outer", spec.exit, "start");
        const route = this.addRoute(spec.routeId, [
          source.b,
          { x: source.b.x, y: spec.outsideY },
          { x: target.a.x, y: spec.outsideY },
          target.a
        ], false, 18, true);
        const branchIds = [...route.segmentIds];
        this.segments.get(branchIds[branchIds.length - 1]).defaultNextId = target.id;
        this.registerSwitch(spec.id, source, target, branchIds, spec.label);

        const display = toDisplayPoint({ x: (source.b.x + target.a.x) / 2, y: spec.outsideY });
        const label = svgElement("text", { x: display.x, y: display.y - 9, class: "yard-label", "text-anchor": "middle" });
        label.textContent = spec.name;
        this.labelLayer.append(label);
      });
    }

    addStations() {
      this.config.stations.forEach((spec) => {
        const anchorSegment = this.findSegmentNear(spec.routeId, spec.point, "start");
        const route = this.routes.get(spec.routeId);
        const anchorIndex = route.segmentIds.indexOf(anchorSegment.id);
        const zoneSegmentIds = [-2, -1, 0, 1, 2].map((offset) => {
          const index = (anchorIndex + offset + route.segmentIds.length) % route.segmentIds.length;
          return route.segmentIds[index];
        });
        const pose = this.getSegmentPose(anchorSegment.id, 0.5, 1);
        const station = {
          ...spec,
          segmentId: anchorSegment.id,
          zoneSegmentIds: new Set(zoneSegmentIds),
          pose,
          passengerGroup: null,
          countLabel: null,
          visualElements: []
        };
        this.stations.set(station.id, station);
        this.drawStation(station);
      });
    }

    drawStation(station) {
      const platform = svgElement("rect", {
        x: station.pose.x - 90,
        y: station.pose.y - 14,
        width: 180,
        height: 14,
        class: "station-platform",
        transform: `rotate(${station.pose.angle} ${station.pose.x} ${station.pose.y})`
      });
      platform.style.setProperty("--station-color", station.color);
      const platformEdge = svgElement("line", {
        x1: station.pose.x - 88,
        y1: station.pose.y - 3,
        x2: station.pose.x + 88,
        y2: station.pose.y - 3,
        class: "station-edge",
        transform: `rotate(${station.pose.angle} ${station.pose.x} ${station.pose.y})`
      });
      this.stationLayer.append(platform);
      this.stationLayer.append(platformEdge);

      const labelPosition = {
        x: station.pose.x + station.labelOffset.x,
        y: station.pose.y + station.labelOffset.y
      };
      const titleWidth = station.name.length * 17 + 26;
      const titlePlate = svgElement("rect", {
        x: labelPosition.x - titleWidth / 2,
        y: labelPosition.y - 27,
        width: titleWidth,
        height: 36,
        rx: 4,
        class: "station-sign-panel"
      });
      const label = svgElement("text", { x: labelPosition.x, y: labelPosition.y, class: "station-title", "text-anchor": "middle" });
      label.textContent = station.name;
      const countLabel = svgElement("text", { x: labelPosition.x, y: labelPosition.y + 22, class: "station-count", "text-anchor": "middle" });
      const passengerGroup = svgElement("g", { class: "passenger-queue" });
      station.countLabel = countLabel;
      station.passengerGroup = passengerGroup;
      station.visualElements = [platform, platformEdge, passengerGroup, titlePlate, label, countLabel];
      this.labelLayer.append(passengerGroup, titlePlate, label, countLabel);
    }

    setStationsVisible(visible) {
      this.stations.forEach((station) => {
        station.visualElements.forEach((element) => element.setAttribute("visibility", "visible"));
        station.passengerGroup.setAttribute("visibility", visible ? "visible" : "hidden");
        station.countLabel.setAttribute("visibility", visible ? "visible" : "hidden");
      });
    }

    getStationAtRoutePosition(route, position) {
      const segmentId = this.getRouteSegmentId(route, position);
      for (const station of this.stations.values()) {
        if (station.zoneSegmentIds.has(segmentId)) return station;
      }
      return null;
    }

    renderPassengerQueues(passengers) {
      const waitingByStation = new Map();
      passengers.filter((passenger) => passenger.status === "waiting").forEach((passenger) => {
        if (!waitingByStation.has(passenger.sourceStationId)) waitingByStation.set(passenger.sourceStationId, []);
        waitingByStation.get(passenger.sourceStationId).push(passenger);
      });

      this.stations.forEach((station) => {
        const waiting = waitingByStation.get(station.id) || [];
        station.countLabel.textContent = waiting.length ? `${waiting.length} wartend` : "leer";
        station.passengerGroup.replaceChildren();
        waiting.forEach((passenger, index) => {
          const column = index % 3;
          const row = Math.floor(index / 3);
          const person = svgElement("g", {
            class: "passenger",
            transform: `translate(${station.pose.x + station.queueOffset.x + column * 17} ${station.pose.y + station.queueOffset.y + row * 20})`
          });
          const head = svgElement("circle", { cx: 0, cy: -4.4, r: 3.8, class: "passenger-head" });
          const body = svgElement("rect", { x: -4.6, y: 0, width: 9.2, height: 8, rx: 1.7, class: "passenger-body" });
          head.style.setProperty("--passenger-color", passenger.color);
          body.style.setProperty("--passenger-color", passenger.color);
          person.append(head, body);
          station.passengerGroup.append(person);
        });
      });
    }

    drawSwitchControl(switchData, position) {
      const displayPosition = toDisplayPoint(position);
      const group = svgElement("g", {
        class: "switch-control",
        tabindex: "0",
        role: "button",
        "aria-label": `${switchData.id} umstellen`
      });
      const plate = svgElement("rect", { x: displayPosition.x - 13, y: displayPosition.y - 9, width: 26, height: 18, rx: 1, class: "switch-plate" });
      const label = svgElement("text", { x: displayPosition.x, y: displayPosition.y + 0.5, class: "switch-label" });
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
      const switchData = segment.switchSourceId ? this.switches.get(segment.switchSourceId) : null;
      if (switchData) {
        return switchData.state === "straight" ? switchData.straightSegmentId : switchData.divergingSegmentId;
      }
      return segment.defaultNextId;
    }

    getPredecessor(segmentId) {
      const segment = this.segments.get(segmentId);
      if (!segment) return null;

      if (segment.switchTargetId) {
        const switchData = this.switches.get(segment.switchTargetId);
        if (switchData.state === "diverging") return switchData.branchTerminalSegmentId;
      }

      if (segment.switchBranchId) {
        return this.switches.get(segment.switchBranchId).sourceSegmentId;
      }

      return segment.defaultPreviousId;
    }

    getTraversalSuccessor(step) {
      const segmentId = step.direction === 1
        ? this.getSuccessor(step.segmentId)
        : this.getPredecessor(step.segmentId);
      return segmentId ? { segmentId, direction: step.direction } : null;
    }

    getSidingStartRoute(sidingId, trainLength) {
      const route = this.routes.get(sidingId);
      return route.segmentIds.slice(0, trainLength);
    }

    getSegmentPose(segmentId, progress, direction) {
      const segment = this.segments.get(segmentId);
      const t = Math.max(0, Math.min(0.999, progress));
      const directedProgress = direction === -1 ? 1 - t : t;
      const logicalPoint = {
        x: segment.a.x + (segment.b.x - segment.a.x) * directedProgress,
        y: segment.a.y + (segment.b.y - segment.a.y) * directedProgress
      };
      return {
        ...toDisplayPoint(logicalPoint),
        angle: toDisplayAngle(
          Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x) * 180 / Math.PI
            + (direction === -1 ? 180 : 0)
        )
      };
    }

    getRoutePose(route, position) {
      const safePosition = Math.max(0, Math.min(route.length - 0.001, position));
      const index = Math.floor(safePosition);
      const step = route[index];
      return this.getSegmentPose(step.segmentId, safePosition - index, step.direction);
    }

    getRouteSegmentId(route, position) {
      const safePosition = Math.max(0, Math.min(route.length - 0.001, position));
      return route[Math.floor(safePosition)].segmentId;
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
