(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const config = window.StellwerkConfig;
    const svg = document.getElementById("trackPlan");
    const network = new window.Stellwerk.TrackNetwork(svg, config);
    network.build();

    const simulation = new window.Stellwerk.Simulation(network, config);
    const ui = new window.Stellwerk.StellwerkUI(simulation);

    network.onSwitchToggleRequest = (switchId) => simulation.toggleSwitch(switchId);
    simulation.onStateChange = () => ui.update();
    simulation.onMessage = (message) => ui.showMessage(message);
    simulation.onCrash = (trainNames) => ui.showCrash(trainNames);
    simulation.resetSimulation();
    window.StellwerkApp = { network, simulation, ui };

    let previousTime = performance.now();
    function frame(now) {
      simulation.update((now - previousTime) / 1000);
      previousTime = now;
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  });
}());
