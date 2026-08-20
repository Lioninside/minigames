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

  function fromDisplayPoint(point) {
    return { x: LOGICAL_PLAN_WIDTH - point.y, y: point.x };
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

  function cubicBezierPoints(start, controlA, controlB, end, steps) {
    const points = [];
    for (let index = 0; index <= steps; index += 1) {
      const progress = index / steps;
      const inverse = 1 - progress;
      points.push({
        x: inverse ** 3 * start.x + 3 * inverse ** 2 * progress * controlA.x + 3 * inverse * progress ** 2 * controlB.x + progress ** 3 * end.x,
        y: inverse ** 3 * start.y + 3 * inverse ** 2 * progress * controlA.y + 3 * inverse * progress ** 2 * controlB.y + progress ** 3 * end.y
      });
    }
    return points;
  }

  function smoothJoin(source, target) {
    const span = distance(source.b, target.a);
    const sourceLength = Math.max(0.001, source.length);
    const targetLength = Math.max(0.001, target.length);
    const sourceDirection = {
      x: (source.b.x - source.a.x) / sourceLength,
      y: (source.b.y - source.a.y) / sourceLength
    };
    const targetDirection = {
      x: (target.b.x - target.a.x) / targetLength,
      y: (target.b.y - target.a.y) / targetLength
    };
    const handle = Math.min(90, Math.max(26, span * 0.42));
    return cubicBezierPoints(
      source.b,
      { x: source.b.x + sourceDirection.x * handle, y: source.b.y + sourceDirection.y * handle },
      { x: target.a.x - targetDirection.x * handle, y: target.a.y - targetDirection.y * handle },
      target.a,
      8
    );
  }

  function displayCurve(start, controlA, controlB, end, steps) {
    return cubicBezierPoints(start, controlA, controlB, end, steps).map(fromDisplayPoint);
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
      this.addStablingYard();
      this.addMountainBranch();
      this.addStations();
      this.refreshSwitchVisuals();

      if (this.config.debug) this.renderDebugLabels();
    }

    drawLandscape() {
      const base = svgElement("rect", { x: 0, y: 0, width: 1600, height: 1000, class: "landscape-base" });
      const meadowA = svgElement("path", { d: "M0 94 C230 34 470 116 690 78 C985 25 1244 120 1600 42 V430 C1310 364 1075 404 802 362 C540 322 262 392 0 336 Z", class: "landscape-meadow landscape-meadow-a" });
      const meadowB = svgElement("path", { d: "M0 605 C225 548 484 628 724 584 C1000 530 1290 636 1600 552 V1000 H0 Z", class: "landscape-meadow landscape-meadow-b" });
      const meadowC = svgElement("path", { d: "M352 306 C540 238 690 322 857 278 C1016 236 1167 306 1287 365 C1114 428 954 451 777 426 C618 402 472 405 352 306 Z", class: "landscape-meadow landscape-meadow-c" });
      const stream = svgElement("path", { d: "M1568 250 C1450 296 1430 388 1342 440 C1240 500 1136 488 1066 546 C1000 602 1018 677 920 720", class: "landscape-stream" });
      const lakeShore = svgElement("path", { d: "M638 451 C714 393 875 400 962 457 C1037 508 1041 588 984 648 C920 714 750 698 667 646 C596 601 579 504 638 451 Z", class: "landscape-shore" });
      const lake = svgElement("path", { d: "M652 465 C727 415 864 424 940 473 C993 508 1007 573 970 619 C915 677 774 669 692 625 C630 591 612 510 652 465 Z", class: "landscape-lake" });
      const lakeHighlight = svgElement("path", { d: "M696 494 C764 463 868 470 919 502 M690 549 C761 581 871 580 942 540 M731 619 C800 645 885 633 926 609", class: "landscape-water-lines" });
      this.landscapeLayer.append(base, meadowA, meadowB, meadowC, stream, lakeShore, lake, lakeHighlight);

      const hills = [
        [112, 922, 220, 102], [430, 898, 258, 122], [786, 918, 228, 108],
        [1132, 900, 266, 126], [1484, 918, 210, 104]
      ];
      hills.forEach(([x, y, radiusX, radiusY], index) => {
        const hill = svgElement("g", { class: `landscape-hill hill-${index % 3}` });
        hill.append(
          svgElement("ellipse", { cx: x, cy: y, rx: radiusX, ry: radiusY, class: "hill-base" }),
          svgElement("ellipse", { cx: x - radiusX * 0.12, cy: y - radiusY * 0.14, rx: radiusX * 0.68, ry: radiusY * 0.64, class: "hill-mid" }),
          svgElement("ellipse", { cx: x - radiusX * 0.2, cy: y - radiusY * 0.24, rx: radiusX * 0.33, ry: radiusY * 0.3, class: "hill-peak" })
        );
        this.landscapeLayer.append(hill);
      });

      const rocks = [[1088, 889], [1135, 911], [1194, 873], [1322, 890], [1415, 842], [1472, 876]];
      rocks.forEach(([x, y], index) => this.landscapeLayer.append(svgElement("path", {
        d: `M${x - 8} ${y + 6} L${x - 2} ${y - 7} L${x + 9} ${y - 5} L${x + 13} ${y + 7} Z`,
        class: `landscape-rock rock-${index % 2}`
      })));

      const clusters = [
        [126, 304, 16, 88], [280, 776, 13, 72], [455, 186, 14, 80], [515, 846, 14, 78],
        [1060, 235, 16, 92], [1288, 386, 18, 102], [1446, 626, 15, 92], [930, 744, 12, 70]
      ];
      let seed = 29;
      const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      clusters.forEach(([centerX, centerY, count, spread]) => {
        const cluster = svgElement("g", { class: "landscape-tree-cluster" });
        for (let index = 0; index < count; index += 1) {
          const angle = random() * Math.PI * 2;
          const distanceFromCenter = Math.sqrt(random()) * spread;
          const x = centerX + Math.cos(angle) * distanceFromCenter;
          const y = centerY + Math.sin(angle) * distanceFromCenter * 0.62;
          const radius = 4 + random() * 5.5;
          const tree = svgElement("g", { class: "landscape-tree" });
          tree.append(
            svgElement("circle", { cx: x + 1.8, cy: y + 2.2, r: radius, class: "tree-shadow" }),
            svgElement("circle", { cx: x, cy: y, r: radius, class: "tree-canopy" }),
            svgElement("circle", { cx: x - radius * 0.24, cy: y - radius * 0.28, r: radius * 0.52, class: "tree-highlight" })
          );
          cluster.append(tree);
        }
        this.landscapeLayer.append(cluster);
      });
    }

    addRoute(id, points, closed, targetLength) {
      const sampled = resamplePolyline(points, closed, targetLength);
      const route = { id, segmentIds: [], closed, startIndex: 0 };
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
      const branch = this.addRoute(`branch-${spec.id.toLowerCase()}`, smoothJoin(source, target), false, 24);
      const branchIds = [...branch.segmentIds];
      this.segments.get(branchIds[branchIds.length - 1]).defaultNextId = target.id;

      this.registerSwitch(spec.id, source, target, branchIds, spec.label);
    }

    registerSwitch(id, source, target, branchIds, labelPosition) {
      const protectedBranchIds = branchIds.length > 4
        ? [...branchIds.slice(0, 2), ...branchIds.slice(-2)]
        : branchIds;
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
        protectedSegmentIds: [source.id, source.defaultNextId, ...protectedBranchIds, target.id],
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

    registerStubSwitch(id, source, branchIds, labelPosition) {
      const protectedBranchIds = branchIds.slice(0, 2);
      const switchData = {
        id,
        state: this.config.switchDefaults[id],
        locked: false,
        sourceSegmentId: source.id,
        straightSegmentId: source.defaultNextId,
        divergingSegmentId: branchIds[0],
        branchSegmentIds: branchIds,
        branchTerminalSegmentId: branchIds[branchIds.length - 1],
        targetSegmentId: null,
        protectedSegmentIds: [source.id, source.defaultNextId, ...protectedBranchIds],
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
      this.segments.get(branchIds[0]).switchBranchId = id;
      this.switches.set(id, switchData);
      this.drawSwitchControl(switchData, labelPosition);
    }

    addStablingYard() {
      const specs = [
        { id: "W9", routeId: "siding-sbb", sourceX: 270, trackY: 28, name: "SBB" },
        { id: "W10", routeId: "siding-bls", sourceX: 330, trackY: 57, name: "bls" },
        { id: "W11", routeId: "siding-cargo", sourceX: 390, trackY: 86, name: "cargo" },
        { id: "W12", routeId: "siding-express", sourceX: 450, trackY: 145, name: "express" },
        { id: "W13", routeId: "siding-dampfzug", sourceX: 510, trackY: 174, name: "dampfzug" },
        { id: "W14", routeId: "siding-regio", sourceX: 570, trackY: 203, name: "regio" }
      ];

      specs.forEach((spec) => {
        const source = this.findSegmentNear("outer", fromDisplayPoint({ x: spec.sourceX, y: 120 }), "end");
        const sourceDisplay = toDisplayPoint(source.b);
        const trackStart = { x: 650, y: spec.trackY };
        const trackEnd = { x: 1230, y: spec.trackY };
        const incoming = displayCurve(
          sourceDisplay,
          { x: sourceDisplay.x + 105, y: sourceDisplay.y },
          { x: trackStart.x - 135, y: trackStart.y },
          trackStart,
          8
        );
        const route = this.addRoute(spec.routeId, [...incoming, fromDisplayPoint(trackEnd)], false, 18);
        route.startIndex = Math.max(0, route.segmentIds.length - 12);
        const branchIds = [...route.segmentIds];
        this.registerStubSwitch(spec.id, source, branchIds, fromDisplayPoint({ x: spec.sourceX, y: 145 }));

        const labelY = spec.trackY < 120 ? spec.trackY - 8 : spec.trackY + 15;
        const label = svgElement("text", { x: 935, y: labelY, class: "yard-label", "text-anchor": "middle" });
        label.textContent = spec.name;
        const buffer = svgElement("g", { class: "track-buffer", transform: `translate(${trackEnd.x} ${trackEnd.y})` });
        buffer.append(
          svgElement("line", { x1: -5, y1: -12, x2: -5, y2: 12, class: "buffer-stop" }),
          svgElement("line", { x1: 4, y1: -12, x2: 4, y2: 12, class: "buffer-stop" })
        );
        this.labelLayer.append(label, buffer);
      });

      const title = svgElement("text", { x: 935, y: 244, class: "yard-title", "text-anchor": "middle" });
      title.textContent = "ABSTELLBAHNHOF";
      this.labelLayer.append(title);
    }

    addMountainBranch() {
      const source = this.findSegmentNear("outer", fromDisplayPoint({ x: 1050, y: 880 }), "end");
      const sourceDisplay = toDisplayPoint(source.b);
      const summitStop = { x: 1500, y: 902 };
      const mountainPath = [
        ...displayCurve(
          sourceDisplay,
          { x: sourceDisplay.x + 58, y: sourceDisplay.y + 8 },
          { x: 1090, y: 912 },
          { x: 1155, y: 931 },
          7
        ),
        fromDisplayPoint({ x: 1240, y: 943 }),
        ...displayCurve(
          { x: 1240, y: 943 },
          { x: 1328, y: 958 },
          { x: 1440, y: 944 },
          summitStop,
          8
        ).slice(1)
      ];
      const route = this.addRoute("mountain", mountainPath, false, 18);
      const branchIds = [...route.segmentIds];
      this.registerStubSwitch("W15", source, branchIds, fromDisplayPoint({ x: sourceDisplay.x + 24, y: sourceDisplay.y - 35 }));

      const mountainLabel = svgElement("text", { x: 1364, y: 833, class: "mountain-route-label", "text-anchor": "middle" });
      mountainLabel.textContent = "BERGSTRECKE";
      const buffer = svgElement("g", { class: "track-buffer", transform: `translate(${summitStop.x} ${summitStop.y}) rotate(-8)` });
      buffer.append(
        svgElement("line", { x1: -5, y1: -12, x2: -5, y2: 12, class: "buffer-stop" }),
        svgElement("line", { x1: 4, y1: -12, x2: 4, y2: 12, class: "buffer-stop" })
      );
      this.labelLayer.append(mountainLabel, buffer);
    }

    addStations() {
      this.config.stations.forEach((spec) => {
        const anchorSegment = this.findSegmentNear(spec.routeId, spec.point, "start");
        const route = this.routes.get(spec.routeId);
        const anchorIndex = route.segmentIds.indexOf(anchorSegment.id);
        const zoneSegmentIds = [-2, -1, 0, 1, 2]
          .map((offset) => route.closed
            ? (anchorIndex + offset + route.segmentIds.length) % route.segmentIds.length
            : anchorIndex + offset)
          .filter((index) => index >= 0 && index < route.segmentIds.length)
          .map((index) => route.segmentIds[index]);
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
      const plate = svgElement("rect", { x: displayPosition.x - 24, y: displayPosition.y - 15, width: 48, height: 30, rx: 3, class: "switch-plate" });
      const label = svgElement("text", { x: displayPosition.x, y: displayPosition.y + 0.5, class: "switch-label" });
      label.textContent = switchData.id;
      group.append(plate, label);
      group.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        this.requestSwitchToggle(switchData.id);
      });
      group.addEventListener("click", (event) => event.stopPropagation());
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
      if (step.direction === -1) {
        const segment = this.segments.get(step.segmentId);
        const switchData = segment && segment.switchRole === "straight"
          ? this.switches.get(segment.switchId)
          : null;
        // From the opposing main-line direction, a diverging turnout enters its branch forward from the frog.
        if (switchData && switchData.state === "diverging") {
          return { segmentId: switchData.divergingSegmentId, direction: 1 };
        }
      }
      const segmentId = step.direction === 1
        ? this.getSuccessor(step.segmentId)
        : this.getPredecessor(step.segmentId);
      return segmentId ? { segmentId, direction: step.direction } : null;
    }

    getSidingStartRoute(sidingId, trainLength) {
      const route = this.routes.get(sidingId);
      const availableStart = Math.max(0, route.segmentIds.length - trainLength);
      const startIndex = Math.min(availableStart, route.startIndex || 0);
      return route.segmentIds.slice(startIndex, startIndex + trainLength);
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
