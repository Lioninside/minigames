(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const VIEW_BOX = { x: 0, y: 0, width: 1600, height: 900 };
  const SNAP_EPSILON = 0.05;
  let measurePath = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeRotation(value) {
    const n = Number(value) || 0;
    return ((n % 360) + 360) % 360;
  }

  function rotatePoint(local, rotation) {
    const rad = normalizeRotation(rotation) * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      x: local.x * cos - local.y * sin,
      y: local.x * sin + local.y * cos
    };
  }

  function transformLocal(node, local) {
    const p = rotatePoint(local, node.rotation || 0);
    return { x: roundCoord((Number(node.x) || 0) + p.x), y: roundCoord((Number(node.y) || 0) + p.y) };
  }

  function roundCoord(value) {
    return Math.round(value * 100) / 100;
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function portDefinitions(node) {
    if (!node) return [];
    const side = node.branchSide === "left" ? -1 : 1;
    if (node.type === "start") {
      return [
        { id: "in", label: "IN", type: "start-input", role: "input", local: { x: -48, y: 0 } },
        { id: "out", label: "OUT", type: "start-output", role: "output", local: { x: 48, y: 0 } }
      ];
    }
    if (node.type === "goal") {
      return [{ id: "in", label: "IN", type: "input", role: "input", multi: true, local: { x: -48, y: 0 } }];
    }
    if (node.type === "deadend") {
      return [{ id: "in", label: "IN", type: "input", role: "input", local: { x: -48, y: 0 } }];
    }
    if (node.type === "switch") {
      return [
        { id: "in", label: "IN", type: "switch-input", role: "input", local: { x: -58, y: 0 } },
        { id: "straight", label: "STRAIGHT OUT", type: "switch-straight-output", role: "output", local: { x: 66, y: 0 } },
        { id: "branch", label: "BRANCH OUT", type: "switch-branch-output", role: "output", local: { x: 66, y: side * 42 } }
      ];
    }
    if (node.type === "merge") {
      return [
        { id: "inA", label: "IN A", type: "merge-input-a", role: "input", local: { x: -58, y: -32 } },
        { id: "inB", label: "IN B", type: "merge-input-b", role: "input", local: { x: -58, y: 32 } },
        { id: "out", label: "OUT", type: "merge-output", role: "output", local: { x: 66, y: 0 } }
      ];
    }
    return [];
  }

  function getPorts(node) {
    return portDefinitions(node).map(port => Object.assign({}, port, transformLocal(node, port.local)));
  }

  function getPort(node, portId) {
    return getPorts(node).find(port => port.id === portId) || null;
  }

  function getPortByRef(project, ref) {
    const node = getNode(project, ref && ref.nodeId);
    if (!node) return null;
    return getPort(node, ref.portId);
  }

  function getNode(project, nodeId) {
    return (project.nodes || []).find(node => node.id === nodeId) || null;
  }

  function isOutputPort(port) {
    return !!port && port.role === "output";
  }

  function isInputPort(port) {
    return !!port && port.role === "input";
  }

  function isSwitchOutputPort(port) {
    return !!port && port.role === "output" && /^switch-.*-output$/.test(port.type || "");
  }

  function arePortsCompatible(fromPort, toPort) {
    return !!fromPort && !!toPort;
  }

  function cleanPoint(point) {
    return { x: roundCoord(Number(point.x) || 0), y: roundCoord(Number(point.y) || 0) };
  }

  function makeTrackPath(points) {
    const pts = (points || []).map(cleanPoint);
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

    const parts = [`M ${pts[0].x} ${pts[0].y}`];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = {
        x: roundCoord(p1.x + (p2.x - p0.x) / 6),
        y: roundCoord(p1.y + (p2.y - p0.y) / 6)
      };
      const c2 = {
        x: roundCoord(p2.x - (p3.x - p1.x) / 6),
        y: roundCoord(p2.y - (p3.y - p1.y) / 6)
      };
      parts.push(`C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`);
    }
    return parts.join(" ");
  }

  function updateTrackGeometry(project, track) {
    const fromNode = getNode(project, track.from && track.from.nodeId);
    const toNode = getNode(project, track.to && track.to.nodeId);
    const fromPort = getPort(fromNode, track.from && track.from.portId);
    const toPort = getPort(toNode, track.to && track.to.portId);
    if (fromPort && toPort) {
      const points = (track.points || []).map(cleanPoint);
      if (points.length < 2) {
        track.points = [cleanPoint(fromPort), cleanPoint(toPort)];
      } else {
        points[0] = cleanPoint(fromPort);
        points[points.length - 1] = cleanPoint(toPort);
        track.points = points;
      }
    }
    track.path = makeTrackPath(track.points || []);
    if (!track.status) track.status = "free";
    return track;
  }

  function updateAllTrackGeometry(project) {
    (project.tracks || []).forEach(track => updateTrackGeometry(project, track));
    return project;
  }

  function polylineLength(points) {
    const pts = points || [];
    let total = 0;
    for (let i = 1; i < pts.length; i += 1) {
      total += distance(pts[i - 1], pts[i]);
    }
    return total;
  }

  function pathLength(pathData, points) {
    if (points && points.length > 1) return polylineLength(points);
    if (!pathData) return 0;
    if (typeof document !== "undefined" && document.createElementNS) {
      const path = measurePath || (measurePath = document.createElementNS(SVG_NS, "path"));
      path.setAttribute("d", pathData);
      try {
        return path.getTotalLength();
      } catch (err) {
        return 0;
      }
    }
    return 0;
  }

  function endpointMatches(track, port, pointIndex) {
    if (!port || !track.points || !track.points.length) return false;
    const point = pointIndex === "last" ? track.points[track.points.length - 1] : track.points[0];
    return distance(point, port) <= SNAP_EPSILON;
  }

  function portKey(nodeId, portId) {
    return `${nodeId}:${portId}`;
  }

  function buildConnections(project) {
    const byNode = new Map((project.nodes || []).map(node => [node.id, node]));
    const incoming = new Map();
    const outgoing = new Map();
    const byPortIn = new Map();
    const byPortOut = new Map();

    function push(map, key, track) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(track);
    }

    (project.tracks || []).forEach(track => {
      const fromNode = byNode.get(track.from && track.from.nodeId);
      const toNode = byNode.get(track.to && track.to.nodeId);
      if (!fromNode || !toNode) return;
      push(outgoing, fromNode.id, track);
      push(incoming, toNode.id, track);
      push(byPortOut, portKey(fromNode.id, track.from.portId), track);
      push(byPortIn, portKey(toNode.id, track.to.portId), track);
    });

    const switchFields = new Map();
    const mergeFields = new Map();

    (project.nodes || []).forEach(node => {
      if (node.type === "switch") {
        switchFields.set(node.id, {
          incomingTrackId: null,
          outgoingTrackStraightId: null,
          outgoingTrackBranchId: null
        });
      }
      if (node.type === "merge") {
        mergeFields.set(node.id, {
          incomingTrackIds: [],
          outgoingTrackId: null
        });
      }
    });

    (project.tracks || []).forEach(track => {
      const fromNode = byNode.get(track.from && track.from.nodeId);
      const toNode = byNode.get(track.to && track.to.nodeId);
      if (toNode && toNode.type === "switch" && track.to.portId === "in") {
        const fields = switchFields.get(toNode.id);
        if (fields) fields.incomingTrackId = track.id;
      }
      if (fromNode && fromNode.type === "switch" && track.from.portId === "in") {
        const fields = switchFields.get(fromNode.id);
        if (fields) fields.incomingTrackId = track.id;
      }
      if (fromNode && fromNode.type === "switch" && track.from.portId === "straight") {
        const fields = switchFields.get(fromNode.id);
        if (fields) fields.outgoingTrackStraightId = track.id;
      }
      if (fromNode && fromNode.type === "switch" && track.from.portId === "branch") {
        const fields = switchFields.get(fromNode.id);
        if (fields) fields.outgoingTrackBranchId = track.id;
      }
      if (toNode && toNode.type === "switch" && track.to.portId === "straight") {
        const fields = switchFields.get(toNode.id);
        if (fields) fields.outgoingTrackStraightId = track.id;
      }
      if (toNode && toNode.type === "switch" && track.to.portId === "branch") {
        const fields = switchFields.get(toNode.id);
        if (fields) fields.outgoingTrackBranchId = track.id;
      }
      if (toNode && toNode.type === "merge" && (track.to.portId === "inA" || track.to.portId === "inB")) {
        const fields = mergeFields.get(toNode.id);
        if (fields) fields.incomingTrackIds.push(track.id);
      }
      if (fromNode && fromNode.type === "merge" && track.from.portId === "out") {
        const fields = mergeFields.get(fromNode.id);
        if (fields) fields.outgoingTrackId = track.id;
      }
    });

    return { incoming, outgoing, byPortIn, byPortOut, switchFields, mergeFields };
  }

  function applyConnectionFields(project) {
    const connections = buildConnections(project);
    (project.nodes || []).forEach(node => {
      if (node.type === "switch") {
        const fields = connections.switchFields.get(node.id) || {};
        node.incomingTrackId = fields.incomingTrackId || null;
        node.outgoingTrackStraightId = fields.outgoingTrackStraightId || null;
        node.outgoingTrackBranchId = fields.outgoingTrackBranchId || null;
        if (node.selectedOutput !== "branch") node.selectedOutput = "straight";
      }
      if (node.type === "merge") {
        const fields = connections.mergeFields.get(node.id) || {};
        node.incomingTrackIds = fields.incomingTrackIds || [];
        node.outgoingTrackId = fields.outgoingTrackId || null;
      }
    });
    return project;
  }

  function buildGraph(project, safeOnly) {
    const adjacency = new Map();
    const trackById = new Map((project.tracks || []).map(track => [track.id, track]));
    (project.nodes || []).forEach(node => adjacency.set(node.id, []));
    (project.tracks || []).forEach(track => {
      if (safeOnly && track.status === "defect") return;
      const fromNode = getNode(project, track.from && track.from.nodeId);
      const toNode = getNode(project, track.to && track.to.nodeId);
      const fromPort = getPort(fromNode, track.from && track.from.portId);
      const toPort = getPort(toNode, track.to && track.to.portId);
      if (!fromNode || !toNode || !arePortsCompatible(fromPort, toPort)) return;
      if (!adjacency.has(fromNode.id)) adjacency.set(fromNode.id, []);
      adjacency.get(fromNode.id).push({ nodeId: toNode.id, trackId: track.id });
      if (isSwitchOutputPort(fromPort) && isSwitchOutputPort(toPort)) {
        if (!adjacency.has(toNode.id)) adjacency.set(toNode.id, []);
        adjacency.get(toNode.id).push({ nodeId: fromNode.id, trackId: track.id });
      }
    });
    return { adjacency, trackById };
  }

  function reachable(project, startId, goalId, safeOnly) {
    if (!startId || !goalId) return false;
    const graph = buildGraph(project, safeOnly);
    const queue = [startId];
    const seen = new Set([startId]);
    while (queue.length) {
      const nodeId = queue.shift();
      if (nodeId === goalId) return true;
      (graph.adjacency.get(nodeId) || []).forEach(edge => {
        if (!seen.has(edge.nodeId)) {
          seen.add(edge.nodeId);
          queue.push(edge.nodeId);
        }
      });
    }
    return false;
  }

  function hasReturnToStart(project, startId, safeOnly) {
    if (!startId) return false;
    const graph = buildGraph(project, safeOnly);
    const queue = (graph.adjacency.get(startId) || []).map(edge => ({ nodeId: edge.nodeId, depth: 1 }));
    const seen = new Set();
    while (queue.length) {
      const current = queue.shift();
      if (current.nodeId === startId && current.depth > 0) return true;
      if (seen.has(current.nodeId)) continue;
      seen.add(current.nodeId);
      (graph.adjacency.get(current.nodeId) || []).forEach(edge => {
        queue.push({ nodeId: edge.nodeId, depth: current.depth + 1 });
      });
    }
    return false;
  }

  function findReachableNodes(project, startId) {
    const graph = buildGraph(project, false);
    const queue = startId ? [startId] : [];
    const seen = new Set(queue);
    while (queue.length) {
      const nodeId = queue.shift();
      (graph.adjacency.get(nodeId) || []).forEach(edge => {
        if (!seen.has(edge.nodeId)) {
          seen.add(edge.nodeId);
          queue.push(edge.nodeId);
        }
      });
    }
    return seen;
  }

  function findCycles(project) {
    const graph = buildGraph(project, false).adjacency;
    const visited = new Set();
    const stack = new Set();
    const trackStack = [];
    const cycles = [];

    function visit(nodeId) {
      visited.add(nodeId);
      stack.add(nodeId);
      (graph.get(nodeId) || []).forEach(edge => {
        if (!visited.has(edge.nodeId)) {
          trackStack.push(edge.trackId);
          visit(edge.nodeId);
          trackStack.pop();
        } else if (stack.has(edge.nodeId)) {
          cycles.push(trackStack.concat(edge.trackId).slice(-8));
        }
      });
      stack.delete(nodeId);
    }

    (project.nodes || []).forEach(node => {
      if (!visited.has(node.id)) visit(node.id);
    });
    return cycles;
  }

  function pointOnSegment(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  function segmentsForTrack(track) {
    const points = (track.points || []).map(cleanPoint);
    const segments = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const from = points[i];
      const to = points[i + 1];
      const steps = Math.max(1, Math.ceil(distance(from, to) / 80));
      let last = from;
      for (let step = 1; step <= steps; step += 1) {
        const next = pointOnSegment(from, to, step / steps);
        segments.push({ a: last, b: next });
        last = next;
      }
    }
    return segments;
  }

  function orientation(a, b, c) {
    return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  }

  function intersects(s1, s2) {
    const o1 = orientation(s1.a, s1.b, s2.a);
    const o2 = orientation(s1.a, s1.b, s2.b);
    const o3 = orientation(s2.a, s2.b, s1.a);
    const o4 = orientation(s2.a, s2.b, s1.b);
    return o1 * o2 < 0 && o3 * o4 < 0;
  }

  function shareEndpoint(trackA, trackB) {
    const ptsA = trackA.points || [];
    const ptsB = trackB.points || [];
    if (!ptsA.length || !ptsB.length) return false;
    const endpointsA = [ptsA[0], ptsA[ptsA.length - 1]];
    const endpointsB = [ptsB[0], ptsB[ptsB.length - 1]];
    return endpointsA.some(a => endpointsB.some(b => distance(a, b) < 1));
  }

  function findCrossings(project) {
    const tracks = project.tracks || [];
    const result = [];
    if (tracks.length > 180) {
      result.skipped = true;
      return result;
    }
    for (let i = 0; i < tracks.length; i += 1) {
      for (let j = i + 1; j < tracks.length; j += 1) {
        if (shareEndpoint(tracks[i], tracks[j])) continue;
        const aSegments = segmentsForTrack(tracks[i]);
        const bSegments = segmentsForTrack(tracks[j]);
        if (aSegments.some(a => bSegments.some(b => intersects(a, b)))) {
          result.push([tracks[i].id, tracks[j].id]);
        }
      }
    }
    return result;
  }

  function hasTightBend(track) {
    const points = track.points || [];
    for (let i = 1; i < points.length - 1; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const c = points[i + 1];
      const v1 = { x: b.x - a.x, y: b.y - a.y };
      const v2 = { x: c.x - b.x, y: c.y - b.y };
      const l1 = Math.hypot(v1.x, v1.y);
      const l2 = Math.hypot(v2.x, v2.y);
      if (l1 < 1 || l2 < 1) continue;
      const dot = (v1.x * v2.x + v1.y * v2.y) / (l1 * l2);
      if (dot < -0.42) return true;
    }
    return false;
  }

  function validate(project) {
    updateAllTrackGeometry(project);
    applyConnectionFields(project);

    const errors = [];
    const warnings = [];
    const connections = buildConnections(project);

    function issue(list, code, message, targetId, targetType) {
      list.push({ level: list === errors ? "error" : "warning", code, message, targetId: targetId || null, targetType: targetType || null });
    }

    const nodes = project.nodes || [];
    const tracks = project.tracks || [];
    const allIds = new Map();
    nodes.concat(tracks).forEach(item => {
      if (!item.id) issue(errors, "missing-id", "Ein Element besitzt keine Kennung.", null, item.type || "track");
      if (item.id && allIds.has(item.id)) issue(errors, "duplicate-id", `Die Kennung ${item.id} ist doppelt vergeben.`, item.id, item.type || "track");
      if (item.id) allIds.set(item.id, item);
    });

    const starts = nodes.filter(node => node.type === "start");
    const goals = nodes.filter(node => node.type === "goal");
    if (starts.length !== 1) issue(errors, "start-count", "Es muss genau ein Startpunkt A existieren.", starts[0] && starts[0].id, "node");
    if (goals.length > 1) issue(errors, "goal-count", "Es darf hoechstens ein optionales Ziel B existieren.", goals[0] && goals[0].id, "node");
    const start = starts[0] || null;
    const goal = goals[0] || null;

    tracks.forEach(track => {
      const fromNode = getNode(project, track.from && track.from.nodeId);
      const toNode = getNode(project, track.to && track.to.nodeId);
      const fromPort = getPort(fromNode, track.from && track.from.portId);
      const toPort = getPort(toNode, track.to && track.to.portId);
      if (!fromNode || !toNode || !fromPort || !toPort) {
        issue(errors, "track-end", `Gleis ${track.id} besitzt keinen gueltigen Anfang oder kein gueltiges Ende.`, track.id, "track");
        return;
      }
      if (!arePortsCompatible(fromPort, toPort)) {
        issue(errors, "track-direction", `Gleis ${track.id} verbindet keine Richtung Ausgang zu Eingang.`, track.id, "track");
      }
      if (!track.path) issue(errors, "track-path", `Gleis ${track.id} besitzt keinen SVG-Pfad.`, track.id, "track");
      const length = pathLength(track.path, track.points);
      if (length <= 0.5) issue(errors, "track-length", `Gleis ${track.id} besitzt keine positive Pfadlaenge.`, track.id, "track");
      if (!endpointMatches(track, fromPort, 0) || !endpointMatches(track, toPort, "last")) {
        issue(errors, "track-snap", `Gleis ${track.id} liegt nicht exakt auf seinen Anschluessen.`, track.id, "track");
      }
      if (length < 36) issue(warnings, "short-track", `Gleis ${track.id} ist sehr kurz.`, track.id, "track");
      if (hasTightBend(track)) issue(warnings, "tight-curve", `Gleis ${track.id} enthaelt eine sehr enge Kurve.`, track.id, "track");
    });

    nodes.forEach(node => {
      const ports = getPorts(node);
      ports.forEach(port => {
        const inCount = (connections.byPortIn.get(portKey(node.id, port.id)) || []).length;
        const outCount = (connections.byPortOut.get(portKey(node.id, port.id)) || []).length;
        const totalCount = inCount + outCount;
        if (!port.multi && totalCount > 1) issue(errors, "port-overbooked", `${node.id}.${port.id} hat mehr als eine Gleisverbindung.`, node.id, "node");
        if (port.multi && totalCount < inCount) issue(errors, "port-overbooked", `${node.id}.${port.id} ist ungueltig belegt.`, node.id, "node");
        if (node.type === "switch" && port.id !== "in" && inCount > 0) issue(warnings, "switch-output-link", `${node.id}.${port.id} ist als Rueckverbindung belegt.`, node.id, "node");
      });

      if (node.type === "start") {
        const outCount = (connections.byPortOut.get(portKey(node.id, "out")) || []).length + (connections.byPortIn.get(portKey(node.id, "out")) || []).length;
        const inCount = (connections.byPortOut.get(portKey(node.id, "in")) || []).length + (connections.byPortIn.get(portKey(node.id, "in")) || []).length;
        if (inCount > 1) issue(errors, "start-input", "Der Startpunkt A darf hoechstens ein Ruecklaufgleis besitzen.", node.id, "node");
        if (outCount !== 1) issue(errors, "start-output", "Der Startpunkt muss genau ein Ausgangsgleis besitzen.", node.id, "node");
      }
      if (node.type === "goal") {
        const totalCount = (connections.incoming.get(node.id) || []).length + (connections.outgoing.get(node.id) || []).length;
        if (totalCount < 1) issue(warnings, "goal-input", "Ziel B ist optional und noch nicht angeschlossen.", node.id, "node");
      }
      if (node.type === "switch") {
        const fields = connections.switchFields.get(node.id) || {};
        const inputCount = (connections.byPortOut.get(portKey(node.id, "in")) || []).length + (connections.byPortIn.get(portKey(node.id, "in")) || []).length;
        const straightCount = (connections.byPortOut.get(portKey(node.id, "straight")) || []).length + (connections.byPortIn.get(portKey(node.id, "straight")) || []).length;
        const branchCount = (connections.byPortOut.get(portKey(node.id, "branch")) || []).length + (connections.byPortIn.get(portKey(node.id, "branch")) || []).length;
        if (inputCount !== 1) issue(errors, "switch-input", `Weiche ${node.id} braucht genau eine Verbindung am linken Anschluss.`, node.id, "node");
        if (straightCount !== 1) issue(errors, "switch-straight", `Weiche ${node.id} braucht genau eine Verbindung am geraden Anschluss.`, node.id, "node");
        if (branchCount !== 1) issue(errors, "switch-branch", `Weiche ${node.id} braucht genau eine Verbindung am abzweigenden Anschluss.`, node.id, "node");
        if (!fields.incomingTrackId || !fields.outgoingTrackStraightId || !fields.outgoingTrackBranchId) issue(errors, "switch-outputs", `Weiche ${node.id} besitzt keine vollstaendige Anschlussdefinition.`, node.id, "node");

        const inPort = getPort(node, "in");
        const straightPort = getPort(node, "straight");
        const branchPort = getPort(node, "branch");
        const forward = { x: straightPort.x - inPort.x, y: straightPort.y - inPort.y };
        const branch = { x: branchPort.x - inPort.x, y: branchPort.y - inPort.y };
        const forwardLength = Math.hypot(forward.x, forward.y);
        const branchLength = Math.hypot(branch.x, branch.y);
        const dot = (forward.x * branch.x + forward.y * branch.y) / Math.max(1, forwardLength * branchLength);
        if (dot < 0.25) issue(errors, "switch-geometry", `Weiche ${node.id} fuehrt geometrisch zu stark rueckwaerts.`, node.id, "node");
      }
      if (node.type === "merge") {
        const inA = (connections.byPortIn.get(portKey(node.id, "inA")) || []).length + (connections.byPortOut.get(portKey(node.id, "inA")) || []).length;
        const inB = (connections.byPortIn.get(portKey(node.id, "inB")) || []).length + (connections.byPortOut.get(portKey(node.id, "inB")) || []).length;
        const out = (connections.byPortOut.get(portKey(node.id, "out")) || []).length + (connections.byPortIn.get(portKey(node.id, "out")) || []).length;
        if (inA !== 1 || inB !== 1) issue(errors, "merge-inputs", `Zusammenfuehrung ${node.id} braucht genau zwei belegte Eingaenge.`, node.id, "node");
        if (out !== 1) issue(errors, "merge-output", `Zusammenfuehrung ${node.id} braucht genau einen belegten Ausgang.`, node.id, "node");
        if (node.selectedOutput) issue(errors, "merge-switchable", `Zusammenfuehrung ${node.id} darf nicht steuerbar sein.`, node.id, "node");
      }
      if (node.type === "deadend") {
        const inCount = (connections.incoming.get(node.id) || []).length + (connections.outgoing.get(node.id) || []).length;
        const outCount = 0;
        if (inCount !== 1) issue(errors, "deadend-input", `Sackgasse ${node.id} braucht genau ein ankommendes Gleis.`, node.id, "node");
        if (outCount !== 0) issue(errors, "deadend-output", `Sackgasse ${node.id} darf keinen Ausgang besitzen.`, node.id, "node");
        if (inCount === 1) issue(warnings, "deadend", `Sackgasse ${node.id} beendet eine Route absichtlich.`, node.id, "node");
      }
    });

    const goalConnected = !!(goal && (connections.incoming.get(goal.id) || []).length > 0);
    const goalReachable = !!(start && goalConnected && reachable(project, start.id, goal.id, false));
    const safeGoalReachable = !!(start && goalConnected && reachable(project, start.id, goal.id, true));
    const loopClosed = !!(start && hasReturnToStart(project, start.id, false));
    const safeLoopClosed = !!(start && hasReturnToStart(project, start.id, true));

    if (start) {
      if (goalConnected && !goalReachable) {
        issue(errors, "goal-unreachable", "B ist von A aus nicht erreichbar.", goal.id, "node");
      }
      if (!goalConnected && !loopClosed) {
        issue(errors, "loop-open", "Ohne Ziel B muss der Rundkurs wieder am Eingang von A enden.", start.id, "node");
      }
      if ((goalConnected || loopClosed) && !safeGoalReachable && !safeLoopClosed) {
        issue(errors, "safe-route", "Es existiert keine sichere Fahrt von A zu B oder zurueck nach A ohne defekte Gleise.", start.id, "node");
      }
      const reachableNodes = findReachableNodes(project, start.id);
      nodes.forEach(node => {
        if (!reachableNodes.has(node.id)) issue(warnings, "unreachable-node", `Knoten ${node.id} liegt in einem nicht erreichbaren Nebenbereich.`, node.id, "node");
      });
    }

    findCycles(project).slice(0, 5).forEach(cycle => {
      issue(warnings, "cycle", `Gerichteter Kreis erkannt: ${cycle.join(", ")}.`, cycle[0], "track");
    });

    const crossings = findCrossings(project);
    if (crossings.skipped) {
      issue(warnings, "crossing-skip", "Kreuzungspruefung uebersprungen: Das Netz ist fuer die Live-Pruefung sehr gross.", null, null);
    }
    crossings.slice(0, 8).forEach(pair => {
      issue(warnings, "crossing", `Optisch unklare Kreuzung zwischen ${pair[0]} und ${pair[1]}.`, pair[0], "track");
    });

    const stats = {
      nodes: nodes.length,
      tracks: tracks.length,
      switches: nodes.filter(node => node.type === "switch").length,
      merges: nodes.filter(node => node.type === "merge").length,
      reachable: goalConnected ? goalReachable : loopClosed,
      safeReachable: goalConnected ? safeGoalReachable : safeLoopClosed,
      goalConnected,
      goalReachable,
      loopClosed,
      safeLoopClosed,
      ready: errors.length === 0
    };

    return { errors, warnings, issues: errors.concat(warnings), stats, connections };
  }

  window.RailGeometry = {
    VIEW_BOX,
    SNAP_EPSILON,
    clone,
    roundCoord,
    normalizeRotation,
    rotatePoint,
    transformLocal,
    distance,
    portDefinitions,
    getPorts,
    getPort,
    getPortByRef,
    getNode,
    isOutputPort,
    isInputPort,
    isSwitchOutputPort,
    arePortsCompatible,
    cleanPoint,
    makeTrackPath,
    updateTrackGeometry,
    updateAllTrackGeometry,
    polylineLength,
    pathLength,
    portKey,
    buildConnections,
    applyConnectionFields,
    buildGraph
  };

  window.RailValidator = { validate };
})();
