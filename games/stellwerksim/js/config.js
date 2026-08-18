(function () {
  "use strict";

  const wagon = (color) => Object.freeze({ type: "wagon", color, routeLength: 1.28 });
  const locomotive = (color) => Object.freeze({ type: "locomotive", color, routeLength: 0.76 });

  window.StellwerkConfig = Object.freeze({
    debug: false,
    initialSpeedLevel: 1,
    initialHeadPosition: 3.45,
    initialGameMode: "free",
    stationDwellSeconds: 2,
    passengerCount: 6,
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
      Object.freeze({ id: "sbb", name: "SBB", color: "#3e84d8", siding: "siding-sbb", vehicles: Object.freeze([locomotive("#d6453d"), wagon("#3e84d8"), wagon("#3e84d8"), wagon("#3e84d8")]) }),
      Object.freeze({ id: "bls", name: "bls", color: "#62df59", siding: "siding-bls", vehicles: Object.freeze([wagon("#62df59"), wagon("#62df59"), wagon("#62df59"), wagon("#62df59")]) }),
      Object.freeze({ id: "cargo", name: "cargo", color: "#7b5638", siding: "siding-cargo", vehicles: Object.freeze([locomotive("#df8432"), wagon("#7b5638"), wagon("#7b5638"), wagon("#7b5638"), wagon("#7b5638"), wagon("#7b5638"), wagon("#7b5638")]) }),
      Object.freeze({ id: "express", name: "express", color: "#438ee5", siding: "siding-express", vehicles: Object.freeze([wagon("#438ee5"), wagon("#438ee5"), wagon("#438ee5"), wagon("#438ee5"), wagon("#438ee5")]) }),
      Object.freeze({ id: "dampfzug", name: "dampfzug", color: "#315d45", siding: "siding-dampfzug", vehicles: Object.freeze([locomotive("#9aa09c"), wagon("#315d45"), wagon("#315d45")]) }),
      Object.freeze({ id: "regio", name: "regio", color: "#ce5752", siding: "siding-regio", vehicles: Object.freeze([wagon("#ce5752"), wagon("#ce5752"), wagon("#ce5752")]) })
    ]),
    stations: Object.freeze([
      Object.freeze({ id: "loksart", name: "LOKSART", color: "#d75a5a", routeId: "outer", point: Object.freeze({ x: 500, y: 70 }), labelOffset: Object.freeze({ x: 132, y: -54 }), queueOffset: Object.freeze({ x: 26, y: 34 }) }),
      Object.freeze({ id: "vagon", name: "VAGON", color: "#4c9aff", routeId: "outer", point: Object.freeze({ x: 500, y: 1530 }), labelOffset: Object.freeze({ x: -132, y: -54 }), queueOffset: Object.freeze({ x: -74, y: 34 }) }),
      Object.freeze({ id: "littsdingen", name: "Littsdingen", color: "#d79a35", routeId: "mountain", point: Object.freeze({ x: 57, y: 1240 }), labelOffset: Object.freeze({ x: 0, y: 45 }), queueOffset: Object.freeze({ x: -72, y: -43 }) })
    ]),
    switchDefaults: Object.freeze({
      W1: "straight", W2: "straight", W3: "straight", W4: "straight",
      W5: "straight", W6: "straight", W7: "straight", W8: "straight",
      W9: "straight", W10: "straight", W11: "straight", W12: "straight",
      W13: "straight", W14: "straight", W15: "straight"
    })
  });
}());
