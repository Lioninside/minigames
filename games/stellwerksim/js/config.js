(function () {
  "use strict";

  window.StellwerkConfig = Object.freeze({
    debug: false,
    trainLength: 4,
    carriageSpacing: 1,
    initialSpeedLevel: 1,
    initialHeadPosition: 3.45,
    initialGameMode: "free",
    stationDwellSeconds: 2,
    passengerCount: 16,
    maxFrameDelta: 0.1,
    maxSubstepDistance: 0.16,
    speedLevels: Object.freeze({
      1: 0.35,
      2: 1.26,
      3: 1.95,
      4: 2.78,
      5: 3.72
    }),
    trainDefinitions: Object.freeze([
      { id: "alpha", name: "Alpha", color: "#4c9aff", siding: "siding-alpha" },
      { id: "bravo", name: "Bravo", color: "#68c678", siding: "siding-bravo" },
      { id: "charlie", name: "Charlie", color: "#f0c95a", siding: "siding-charlie" },
      { id: "delta", name: "Delta", color: "#bf7be5", siding: "siding-delta" },
      { id: "echo", name: "Echo", color: "#56cad0", siding: "siding-echo" }
    ]),
    stations: Object.freeze([
      { id: "red", name: "Rot", color: "#d75a5a", routeId: "outer", point: Object.freeze({ x: 400, y: 48 }), labelOffset: Object.freeze({ x: 24, y: -22 }), queueOffset: Object.freeze({ x: 28, y: 8 }) },
      { id: "blue", name: "Blau", color: "#4c9aff", routeId: "middle", point: Object.freeze({ x: 598, y: 560 }), labelOffset: Object.freeze({ x: 0, y: 28 }), queueOffset: Object.freeze({ x: -6, y: 38 }) },
      { id: "yellow", name: "Gelb", color: "#e0b83d", routeId: "inner", point: Object.freeze({ x: 400, y: 1058 }), labelOffset: Object.freeze({ x: -24, y: -22 }), queueOffset: Object.freeze({ x: -34, y: 8 }) },
      { id: "green", name: "Gruen", color: "#58ae6c", routeId: "outer", point: Object.freeze({ x: 144, y: 600 }), labelOffset: Object.freeze({ x: 0, y: -26 }), queueOffset: Object.freeze({ x: 4, y: -38 }) }
    ]),
    switchDefaults: Object.freeze({
      W1: "straight",
      W2: "straight",
      W3: "straight",
      W4: "straight",
      W5: "straight",
      W6: "straight",
      W7: "straight",
      W8: "straight"
    })
  });
}());
