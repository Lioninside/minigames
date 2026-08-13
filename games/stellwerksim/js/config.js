(function () {
  "use strict";

  window.StellwerkConfig = Object.freeze({
    debug: false,
    trainLength: 4,
    carriageSpacing: 1,
    initialSpeedLevel: 1,
    initialHeadPosition: 3.45,
    maxFrameDelta: 0.1,
    maxSubstepDistance: 0.16,
    speedLevels: Object.freeze({
      1: 0.72,
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
