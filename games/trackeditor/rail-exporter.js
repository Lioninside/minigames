(function () {
  "use strict";

  function safeId(value) {
    return String(value || "level01").trim().replace(/[^a-zA-Z0-9_-]+/g, "-") || "level01";
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function prepareProject(project) {
    const copy = window.RailGeometry.clone(project);
    copy.schemaVersion = 1;
    copy.metadata = copy.metadata || {};
    copy.metadata.id = safeId(copy.metadata.id || "level01");
    copy.metadata.name = copy.metadata.name || "Level 1";
    copy.metadata.updatedAt = nowIso();
    copy.viewBox = copy.viewBox || window.RailGeometry.VIEW_BOX;
    window.RailGeometry.updateAllTrackGeometry(copy);
    window.RailGeometry.applyConnectionFields(copy);
    return copy;
  }

  function projectJson(project) {
    return JSON.stringify(prepareProject(project), null, 2);
  }

  function parseProject(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") throw new Error("Die Datei enthaelt kein Projektobjekt.");
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.tracks)) {
      throw new Error("Die Projektdatei braucht nodes und tracks.");
    }
    parsed.schemaVersion = parsed.schemaVersion || 1;
    parsed.metadata = parsed.metadata || { id: "level01", name: "Level 1" };
    parsed.viewBox = parsed.viewBox || window.RailGeometry.VIEW_BOX;
    parsed.settings = parsed.settings || { showGrid: true, showDirections: true };
    window.RailGeometry.updateAllTrackGeometry(parsed);
    window.RailGeometry.applyConnectionFields(parsed);
    return parsed;
  }

  function runtimeLevel(project) {
    const prepared = prepareProject(project);
    const validation = window.RailValidator.validate(prepared);
    if (validation.errors.length) {
      const error = new Error("Das Netz enthaelt kritische Fehler.");
      error.validation = validation;
      throw error;
    }

    const start = prepared.nodes.find(node => node.type === "start");
    const goal = prepared.nodes.find(node => node.type === "goal");

    const nodes = prepared.nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: { x: node.x, y: node.y },
      rotation: node.rotation || 0,
      branchSide: node.branchSide || undefined,
      selectedOutput: node.type === "switch" ? (node.selectedOutput || "straight") : undefined,
      ports: window.RailGeometry.getPorts(node).map(port => ({
        id: port.id,
        type: port.type,
        role: port.role,
        x: port.x,
        y: port.y
      }))
    }));

    const tracks = prepared.tracks.map(track => ({
      id: track.id,
      fromNodeId: track.from.nodeId,
      fromPortId: track.from.portId,
      toNodeId: track.to.nodeId,
      toPortId: track.to.portId,
      path: track.path,
      status: track.status || "free"
    }));

    const switches = prepared.nodes
      .filter(node => node.type === "switch")
      .map(node => ({
        id: node.id,
        incomingTrackId: node.incomingTrackId || null,
        outgoingTrackStraightId: node.outgoingTrackStraightId || null,
        outgoingTrackBranchId: node.outgoingTrackBranchId || null,
        selectedOutput: node.selectedOutput || "straight",
        position: { x: node.x, y: node.y },
        rotation: node.rotation || 0,
        branchSide: node.branchSide || "right"
      }));

    const merges = prepared.nodes
      .filter(node => node.type === "merge")
      .map(node => ({
        id: node.id,
        incomingTrackIds: node.incomingTrackIds || [],
        outgoingTrackId: node.outgoingTrackId || null,
        position: { x: node.x, y: node.y },
        rotation: node.rotation || 0
      }));

    const deadends = prepared.nodes
      .filter(node => node.type === "deadend")
      .map(node => ({
        id: node.id,
        incomingTrackId: (validation.connections.incoming.get(node.id) || [])[0]?.id || null,
        position: { x: node.x, y: node.y },
        rotation: node.rotation || 0
      }));

    return {
      schemaVersion: 1,
      id: safeId(prepared.metadata.id),
      name: prepared.metadata.name || "Level 1",
      viewBox: {
        width: prepared.viewBox.width,
        height: prepared.viewBox.height
      },
      startNodeId: start ? start.id : null,
      goalNodeId: goal ? goal.id : null,
      nodes,
      tracks,
      switches,
      merges,
      deadends
    };
  }

  function runtimeJs(project) {
    const level = runtimeLevel(project);
    const id = safeId(level.id);
    return [
      "window.RAIL_LEVELS = window.RAIL_LEVELS || {};",
      "",
      `window.RAIL_LEVELS[${JSON.stringify(id)}] = ${JSON.stringify(level, null, 2)};`,
      ""
    ].join("\n");
  }

  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadProject(project) {
    const prepared = prepareProject(project);
    const id = safeId(prepared.metadata.id);
    downloadText(`${id}.rail.json`, JSON.stringify(prepared, null, 2), "application/json;charset=utf-8");
  }

  function downloadRuntime(project) {
    const prepared = prepareProject(project);
    const id = safeId(prepared.metadata.id);
    downloadText(`${id}.js`, runtimeJs(prepared), "text/javascript;charset=utf-8");
  }

  window.RailExporter = {
    safeId,
    prepareProject,
    projectJson,
    parseProject,
    runtimeLevel,
    runtimeJs,
    downloadText,
    downloadProject,
    downloadRuntime
  };
})();
