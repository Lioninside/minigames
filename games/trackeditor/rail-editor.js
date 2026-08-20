(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const AUTOSAVE_KEY = "trackeditor.autosave.v2";
  const AUTOSAVE_ENABLED = new URLSearchParams(window.location.search).get("autosave") === "1";
  const G = window.RailGeometry;

  const dom = {
    svg: document.getElementById("railSvg"),
    tracks: document.getElementById("tracksLayer"),
    route: document.getElementById("routeLayer"),
    draft: document.getElementById("draftLayer"),
    nodes: document.getElementById("nodesLayer"),
    ports: document.getElementById("portsLayer"),
    controls: document.getElementById("controlsLayer"),
    test: document.getElementById("testLayer"),
    properties: document.getElementById("propertiesContent"),
    issues: document.getElementById("issuesList"),
    status: document.getElementById("statusMessage"),
    projectLabel: document.getElementById("projectLabel"),
    fileInput: document.getElementById("fileInput"),
    restoreNotice: document.getElementById("restoreNotice"),
    gridToggle: document.getElementById("gridToggle"),
    arrowToggle: document.getElementById("arrowToggle"),
    testSpeed: document.getElementById("testSpeed"),
    statNodes: document.getElementById("statNodes"),
    statTracks: document.getElementById("statTracks"),
    statSwitches: document.getElementById("statSwitches"),
    statReachable: document.getElementById("statReachable"),
    statReady: document.getElementById("statReady")
  };

  const app = {
    project: createSampleProject(),
    tool: "select",
    selected: null,
    selectedPointIndex: null,
    history: [],
    future: [],
    dirty: false,
    view: { x: 0, y: 0, width: 1600, height: 900 },
    draftTrack: null,
    drag: null,
    lastValidation: null,
    autosavePending: false,
    animationFrame: 0,
    spaceDown: false,
    pointer: { x: 0, y: 0 },
    testRun: {
      active: false,
      currentTrackId: null,
      distance: 0,
      visited: new Set(),
      routeTrackIds: new Set(),
      message: ""
    }
  };

  function createEmptyProject() {
    return {
      schemaVersion: 1,
      metadata: {
        id: "level01",
        name: "Level 1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      viewBox: { x: 0, y: 0, width: 1600, height: 900 },
      nodes: [],
      tracks: [],
      settings: { showGrid: true, showDirections: true }
    };
  }

  function createSampleProject() {
    const project = createEmptyProject();
    project.metadata.name = "Beispielnetz";
    project.nodes = [
      { id: "A", type: "start", x: 140, y: 430, rotation: 0 },
      { id: "W1", type: "switch", x: 360, y: 430, rotation: 0, branchSide: "right", selectedOutput: "straight" },
      { id: "W2", type: "switch", x: 620, y: 400, rotation: 0, branchSide: "left", selectedOutput: "straight" },
      { id: "W3", type: "switch", x: 850, y: 400, rotation: 0, branchSide: "right", selectedOutput: "straight" },
      { id: "M1", type: "merge", x: 1120, y: 470, rotation: 0 },
      { id: "B", type: "goal", x: 1120, y: 320, rotation: 0 },
      { id: "D1", type: "deadend", x: 750, y: 270, rotation: 0 }
    ];

    function port(nodeId, portId) {
      const node = G.getNode(project, nodeId);
      return G.getPort(node, portId);
    }

    function track(id, fromNodeId, fromPortId, toNodeId, toPortId, via, status) {
      const points = [port(fromNodeId, fromPortId)]
        .concat(via || [])
        .concat(port(toNodeId, toPortId))
        .map(G.cleanPoint);
      return {
        id,
        from: { nodeId: fromNodeId, portId: fromPortId },
        to: { nodeId: toNodeId, portId: toPortId },
        points,
        path: G.makeTrackPath(points),
        status: status || "free"
      };
    }

    project.tracks = [
      track("T1", "A", "out", "W1", "in", [{ x: 250, y: 430 }]),
      track("T2", "W1", "straight", "W2", "in", [{ x: 500, y: 430 }]),
      track("T3", "W1", "branch", "M1", "inB", [{ x: 540, y: 520 }, { x: 760, y: 555 }]),
      track("T4", "W2", "straight", "W3", "in", [{ x: 735, y: 400 }]),
      track("T5", "W2", "branch", "D1", "in", [{ x: 700, y: 330 }], "defect"),
      track("T6", "W3", "straight", "M1", "inA", [{ x: 990, y: 395 }]),
      track("T7", "W3", "branch", "B", "in", [{ x: 990, y: 455 }, { x: 1050, y: 380 }]),
      track("T8", "M1", "out", "A", "in", [
        { x: 1280, y: 650 },
        { x: 730, y: 760 },
        { x: 120, y: 590 }
      ])
    ];
    G.applyConnectionFields(project);
    return project;
  }

  function createLoopSampleProject() {
    const project = createEmptyProject();
    project.metadata.id = "kreis01";
    project.metadata.name = "Kreis-Beispiel";
    project.nodes = [
      { id: "A", type: "start", x: 110, y: 430, rotation: 0 },
      { id: "M1", type: "merge", x: 300, y: 430, rotation: 0 },
      { id: "W1", type: "switch", x: 510, y: 430, rotation: 0, branchSide: "right", selectedOutput: "straight" },
      { id: "W2", type: "switch", x: 780, y: 400, rotation: 0, branchSide: "left", selectedOutput: "straight" },
      { id: "B", type: "goal", x: 1060, y: 400, rotation: 0 },
      { id: "D1", type: "deadend", x: 775, y: 535, rotation: 0 }
    ];

    function port(nodeId, portId) {
      const node = G.getNode(project, nodeId);
      return G.getPort(node, portId);
    }

    function track(id, fromNodeId, fromPortId, toNodeId, toPortId, via, status) {
      const points = [port(fromNodeId, fromPortId)]
        .concat(via || [])
        .concat(port(toNodeId, toPortId))
        .map(G.cleanPoint);
      return {
        id,
        from: { nodeId: fromNodeId, portId: fromPortId },
        to: { nodeId: toNodeId, portId: toPortId },
        points,
        path: G.makeTrackPath(points),
        status: status || "free"
      };
    }

    project.tracks = [
      track("T1", "A", "out", "M1", "inA", [{ x: 190, y: 410 }]),
      track("T2", "M1", "out", "W1", "in", [{ x: 410, y: 430 }]),
      track("T3", "W1", "straight", "W2", "in", [{ x: 630, y: 430 }, { x: 690, y: 402 }]),
      track("T4", "W2", "straight", "B", "in", [{ x: 925, y: 400 }]),
      track("T5", "W2", "branch", "M1", "inB", [
        { x: 930, y: 320 },
        { x: 900, y: 190 },
        { x: 255, y: 190 },
        { x: 205, y: 455 }
      ]),
      track("T6", "W1", "branch", "D1", "in", [{ x: 625, y: 505 }], "defect")
    ];
    G.applyConnectionFields(project);
    return project;
  }

  function normalizeProject(project) {
    project.schemaVersion = project.schemaVersion || 1;
    project.metadata = project.metadata || { id: "level01", name: "Level 1" };
    project.metadata.id = window.RailExporter.safeId(project.metadata.id || "level01");
    project.metadata.name = project.metadata.name || "Level 1";
    project.viewBox = project.viewBox || { x: 0, y: 0, width: 1600, height: 900 };
    project.settings = Object.assign({ showGrid: true, showDirections: true }, project.settings || {});
    project.nodes = project.nodes || [];
    project.tracks = project.tracks || [];
    project.nodes.forEach(node => {
      node.x = G.roundCoord(node.x);
      node.y = G.roundCoord(node.y);
      node.rotation = G.normalizeRotation(node.rotation);
      if (node.type === "switch") {
        node.branchSide = node.branchSide === "left" ? "left" : "right";
        node.selectedOutput = node.selectedOutput === "branch" ? "branch" : "straight";
      }
    });
    G.updateAllTrackGeometry(project);
    G.applyConnectionFields(project);
    return project;
  }

  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined) el.setAttribute(key, String(value));
    });
    if (parent) parent.appendChild(el);
    return el;
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function setStatus(text) {
    dom.status.textContent = text;
  }

  function storageGet(key) {
    if (!AUTOSAVE_ENABLED) return null;
    try {
      return window.localStorage ? window.localStorage.getItem(key) : null;
    } catch (err) {
      return null;
    }
  }

  function storageSet(key, value) {
    if (!AUTOSAVE_ENABLED) return true;
    try {
      if (window.localStorage) window.localStorage.setItem(key, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  function storageRemove(key) {
    if (!AUTOSAVE_ENABLED) return;
    try {
      if (window.localStorage) window.localStorage.removeItem(key);
    } catch (err) {}
  }

  function markDirty() {
    app.dirty = true;
    app.autosavePending = true;
    app.project.metadata.updatedAt = new Date().toISOString();
  }

  function autosave() {
    if ((!app.dirty && !app.autosavePending) || (app.drag && app.drag.recorded)) return;
    if (storageSet(AUTOSAVE_KEY, window.RailExporter.projectJson(app.project))) app.autosavePending = false;
  }

  function recordHistory() {
    app.history.push(G.clone(app.project));
    if (app.history.length > 80) app.history.shift();
    app.future.length = 0;
  }

  function restoreProject(snapshot) {
    app.project = normalizeProject(G.clone(snapshot));
    app.selected = null;
    app.selectedPointIndex = null;
    app.draftTrack = null;
    stopTest("Testfahrt angehalten.");
    render();
  }

  function undo() {
    if (!app.history.length) return;
    app.future.push(G.clone(app.project));
    app.project = normalizeProject(app.history.pop());
    app.selected = null;
    app.selectedPointIndex = null;
    app.draftTrack = null;
    markDirty();
    render();
    setStatus("Rueckgaengig.");
  }

  function redo() {
    if (!app.future.length) return;
    app.history.push(G.clone(app.project));
    app.project = normalizeProject(app.future.pop());
    app.selected = null;
    app.selectedPointIndex = null;
    app.draftTrack = null;
    markDirty();
    render();
    setStatus("Wiederholt.");
  }

  function setTool(tool) {
    app.tool = tool;
    app.draftTrack = null;
    app.selectedPointIndex = null;
    document.querySelectorAll("[data-tool]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.tool === tool);
    });
    dom.svg.className.baseVal = `tool-${tool}${app.project.settings.showGrid ? "" : " no-grid"}`;
    setStatus(tool === "track" ? "Gleis: freien Anschluss anklicken." : "Werkzeug: " + tool);
    render();
  }

  function svgPoint(event) {
    const point = dom.svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(dom.svg.getScreenCTM().inverse());
  }

  function selectElement(type, id) {
    app.selected = type && id ? { type, id } : null;
    app.selectedPointIndex = null;
    render();
  }

  function selectedNode() {
    return app.selected && app.selected.type === "node" ? G.getNode(app.project, app.selected.id) : null;
  }

  function selectedTrack() {
    return app.selected && app.selected.type === "track"
      ? app.project.tracks.find(track => track.id === app.selected.id) || null
      : null;
  }

  function nextId(prefix) {
    const taken = app.project.nodes.concat(app.project.tracks).map(item => item.id);
    let max = 0;
    taken.forEach(id => {
      const match = String(id).match(new RegExp("^" + prefix + "(\\d+)$"));
      if (match) max = Math.max(max, Number(match[1]));
    });
    let index = max + 1;
    while (taken.includes(prefix + index)) index += 1;
    return prefix + index;
  }

  function addNode(type, point) {
    if (type === "start" && app.project.nodes.some(node => node.type === "start")) {
      setStatus("Start A existiert bereits.");
      return;
    }
    if (type === "goal" && app.project.nodes.some(node => node.type === "goal")) {
      setStatus("Ziel B existiert bereits.");
      return;
    }
    const ids = { start: "A", goal: "B", switch: nextId("W"), merge: nextId("M"), deadend: nextId("D") };
    const node = {
      id: ids[type],
      type,
      x: G.roundCoord(point.x),
      y: G.roundCoord(point.y),
      rotation: 0
    };
    if (type === "switch") {
      node.branchSide = "right";
      node.selectedOutput = "straight";
      node.incomingTrackId = null;
      node.outgoingTrackStraightId = null;
      node.outgoingTrackBranchId = null;
    }
    if (type === "merge") {
      node.incomingTrackIds = [];
      node.outgoingTrackId = null;
    }
    recordHistory();
    app.project.nodes.push(node);
    markDirty();
    selectElement("node", node.id);
  }

  function connectedTracks(nodeId) {
    return app.project.tracks.filter(track => track.from.nodeId === nodeId || track.to.nodeId === nodeId);
  }

  function deleteNode(nodeId) {
    const connected = connectedTracks(nodeId);
    if (connected.length > 1 && !window.confirm(`Knoten ${nodeId} hat ${connected.length} Verbindungen. Verbundene Gleise mitloeschen?`)) return;
    recordHistory();
    app.project.tracks = app.project.tracks.filter(track => track.from.nodeId !== nodeId && track.to.nodeId !== nodeId);
    app.project.nodes = app.project.nodes.filter(node => node.id !== nodeId);
    app.selected = null;
    markDirty();
    render();
  }

  function deleteTrack(trackId) {
    recordHistory();
    app.project.tracks = app.project.tracks.filter(track => track.id !== trackId);
    app.selected = null;
    app.selectedPointIndex = null;
    markDirty();
    render();
  }

  function deleteSelected() {
    if (!app.selected) return;
    if (app.selected.type === "node") deleteNode(app.selected.id);
    if (app.selected.type === "track") deleteTrack(app.selected.id);
  }

  function portUsage(nodeId, portId, direction) {
    const validation = app.lastValidation || window.RailValidator.validate(app.project);
    const map = direction === "out" ? validation.connections.byPortOut : validation.connections.byPortIn;
    return map.get(G.portKey(nodeId, portId)) || [];
  }

  function portConnectionCount(nodeId, portId) {
    return portUsage(nodeId, portId, "out").length + portUsage(nodeId, portId, "in").length;
  }

  function isPortAvailable(nodeId, portId, direction) {
    const node = G.getNode(app.project, nodeId);
    const port = G.getPort(node, portId);
    if (!node || !port) return false;
    if (port.multi && direction === "in") return true;
    return portConnectionCount(nodeId, portId) === 0;
  }

  function canStartFrom(nodeId, portId) {
    const node = G.getNode(app.project, nodeId);
    const port = G.getPort(node, portId);
    return !!node && !!port && isPortAvailable(nodeId, portId, "out");
  }

  function canFinishAt(startRef, nodeId, portId) {
    const fromNode = G.getNode(app.project, startRef.nodeId);
    const toNode = G.getNode(app.project, nodeId);
    const fromPort = G.getPort(fromNode, startRef.portId);
    const toPort = G.getPort(toNode, portId);
    if (!fromNode || !toNode || !fromPort || !toPort) return false;
    if (fromNode.id === toNode.id && fromPort.id === toPort.id) return false;
    return G.arePortsCompatible(fromPort, toPort) && isPortAvailable(nodeId, portId, "in");
  }

  function finishProblem(startRef, nodeId, portId) {
    const fromNode = G.getNode(app.project, startRef && startRef.nodeId);
    const toNode = G.getNode(app.project, nodeId);
    const fromPort = G.getPort(fromNode, startRef && startRef.portId);
    const toPort = G.getPort(toNode, portId);
    if (!fromNode || !toNode || !fromPort || !toPort) return "Anschluss nicht gefunden.";
    if (fromNode.id === toNode.id && fromPort.id === toPort.id) return "Start und Ziel sind derselbe Anschluss.";
    if (!G.arePortsCompatible(fromPort, toPort)) return "Diese Anschlussarten sind nicht kompatibel.";
    if (!isPortAvailable(nodeId, portId, "in")) return "Dieser Anschluss ist bereits belegt.";
    return "Dieser Anschluss kann das Gleis nicht beenden.";
  }

  function normalizeTrackEndpoints(fromRef, toRef, points) {
    const fromNode = G.getNode(app.project, fromRef.nodeId);
    const toNode = G.getNode(app.project, toRef.nodeId);
    const fromPort = G.getPort(fromNode, fromRef.portId);
    const toPort = G.getPort(toNode, toRef.portId);
    let reverse = false;

    if (fromNode && fromNode.type === "start" && fromPort && fromPort.id === "in") reverse = true;
    if (toNode && toNode.type === "start" && toPort && toPort.id === "in") reverse = false;
    if (fromNode && fromNode.type === "start" && fromPort && fromPort.id === "out") reverse = false;
    if (toNode && toNode.type === "start" && toPort && toPort.id === "out") reverse = true;
    if (fromNode && (fromNode.type === "goal" || fromNode.type === "deadend")) reverse = true;
    if (toNode && (toNode.type === "goal" || toNode.type === "deadend")) reverse = false;
    if (fromPort && toPort && G.isInputPort(fromPort) && G.isOutputPort(toPort)) reverse = true;

    return reverse
      ? { from: G.clone(toRef), to: G.clone(fromRef), points: points.slice().reverse() }
      : { from: G.clone(fromRef), to: G.clone(toRef), points };
  }

  function beginTrack(nodeId, portId) {
    if (!canStartFrom(nodeId, portId)) {
      setStatus("Dieser Anschluss ist bereits belegt.");
      return;
    }
    const node = G.getNode(app.project, nodeId);
    const port = G.getPort(node, portId);
    app.draftTrack = {
      from: { nodeId, portId },
      points: [G.cleanPoint(port)],
      hover: G.cleanPoint(port)
    };
    app.selected = null;
    setStatus("Ziel-Anschluss anklicken oder Zwischenpunkte setzen.");
    render();
  }

  function finishTrack(nodeId, portId) {
    if (!app.draftTrack || !canFinishAt(app.draftTrack.from, nodeId, portId)) {
      setStatus(finishProblem(app.draftTrack && app.draftTrack.from, nodeId, portId));
      return;
    }
    const toNode = G.getNode(app.project, nodeId);
    const toPort = G.getPort(toNode, portId);
    const draftPoints = app.draftTrack.points.concat(G.cleanPoint(toPort));
    const normalized = normalizeTrackEndpoints(app.draftTrack.from, { nodeId, portId }, draftPoints);
    const track = {
      id: nextId("T"),
      from: normalized.from,
      to: normalized.to,
      points: normalized.points,
      path: G.makeTrackPath(normalized.points),
      status: "free"
    };
    recordHistory();
    app.project.tracks.push(track);
    app.draftTrack = null;
    markDirty();
    selectElement("track", track.id);
    setStatus("Gleis " + track.id + " erstellt.");
  }

  function addDraftPoint(point) {
    if (!app.draftTrack) return;
    app.draftTrack.points.push(G.cleanPoint(point));
    render();
  }

  function cancelDraft() {
    if (!app.draftTrack) return;
    app.draftTrack = null;
    setStatus("Gleiszeichnung abgebrochen.");
    render();
  }

  function updateConnectedTracks(nodeId) {
    app.project.tracks.forEach(track => {
      if (track.from.nodeId === nodeId || track.to.nodeId === nodeId) G.updateTrackGeometry(app.project, track);
    });
    G.applyConnectionFields(app.project);
  }

  function moveNode(node, dx, dy) {
    node.x = G.roundCoord(node.x + dx);
    node.y = G.roundCoord(node.y + dy);
    updateConnectedTracks(node.id);
  }

  function moveSelectedBy(dx, dy) {
    if (!app.selected) return;
    const node = selectedNode();
    const track = selectedTrack();
    recordHistory();
    if (node) moveNode(node, dx, dy);
    if (track && app.selectedPointIndex !== null && app.selectedPointIndex > 0 && app.selectedPointIndex < track.points.length - 1) {
      const p = track.points[app.selectedPointIndex];
      p.x = G.roundCoord(p.x + dx);
      p.y = G.roundCoord(p.y + dy);
      G.updateTrackGeometry(app.project, track);
    }
    markDirty();
    render();
  }

  function setViewBox() {
    dom.svg.setAttribute("viewBox", `${app.view.x} ${app.view.y} ${app.view.width} ${app.view.height}`);
  }

  function resetView() {
    app.view = { x: 0, y: 0, width: 1600, height: 900 };
    setViewBox();
  }

  function fitView() {
    const points = [];
    app.project.nodes.forEach(node => points.push({ x: node.x, y: node.y }));
    app.project.tracks.forEach(track => (track.points || []).forEach(point => points.push(point)));
    if (!points.length) {
      resetView();
      return;
    }
    const minX = Math.min.apply(null, points.map(p => p.x));
    const maxX = Math.max.apply(null, points.map(p => p.x));
    const minY = Math.min.apply(null, points.map(p => p.y));
    const maxY = Math.max.apply(null, points.map(p => p.y));
    const pad = 120;
    const width = Math.max(500, maxX - minX + pad * 2);
    const height = Math.max(320, maxY - minY + pad * 2);
    app.view = { x: minX - pad, y: minY - pad, width, height };
    setViewBox();
  }

  function focusElement(type, id) {
    let point = null;
    if (type === "node") {
      const node = G.getNode(app.project, id);
      if (node) point = { x: node.x, y: node.y };
    }
    if (type === "track") {
      const track = app.project.tracks.find(t => t.id === id);
      if (track && track.points.length) {
        point = track.points[Math.floor(track.points.length / 2)];
      }
    }
    if (point) {
      app.view.x = point.x - app.view.width / 2;
      app.view.y = point.y - app.view.height / 2;
      setViewBox();
    }
  }

  function drawNode(node) {
    const g = svgEl("g", {
      class: `node ${app.selected && app.selected.type === "node" && app.selected.id === node.id ? "selected" : ""}`,
      transform: `translate(${node.x} ${node.y}) rotate(${node.rotation || 0})`,
      "data-node-id": node.id
    }, dom.nodes);

    if (node.type === "start") {
      svgEl("rect", { class: "body", x: -42, y: -27, width: 84, height: 54, rx: 6 }, g);
      svgEl("path", { class: "component-rail", d: "M -48 0 L 48 0" }, g);
      svgEl("text", { class: "node-label", x: 0, y: -8 }, g).textContent = "A";
      svgEl("text", { class: "node-sub", x: 0, y: 14 }, g).textContent = "START";
    } else if (node.type === "goal") {
      svgEl("rect", { class: "body", x: -42, y: -27, width: 84, height: 54, rx: 6 }, g);
      svgEl("path", { class: "component-rail", d: "M -48 0 L 10 0" }, g);
      svgEl("text", { class: "node-label", x: 12, y: -8 }, g).textContent = "B";
      svgEl("text", { class: "node-sub", x: 12, y: 14 }, g).textContent = "ZIEL";
    } else if (node.type === "switch") {
      const side = node.branchSide === "left" ? -1 : 1;
      svgEl("rect", { class: "body", x: -70, y: -52, width: 150, height: 104, rx: 6 }, g);
      svgEl("path", { class: "component-rail " + (node.selectedOutput === "straight" ? "active" : ""), d: "M -58 0 L 66 0" }, g);
      svgEl("path", { class: "component-rail " + (node.selectedOutput === "branch" ? "active" : ""), d: `M -16 0 C 18 0 39 ${side * 34} 66 ${side * 42}` }, g);
      const bladeEnd = node.selectedOutput === "branch" ? `28 ${side * 17}` : "34 0";
      svgEl("path", { class: "switch-blade", d: `M -16 0 L ${bladeEnd}` }, g);
      svgEl("text", { class: "node-label", x: 8, y: side === 1 ? -30 : 31 }, g).textContent = node.id;
    } else if (node.type === "merge") {
      svgEl("rect", { class: "body", x: -70, y: -50, width: 150, height: 100, rx: 6 }, g);
      svgEl("path", { class: "component-rail", d: "M -58 -32 C -20 -32 -14 0 12 0 L 66 0" }, g);
      svgEl("path", { class: "component-rail", d: "M -58 32 C -20 32 -14 0 12 0" }, g);
      svgEl("text", { class: "node-label", x: 18, y: -27 }, g).textContent = node.id;
    } else if (node.type === "deadend") {
      svgEl("rect", { class: "body", x: -46, y: -27, width: 92, height: 54, rx: 6 }, g);
      svgEl("path", { class: "component-rail", d: "M -48 0 L 8 0" }, g);
      svgEl("path", { class: "deadend-bar", d: "M 13 -18 L 13 18" }, g);
      svgEl("text", { class: "node-label", x: 24, y: -9 }, g).textContent = node.id;
      svgEl("text", { class: "node-sub", x: 24, y: 13 }, g).textContent = "ENDE";
    }
  }

  function sampleTrack(track, ratio) {
    const points = (track.points || []).map(G.cleanPoint);
    if (!points.length) return { x: 0, y: 0, angle: 0 };
    if (points.length === 1) return { x: points[0].x, y: points[0].y, angle: 0 };

    const total = Math.max(1, G.polylineLength(points));
    let remaining = total * Math.max(0, Math.min(1, ratio));
    for (let i = 1; i < points.length; i += 1) {
      const from = points[i - 1];
      const to = points[i];
      const length = Math.max(0.001, G.distance(from, to));
      if (remaining <= length || i === points.length - 1) {
        const t = Math.max(0, Math.min(1, remaining / length));
        return {
          x: G.roundCoord(from.x + (to.x - from.x) * t),
          y: G.roundCoord(from.y + (to.y - from.y) * t),
          angle: Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI
        };
      }
      remaining -= length;
    }
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    return { x: last.x, y: last.y, angle: Math.atan2(last.y - prev.y, last.x - prev.x) * 180 / Math.PI };
  }

  function renderDirectionArrow(track, parent) {
    const p = sampleTrack(track, 0.66);
    svgEl("polygon", {
      class: "track-direction",
      points: "13,0 -9,-8 -5,0 -9,8",
      transform: `translate(${p.x} ${p.y}) rotate(${p.angle})`
    }, parent);
  }

  function renderTracks() {
    clear(dom.tracks);
    app.project.tracks.forEach(track => {
      const selected = app.selected && app.selected.type === "track" && app.selected.id === track.id;
      const route = app.testRun.routeTrackIds.has(track.id);
      const g = svgEl("g", { class: `track ${track.status === "defect" ? "defect" : ""} ${selected ? "selected" : ""} ${route ? "route" : ""}` }, dom.tracks);
      svgEl("path", { class: "track-hit", d: track.path, "data-track-id": track.id }, g);
      svgEl("path", { class: "track-bed", d: track.path }, g);
      svgEl("path", { class: "track-sleeper", d: track.path }, g);
      svgEl("path", { class: "track-line", d: track.path, "data-track-id": track.id }, g);
      if (app.project.settings.showDirections) renderDirectionArrow(track, g);
      if (track.status === "defect") {
        const p = sampleTrack(track, 0.52);
        const br = svgEl("g", { class: "break-symbol", transform: `translate(${p.x} ${p.y}) rotate(-18)` }, g);
        svgEl("line", { x1: -11, y1: -8, x2: 1, y2: 9 }, br);
        svgEl("line", { x1: 5, y1: -9, x2: 15, y2: 8 }, br);
      }
    });
  }

  function renderNodes() {
    clear(dom.nodes);
    app.project.nodes.forEach(drawNode);
  }

  function renderPorts() {
    clear(dom.ports);
    app.project.nodes.forEach(node => {
      G.getPorts(node).forEach(port => {
        const busy = !port.multi && portConnectionCount(node.id, port.id) > 0;
        let compatibility = "";
        if (app.draftTrack) {
          compatibility = canFinishAt(app.draftTrack.from, node.id, port.id) ? "compatible" : "incompatible";
        } else if (app.tool === "track") {
          compatibility = canStartFrom(node.id, port.id) ? "compatible" : "incompatible";
        }
        svgEl("circle", {
          class: `port ${port.role} ${port.type} ${busy ? "busy" : ""} ${compatibility}`,
          cx: port.x,
          cy: port.y,
          r: 8,
          "data-node-id": node.id,
          "data-port-id": port.id,
          "data-port-role": port.role
        }, dom.ports);
      });
    });
  }

  function renderControls() {
    clear(dom.controls);
    const track = selectedTrack();
    if (!track) return;
    const linePoints = track.points.map(point => `${point.x},${point.y}`).join(" ");
    svgEl("polyline", { points: linePoints, fill: "none", stroke: "#315f72", "stroke-width": 1.5, "stroke-dasharray": "6 8" }, dom.controls);
    track.points.forEach((point, index) => {
      const locked = index === 0 || index === track.points.length - 1;
      svgEl("circle", {
        class: `control-point ${locked ? "locked" : ""} ${app.selectedPointIndex === index ? "is-active" : ""}`,
        cx: point.x,
        cy: point.y,
        r: locked ? 6 : 7,
        "data-track-id": track.id,
        "data-point-index": index
      }, dom.controls);
    });
  }

  function renderDraft() {
    clear(dom.draft);
    if (!app.draftTrack) return;
    const points = app.draftTrack.points.concat(app.draftTrack.hover || []);
    if (points.length >= 2) svgEl("path", { class: "draft-path", d: G.makeTrackPath(points) }, dom.draft);
    points.forEach(point => svgEl("circle", { class: "draft-point", cx: point.x, cy: point.y, r: 5 }, dom.draft));
  }

  function renderValidation(result) {
    app.lastValidation = result || app.lastValidation || window.RailValidator.validate(app.project);
    result = app.lastValidation;
    dom.statNodes.textContent = "Knoten " + result.stats.nodes;
    dom.statTracks.textContent = "Gleise " + result.stats.tracks;
    dom.statSwitches.textContent = "Weichen " + result.stats.switches;
    dom.statReachable.textContent = result.stats.goalConnected
      ? "B erreichbar: " + (result.stats.goalReachable ? "ja" : "nein")
      : "Rundkurs: " + (result.stats.loopClosed ? "ja" : "nein");
    dom.statReady.textContent = "Export: " + (result.stats.ready ? "ja" : "nein");
    dom.statReady.className = result.stats.ready ? "ready" : "not-ready";

    clear(dom.issues);
    if (!result.issues.length) {
      const ok = document.createElement("div");
      ok.className = "issue empty";
      ok.textContent = "Keine Fehler oder Warnungen. Das Netz ist exportbereit.";
      dom.issues.appendChild(ok);
    } else {
      result.issues.forEach(item => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "issue " + item.level;
        button.dataset.targetId = item.targetId || "";
        button.dataset.targetType = item.targetType || "";
        button.innerHTML = `<span class="level">${item.level === "error" ? "Fehler" : "Warnung"}</span><span>${escapeHtml(item.message)}</span><span class="target">${escapeHtml(item.targetId || "")}</span>`;
        dom.issues.appendChild(button);
      });
    }
    document.querySelectorAll('[data-action="export"]').forEach(button => {
      button.disabled = !result.stats.ready;
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  }

  function renderProperties() {
    const node = selectedNode();
    const track = selectedTrack();
    if (node) {
      const fixedId = node.type === "start" || node.type === "goal";
      dom.properties.innerHTML = `
        <section class="prop-section">
          <h3>Knoten</h3>
          <label class="field">Kennung
            <input data-prop="node-id" value="${escapeHtml(node.id)}" ${fixedId ? "disabled" : ""}>
          </label>
          <label class="field">Typ
            <input value="${escapeHtml(node.type)}" disabled>
          </label>
          <div class="prop-row">
            <label class="field">X <input data-prop="node-x" type="number" step="1" value="${node.x}"></label>
            <label class="field">Y <input data-prop="node-y" type="number" step="1" value="${node.y}"></label>
          </div>
          <label class="field">Drehung <input data-prop="node-rotation" type="number" min="0" max="359" step="1" value="${node.rotation || 0}"></label>
          ${node.type === "switch" ? `
            <label class="field">Astseite
              <select data-prop="node-branch-side">
                <option value="right" ${node.branchSide !== "left" ? "selected" : ""}>rechts</option>
                <option value="left" ${node.branchSide === "left" ? "selected" : ""}>links</option>
              </select>
            </label>
            <label class="field">Standardstellung
              <select data-prop="node-selected-output">
                <option value="straight" ${node.selectedOutput !== "branch" ? "selected" : ""}>straight</option>
                <option value="branch" ${node.selectedOutput === "branch" ? "selected" : ""}>branch</option>
              </select>
            </label>
            <p class="muted">IN: ${escapeHtml(node.incomingTrackId || "-")}<br>STRAIGHT OUT: ${escapeHtml(node.outgoingTrackStraightId || "-")}<br>BRANCH OUT: ${escapeHtml(node.outgoingTrackBranchId || "-")}</p>
          ` : ""}
          ${node.type === "merge" ? `<p class="muted">Eingaenge: ${escapeHtml((node.incomingTrackIds || []).join(", ") || "-")}<br>Ausgang: ${escapeHtml(node.outgoingTrackId || "-")}<br>Passiv, nicht schaltbar.</p>` : ""}
          <div class="prop-actions">
            <button type="button" data-prop-action="rotate-left">-15 Grad</button>
            <button type="button" data-prop-action="rotate-right">+15 Grad</button>
            <button type="button" data-prop-action="delete" class="danger">Loeschen</button>
          </div>
        </section>`;
    } else if (track) {
      dom.properties.innerHTML = `
        <section class="prop-section">
          <h3>Gleis</h3>
          <label class="field">Kennung <input data-prop="track-id" value="${escapeHtml(track.id)}"></label>
          <label class="field">Status
            <select data-prop="track-status">
              <option value="free" ${track.status !== "defect" ? "selected" : ""}>free</option>
              <option value="defect" ${track.status === "defect" ? "selected" : ""}>defect</option>
            </select>
          </label>
          <p class="muted">Von ${escapeHtml(track.from.nodeId)}.${escapeHtml(track.from.portId)} nach ${escapeHtml(track.to.nodeId)}.${escapeHtml(track.to.portId)}<br>${track.points.length} Stützpunkte · Richtung FROM -> TO</p>
          <label class="field">SVG-Pfad <input value="${escapeHtml(track.path)}" disabled></label>
          <div class="prop-actions">
            <button type="button" data-prop-action="add-point">Zwischenpunkt</button>
            <button type="button" data-prop-action="delete-point">Punkt loeschen</button>
            <button type="button" data-prop-action="smooth-track">Glaetten</button>
            <button type="button" data-prop-action="straighten-track">Begradigen</button>
            <button type="button" data-prop-action="delete" class="danger">Loeschen</button>
          </div>
        </section>`;
    } else {
      dom.properties.innerHTML = `
        <section class="prop-section">
          <h3>Projekt</h3>
          <label class="field">Level-ID <input data-prop="project-id" value="${escapeHtml(app.project.metadata.id)}"></label>
          <label class="field">Name <input data-prop="project-name" value="${escapeHtml(app.project.metadata.name)}"></label>
          <p class="muted">Gleise entstehen ausschliesslich aus typisierten Anschluessen. Der sichtbare SVG-Pfad wird exakt exportiert und in der Testfahrt direkt befahren.</p>
          <div class="prop-actions">
            <button type="button" data-prop-action="validate">Netz pruefen</button>
            <button type="button" data-prop-action="sample">Beispiel laden</button>
            <button type="button" data-prop-action="loop-sample">Kreis-Beispiel</button>
          </div>
        </section>`;
    }
    bindPropertyEvents();
  }

  function bindPropertyEvents() {
    dom.properties.querySelectorAll("[data-prop]").forEach(input => {
      input.addEventListener("change", () => handlePropertyChange(input.dataset.prop, input.value));
    });
    dom.properties.querySelectorAll("[data-prop-action]").forEach(button => {
      button.addEventListener("click", () => handlePropertyAction(button.dataset.propAction));
    });
  }

  function idExists(id, exceptId) {
    return app.project.nodes.concat(app.project.tracks).some(item => item.id === id && item.id !== exceptId);
  }

  function renameNode(oldId, newId) {
    const node = G.getNode(app.project, oldId);
    if (!node || !newId || idExists(newId, oldId)) {
      setStatus("Kennung ist leer oder bereits vergeben.");
      renderProperties();
      return;
    }
    recordHistory();
    node.id = newId;
    app.project.tracks.forEach(track => {
      if (track.from.nodeId === oldId) track.from.nodeId = newId;
      if (track.to.nodeId === oldId) track.to.nodeId = newId;
    });
    app.selected = { type: "node", id: newId };
    markDirty();
    render();
  }

  function renameTrack(oldId, newId) {
    const track = app.project.tracks.find(item => item.id === oldId);
    if (!track || !newId || idExists(newId, oldId)) {
      setStatus("Kennung ist leer oder bereits vergeben.");
      renderProperties();
      return;
    }
    recordHistory();
    track.id = newId;
    app.selected = { type: "track", id: newId };
    markDirty();
    render();
  }

  function handlePropertyChange(prop, value) {
    const node = selectedNode();
    const track = selectedTrack();
    if (prop === "project-id") {
      recordHistory();
      app.project.metadata.id = window.RailExporter.safeId(value);
      markDirty();
      render();
      return;
    }
    if (prop === "project-name") {
      recordHistory();
      app.project.metadata.name = value.trim() || "Level 1";
      markDirty();
      render();
      return;
    }
    if (node) {
      if (prop === "node-id") return renameNode(node.id, value.trim());
      recordHistory();
      if (prop === "node-x") node.x = G.roundCoord(value);
      if (prop === "node-y") node.y = G.roundCoord(value);
      if (prop === "node-rotation") node.rotation = G.normalizeRotation(value);
      if (prop === "node-branch-side") node.branchSide = value === "left" ? "left" : "right";
      if (prop === "node-selected-output") node.selectedOutput = value === "branch" ? "branch" : "straight";
      updateConnectedTracks(node.id);
      markDirty();
      render();
    }
    if (track) {
      if (prop === "track-id") return renameTrack(track.id, value.trim());
      recordHistory();
      if (prop === "track-status") track.status = value === "defect" ? "defect" : "free";
      G.updateTrackGeometry(app.project, track);
      markDirty();
      render();
    }
  }

  function handlePropertyAction(action) {
    const node = selectedNode();
    const track = selectedTrack();
    if (action === "delete") return deleteSelected();
    if (action === "validate") return validateNow();
    if (action === "sample") return loadSample();
    if (action === "loop-sample") return loadLoopSample();
    if (node && (action === "rotate-left" || action === "rotate-right")) {
      recordHistory();
      node.rotation = G.normalizeRotation((node.rotation || 0) + (action === "rotate-right" ? 15 : -15));
      updateConnectedTracks(node.id);
      markDirty();
      render();
    }
    if (track && action === "add-point") {
      recordHistory();
      const insertAt = Math.max(1, Math.floor(track.points.length / 2));
      const a = track.points[insertAt - 1];
      const b = track.points[insertAt];
      track.points.splice(insertAt, 0, G.cleanPoint({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }));
      app.selectedPointIndex = insertAt;
      G.updateTrackGeometry(app.project, track);
      markDirty();
      render();
    }
    if (track && action === "delete-point") {
      if (app.selectedPointIndex === null || app.selectedPointIndex === 0 || app.selectedPointIndex === track.points.length - 1) {
        setStatus("Nur freie Zwischenpunkte koennen geloescht werden.");
        return;
      }
      recordHistory();
      track.points.splice(app.selectedPointIndex, 1);
      app.selectedPointIndex = null;
      G.updateTrackGeometry(app.project, track);
      markDirty();
      render();
    }
    if (track && action === "smooth-track") {
      recordHistory();
      track.path = G.makeTrackPath(track.points);
      markDirty();
      render();
      setStatus("Gleis geglaettet.");
    }
    if (track && action === "straighten-track") {
      recordHistory();
      track.points = [track.points[0], track.points[track.points.length - 1]];
      G.updateTrackGeometry(app.project, track);
      app.selectedPointIndex = null;
      markDirty();
      render();
    }
  }

  function validateNow() {
    app.lastValidation = window.RailValidator.validate(app.project);
    renderValidation(app.lastValidation);
    const result = app.lastValidation;
    setStatus(result.errors.length ? `${result.errors.length} Fehler, ${result.warnings.length} Warnungen.` : "Netz ist exportbereit.");
  }

  function renderSurface() {
    dom.projectLabel.textContent = app.project.metadata.id;
    dom.gridToggle.checked = !!app.project.settings.showGrid;
    dom.arrowToggle.checked = !!app.project.settings.showDirections;
    dom.svg.setAttribute("class", `tool-${app.tool}${app.project.settings.showGrid ? "" : " no-grid"}${app.drag && app.drag.type === "pan" ? " is-panning" : ""}`);
    setViewBox();
    clear(dom.route);
    renderTracks();
    renderDraft();
    renderNodes();
    renderPorts();
    renderControls();
    renderTestTrain();
  }

  function render() {
    normalizeProject(app.project);
    app.lastValidation = window.RailValidator.validate(app.project);
    renderSurface();
    renderValidation(app.lastValidation);
    renderProperties();
    updateButtons();
  }

  function updateButtons() {
    document.querySelectorAll('[data-action="undo"]').forEach(button => { button.disabled = app.history.length === 0; });
    document.querySelectorAll('[data-action="redo"]').forEach(button => { button.disabled = app.future.length === 0; });
  }

  function loadSample() {
    if (app.dirty && !window.confirm("Aktuelles Netz verwerfen und Beispiel laden?")) return;
    recordHistory();
    app.project = createSampleProject();
    app.selected = null;
    app.selectedPointIndex = null;
    app.draftTrack = null;
    resetView();
    markDirty();
    render();
    setStatus("Beispielnetz geladen.");
  }

  function loadLoopSample() {
    if (app.dirty && !window.confirm("Aktuelles Netz verwerfen und Kreis-Beispiel laden?")) return;
    recordHistory();
    app.project = createLoopSampleProject();
    app.selected = null;
    app.selectedPointIndex = null;
    app.draftTrack = null;
    resetView();
    markDirty();
    render();
    setStatus("Kreis-Beispiel geladen: W2 fuehrt oben zurueck in M1.");
  }

  function newProject() {
    if (app.dirty && !window.confirm("Neues Netz erstellen? Ungespeicherte Aenderungen gehen verloren.")) return;
    recordHistory();
    app.project = createEmptyProject();
    app.selected = null;
    app.selectedPointIndex = null;
    app.draftTrack = null;
    resetView();
    markDirty();
    render();
    setStatus("Neues Netz bereit.");
  }

  function saveProject() {
    window.RailExporter.downloadProject(app.project);
    app.dirty = false;
    app.autosavePending = false;
    setStatus("Projektdatei gespeichert.");
  }

  function exportRuntime() {
    const validation = window.RailValidator.validate(app.project);
    app.lastValidation = validation;
    renderValidation(validation);
    if (validation.errors.length) {
      setStatus("Export blockiert: kritische Fehler vorhanden.");
      return;
    }
    window.RailExporter.downloadRuntime(app.project);
    setStatus("Level-JavaScript exportiert.");
  }

  function openFile() {
    if (app.dirty && !window.confirm("Andere Projektdatei laden? Ungespeicherte Aenderungen koennen verloren gehen.")) return;
    dom.fileInput.value = "";
    dom.fileInput.click();
  }

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        recordHistory();
        app.project = window.RailExporter.parseProject(String(reader.result));
        app.selected = null;
        app.selectedPointIndex = null;
        app.draftTrack = null;
        fitView();
        markDirty();
        render();
        setStatus("Projektdatei geladen.");
      } catch (err) {
        setStatus("Datei konnte nicht geladen werden: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  function beginTest() {
    const validation = window.RailValidator.validate(app.project);
    app.lastValidation = validation;
    renderValidation(validation);
    if (validation.errors.length) {
      setStatus("Testfahrt blockiert: erst kritische Fehler beheben.");
      return;
    }
    const start = app.project.nodes.find(node => node.type === "start");
    const first = (validation.connections.outgoing.get(start.id) || [])[0];
    if (!first) {
      setStatus("Kein Startgleis vorhanden.");
      return;
    }
    app.testRun.active = true;
    app.testRun.currentTrackId = first.id;
    app.testRun.distance = 0;
    app.testRun.visited = new Set([first.id]);
    app.testRun.message = "Testfahrt gestartet.";
    computeRoutePreview();
    render();
    setStatus(app.testRun.message);
    tick.last = performance.now();
    scheduleTick();
  }

  function stopTest(message) {
    app.testRun.active = false;
    app.testRun.currentTrackId = null;
    app.testRun.distance = 0;
    app.testRun.visited = new Set();
    app.testRun.routeTrackIds = new Set();
    app.testRun.message = message || "";
    clear(dom.test);
  }

  function currentTrack() {
    return app.project.tracks.find(track => track.id === app.testRun.currentTrackId) || null;
  }

  function pathElementFor(track) {
    const path = svgEl("path", { d: track.path }, dom.route);
    return path;
  }

  function nextTrackAfter(track) {
    const toNode = G.getNode(app.project, track.to.nodeId);
    if (!toNode) return { stop: true, message: "Zielknoten fehlt." };
    if (toNode.type === "start") return { stop: true, success: true, message: "Start A wieder erreicht." };
    if (toNode.type === "goal") return { stop: true, success: true, message: "Ziel B erreicht." };
    if (toNode.type === "deadend") return { stop: true, message: `Sackgasse ${toNode.id} erreicht.` };
    if (toNode.type === "switch") {
      const nextId = toNode.selectedOutput === "branch" ? toNode.outgoingTrackBranchId : toNode.outgoingTrackStraightId;
      return nextId ? { trackId: nextId } : { stop: true, message: `Weiche ${toNode.id} hat keinen aktiven Ausgang.` };
    }
    if (toNode.type === "merge") {
      return toNode.outgoingTrackId ? { trackId: toNode.outgoingTrackId } : { stop: true, message: `Zusammenfuehrung ${toNode.id} hat keinen Ausgang.` };
    }
    return { stop: true, message: "Route endet an unbekanntem Knotentyp." };
  }

  function computeRoutePreview() {
    const route = new Set();
    let track = currentTrack();
    const seen = new Set();
    for (let guard = 0; track && guard < 80; guard += 1) {
      route.add(track.id);
      if (track.status === "defect") break;
      const next = nextTrackAfter(track);
      if (next.stop) break;
      if (seen.has(next.trackId)) {
        route.add(next.trackId);
        break;
      }
      seen.add(next.trackId);
      track = app.project.tracks.find(item => item.id === next.trackId);
    }
    app.testRun.routeTrackIds = route;
  }

  function advanceTest(track) {
    if (track.status === "defect") {
      stopTest(`Defektes Gleis ${track.id}: Testfahrt gestoppt.`);
      render();
      setStatus(app.testRun.message);
      return;
    }
    const next = nextTrackAfter(track);
    if (next.stop) {
      stopTest(next.message);
      render();
      setStatus(next.message);
      return;
    }
    const nextTrack = app.project.tracks.find(item => item.id === next.trackId);
    if (!nextTrack) {
      stopTest("Naechstes Gleis fehlt.");
      render();
      setStatus(app.testRun.message);
      return;
    }
    if (app.testRun.visited.has(nextTrack.id)) {
      stopTest(`Gerichteter Kreis bei ${nextTrack.id}: Testfahrt abgebrochen.`);
      render();
      setStatus(app.testRun.message);
      return;
    }
    app.testRun.currentTrackId = nextTrack.id;
    app.testRun.distance = 0;
    app.testRun.visited.add(nextTrack.id);
    if (nextTrack.status === "defect") {
      stopTest(`Defektes Gleis ${nextTrack.id}: Testfahrt gestoppt.`);
    }
    computeRoutePreview();
    render();
  }

  function stepTest(dt) {
    if (!app.testRun.active) return;
    const track = currentTrack();
    if (!track) return;
    const path = pathElementFor(track);
    let length = 0;
    try { length = path.getTotalLength(); } catch (err) {}
    if (length <= 0) {
      path.remove();
      stopTest("Aktueller Pfad hat keine Laenge.");
      render();
      return;
    }
    const speed = Number(dom.testSpeed.value) || 0;
    app.testRun.distance += speed * dt;
    if (app.testRun.distance >= length) {
      app.testRun.distance = length;
      updateTestPose(path, length);
      path.remove();
      advanceTest(track);
      return;
    }
    updateTestPose(path, app.testRun.distance);
    path.remove();
  }

  function updateTestPose(path, distance) {
    const length = path.getTotalLength();
    const p1 = path.getPointAtLength(Math.min(distance, length));
    const p2 = path.getPointAtLength(Math.min(distance + 2, length));
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
    app.testRun.pose = { x: p1.x, y: p1.y, angle };
    renderTestTrain();
  }

  function renderTestTrain() {
    clear(dom.test);
    if (!app.testRun.active || !app.testRun.pose) return;
    const p = app.testRun.pose;
    const g = svgEl("g", { class: "test-train", transform: `translate(${p.x} ${p.y}) rotate(${p.angle})` }, dom.test);
    svgEl("rect", { class: "train-body", x: -18, y: -9, width: 34, height: 18, rx: 5 }, g);
    svgEl("path", { class: "train-nose", d: "M 14 -9 L 27 0 L 14 9 z" }, g);
  }

  function switchLocked(node) {
    if (!app.testRun.active) return false;
    const track = currentTrack();
    if (!track) return false;
    if (track.to.nodeId === node.id) {
      const path = pathElementFor(track);
      const remaining = path.getTotalLength() - app.testRun.distance;
      path.remove();
      return remaining < 70;
    }
    return track.from.nodeId === node.id && app.testRun.distance < 70;
  }

  function toggleSwitch(node) {
    if (switchLocked(node)) {
      setStatus(`Weiche ${node.id} ist waehrend der Durchfahrt gesperrt.`);
      return;
    }
    recordHistory();
    node.selectedOutput = node.selectedOutput === "branch" ? "straight" : "branch";
    G.applyConnectionFields(app.project);
    computeRoutePreview();
    markDirty();
    render();
    setStatus(`Weiche ${node.id}: ${node.selectedOutput}.`);
  }

  function handlePortPointer(event, nodeId, portId) {
    event.stopPropagation();
    if (app.tool !== "track" && !app.draftTrack) return;
    if (!app.draftTrack) beginTrack(nodeId, portId);
    else finishTrack(nodeId, portId);
  }

  function handleSvgPointerDown(event) {
    const target = event.target;
    const point = svgPoint(event);
    app.pointer = G.cleanPoint(point);

    if (event.button === 1 || (app.spaceDown && event.button === 0)) {
      app.drag = { type: "pan", x: event.clientX, y: event.clientY, view: G.clone(app.view) };
      dom.svg.classList.add("is-panning");
      event.preventDefault();
      return;
    }

    if (target.dataset.portId) {
      handlePortPointer(event, target.dataset.nodeId, target.dataset.portId);
      return;
    }

    if (target.dataset.pointIndex) {
      const trackId = target.dataset.trackId;
      const index = Number(target.dataset.pointIndex);
      app.selected = { type: "track", id: trackId };
      app.selectedPointIndex = index;
      if (index > 0) {
        const track = selectedTrack();
        if (track && index < track.points.length - 1) {
          app.drag = { type: "point", trackId, index, recorded: false };
        }
      }
      render();
      return;
    }

    if (target.dataset.trackId) {
      const trackId = target.dataset.trackId;
      if (app.tool === "delete") return deleteTrack(trackId);
      if (app.tool === "defect") {
        const track = app.project.tracks.find(item => item.id === trackId);
        if (track) {
          recordHistory();
          track.status = track.status === "defect" ? "free" : "defect";
          markDirty();
          selectElement("track", trackId);
          setStatus(`Gleis ${trackId}: ${track.status}.`);
        }
        return;
      }
      selectElement("track", trackId);
      return;
    }

    if (target.closest && target.closest(".node")) {
      const nodeGroup = target.closest(".node");
      const nodeId = nodeGroup.dataset.nodeId;
      const node = G.getNode(app.project, nodeId);
      if (node && app.testRun.active && node.type === "switch") {
        toggleSwitch(node);
        return;
      }
      if (app.tool === "delete") return deleteNode(nodeId);
      selectElement("node", nodeId);
      if ((app.tool === "select" || app.tool === "move") && node) {
        app.drag = { type: "node", nodeId, last: point, recorded: false };
      }
      return;
    }

    if (app.draftTrack) {
      addDraftPoint(point);
      return;
    }

    const placements = { start: "start", goal: "goal", switch: "switch", merge: "merge", deadend: "deadend" };
    if (placements[app.tool]) {
      addNode(placements[app.tool], point);
    } else {
      selectElement(null, null);
    }
  }

  function handleSvgPointerMove(event) {
    const point = svgPoint(event);
    app.pointer = G.cleanPoint(point);
    if (app.draftTrack) {
      app.draftTrack.hover = G.cleanPoint(point);
      renderDraft();
    }
    if (!app.drag) return;
    if (app.drag.type === "pan") {
      const rect = dom.svg.getBoundingClientRect();
      const dx = (event.clientX - app.drag.x) * app.drag.view.width / rect.width;
      const dy = (event.clientY - app.drag.y) * app.drag.view.height / rect.height;
      app.view = {
        x: app.drag.view.x - dx,
        y: app.drag.view.y - dy,
        width: app.drag.view.width,
        height: app.drag.view.height
      };
      setViewBox();
      return;
    }
    if (app.drag.type === "node") {
      const node = G.getNode(app.project, app.drag.nodeId);
      if (!node) return;
      if (!app.drag.recorded) {
        recordHistory();
        app.drag.recorded = true;
      }
      moveNode(node, point.x - app.drag.last.x, point.y - app.drag.last.y);
      app.drag.last = point;
      markDirty();
      renderSurface();
      return;
    }
    if (app.drag.type === "point") {
      const track = app.project.tracks.find(item => item.id === app.drag.trackId);
      if (!track) return;
      if (!app.drag.recorded) {
        recordHistory();
        app.drag.recorded = true;
      }
      track.points[app.drag.index] = G.cleanPoint(point);
      G.updateTrackGeometry(app.project, track);
      markDirty();
      renderSurface();
    }
  }

  function handleSvgPointerUp() {
    const shouldFinalize = app.drag && app.drag.recorded && (app.drag.type === "node" || app.drag.type === "point");
    app.drag = null;
    dom.svg.classList.remove("is-panning");
    if (shouldFinalize) render();
  }

  function handleWheel(event) {
    event.preventDefault();
    const before = svgPoint(event);
    const factor = event.deltaY > 0 ? 1.12 : 0.88;
    const newWidth = Math.max(260, Math.min(4200, app.view.width * factor));
    const newHeight = Math.max(160, Math.min(2600, app.view.height * factor));
    const rx = (before.x - app.view.x) / app.view.width;
    const ry = (before.y - app.view.y) / app.view.height;
    app.view = {
      x: before.x - newWidth * rx,
      y: before.y - newHeight * ry,
      width: newWidth,
      height: newHeight
    };
    setViewBox();
  }

  function action(name) {
    if (name === "new") return newProject();
    if (name === "open") return openFile();
    if (name === "save") return saveProject();
    if (name === "undo") return undo();
    if (name === "redo") return redo();
    if (name === "validate") return validateNow();
    if (name === "test") return app.testRun.active ? (stopTest("Testfahrt beendet."), render(), setStatus("Testfahrt beendet.")) : beginTest();
    if (name === "export") return exportRuntime();
    if (name === "sample") return loadSample();
    if (name === "loopSample") return loadLoopSample();
    if (name === "resetView") return resetView();
    if (name === "fitView") return fitView();
    if (name === "restoreAutosave") return restoreAutosave();
    if (name === "discardAutosave") return discardAutosave();
  }

  function keyboardTargetIsText(event) {
    const tag = event.target && event.target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.target.isContentEditable;
  }

  function handleKeyDown(event) {
    if (event.code === "Space" && !keyboardTargetIsText(event)) {
      app.spaceDown = true;
    }
    if (keyboardTargetIsText(event)) return;
    if (event.code === "Escape") {
      if (app.draftTrack) cancelDraft();
      else if (app.testRun.active) { stopTest("Testfahrt beendet."); render(); }
      else selectElement(null, null);
      event.preventDefault();
    }
    if (event.code === "Backspace" && app.draftTrack) {
      if (app.draftTrack.points.length > 1) app.draftTrack.points.pop();
      render();
      event.preventDefault();
    }
    if (event.code === "Delete") {
      deleteSelected();
      event.preventDefault();
    }
    if (event.ctrlKey && event.code === "KeyZ") {
      if (event.shiftKey) redo();
      else undo();
      event.preventDefault();
    }
    if (event.ctrlKey && event.code === "KeyY") {
      redo();
      event.preventDefault();
    }
    if (event.ctrlKey && event.code === "KeyS") {
      saveProject();
      event.preventDefault();
    }
    const step = event.shiftKey ? 10 : 1;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.code)) {
      const dx = event.code === "ArrowLeft" ? -step : event.code === "ArrowRight" ? step : 0;
      const dy = event.code === "ArrowUp" ? -step : event.code === "ArrowDown" ? step : 0;
      moveSelectedBy(dx, dy);
      event.preventDefault();
    }
  }

  function handleKeyUp(event) {
    if (event.code === "Space") app.spaceDown = false;
  }

  function restoreAutosave() {
    const text = storageGet(AUTOSAVE_KEY);
    if (!text) return;
    try {
      app.project = window.RailExporter.parseProject(text);
      app.selected = null;
      app.selectedPointIndex = null;
      dom.restoreNotice.classList.add("hidden");
      fitView();
      render();
      setStatus("Autosave wiederhergestellt.");
    } catch (err) {
      setStatus("Autosave konnte nicht gelesen werden.");
    }
  }

  function discardAutosave() {
    storageRemove(AUTOSAVE_KEY);
    dom.restoreNotice.classList.add("hidden");
    setStatus("Autosave verworfen.");
  }

  function installEvents() {
    document.querySelectorAll("[data-tool]").forEach(button => {
      button.addEventListener("click", () => setTool(button.dataset.tool));
    });
    document.querySelectorAll("[data-action]").forEach(button => {
      button.addEventListener("click", () => action(button.dataset.action));
    });
    dom.fileInput.addEventListener("change", () => handleFile(dom.fileInput.files[0]));
    dom.gridToggle.addEventListener("change", () => {
      recordHistory();
      app.project.settings.showGrid = dom.gridToggle.checked;
      markDirty();
      render();
    });
    dom.arrowToggle.addEventListener("change", () => {
      recordHistory();
      app.project.settings.showDirections = dom.arrowToggle.checked;
      markDirty();
      render();
    });
    dom.issues.addEventListener("click", event => {
      const button = event.target.closest(".issue");
      if (!button || !button.dataset.targetId) return;
      selectElement(button.dataset.targetType, button.dataset.targetId);
      focusElement(button.dataset.targetType, button.dataset.targetId);
    });
    dom.svg.addEventListener("pointerdown", handleSvgPointerDown);
    dom.svg.addEventListener("pointermove", handleSvgPointerMove);
    dom.svg.addEventListener("pointerup", handleSvgPointerUp);
    dom.svg.addEventListener("pointerleave", handleSvgPointerUp);
    dom.svg.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
  }

  function scheduleTick() {
    if (!app.animationFrame) app.animationFrame = requestAnimationFrame(tick);
  }

  function tick() {
    app.animationFrame = 0;
    if (!app.testRun.active) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - (tick.last || now)) / 1000);
    tick.last = now;
    stepTest(dt);
    scheduleTick();
  }

  function boot() {
    normalizeProject(app.project);
    installEvents();
    resetView();
    render();
    if (AUTOSAVE_ENABLED && storageGet(AUTOSAVE_KEY)) dom.restoreNotice.classList.remove("hidden");
    setStatus("Bereit. Beispielnetz ist geladen.");
    if (AUTOSAVE_ENABLED) setInterval(autosave, 2500);
  }

  window.TrackEditor = {
    getProject: () => G.clone(app.project),
    validate: () => window.RailValidator.validate(app.project),
    runtimeJs: () => window.RailExporter.runtimeJs(app.project),
    startTest: beginTest,
    stopTest: () => { stopTest("Testfahrt beendet."); render(); },
    loadSample,
    loadLoopSample,
    newProject,
    setTool,
    getTestState: () => ({
      active: app.testRun.active,
      currentTrackId: app.testRun.currentTrackId,
      distance: app.testRun.distance,
      message: app.testRun.message,
      routeTrackIds: Array.from(app.testRun.routeTrackIds)
    })
  };

  boot();
})();
