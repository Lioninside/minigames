(function () {
  "use strict";

  const STATE_LABELS = Object.freeze({
    forward: "Vorwaerts",
    stopped: "Halt",
    reverse: "Rueckwaerts"
  });

  class StellwerkUI {
    constructor(simulation) {
      this.simulation = simulation;
      this.controlsRoot = document.getElementById("trainControls");
      this.message = document.getElementById("systemMessage");
      this.systemStatus = this.message.closest(".system-status");
      this.crashOverlay = document.getElementById("crashOverlay");
      this.crashDetail = document.getElementById("crashDetail");
      this.resetButton = document.getElementById("resetButton");
      this.restartButton = document.getElementById("restartButton");
      this.cards = new Map();
      this.createTrainControls();
      this.bindResetButtons();
    }

    createTrainControls() {
      this.controlsRoot.replaceChildren();
      this.simulation.trains.forEach((train) => {
        const card = document.createElement("article");
        card.className = "train-card";
        card.innerHTML = `
          <div class="train-card-header">
            <div>
              <div class="train-name-row">
                <span class="train-swatch" aria-hidden="true"></span>
                <h3></h3>
              </div>
              <p class="train-state"></p>
            </div>
            <span class="speed-readout"></span>
          </div>
          <div class="speed-control">
            <label>Geschwindigkeit</label>
            <input type="range" min="1" max="5" step="1" aria-label="Geschwindigkeit">
          </div>
          <div class="drive-buttons" role="group" aria-label="Fahrtrichtung">
            <button type="button" class="reverse" aria-label="Rueckwaerts" title="Rueckwaerts">&#8592;</button>
            <button type="button" class="stopped" aria-label="Stopp" title="Stopp">&#9632;</button>
            <button type="button" class="forward" aria-label="Vorwaerts" title="Vorwaerts">&#8594;</button>
          </div>
        `;
        card.querySelector(".train-swatch").style.background = train.color;
        card.querySelector("h3").textContent = train.name;
        const range = card.querySelector("input");
        const buttons = {
          reverse: card.querySelector(".reverse"),
          stopped: card.querySelector(".stopped"),
          forward: card.querySelector(".forward")
        };

        range.addEventListener("input", () => this.simulation.setTrainSpeed(train.id, range.value));
        Object.entries(buttons).forEach(([direction, button]) => {
          button.addEventListener("click", () => this.simulation.setTrainDirection(train.id, direction));
        });

        this.cards.set(train.id, {
          card,
          range,
          state: card.querySelector(".train-state"),
          speed: card.querySelector(".speed-readout"),
          buttons
        });
        this.controlsRoot.append(card);
      });
    }

    bindResetButtons() {
      const reset = () => {
        this.hideCrash();
        this.simulation.resetSimulation();
      };
      this.resetButton.addEventListener("click", reset);
      this.restartButton.addEventListener("click", reset);
    }

    update() {
      const locked = this.simulation.crashed;
      this.simulation.trains.forEach((train) => {
        const card = this.cards.get(train.id);
        if (!card) return;
        card.range.value = String(train.speedLevel);
        card.range.disabled = locked;
        card.speed.textContent = `Stufe ${train.speedLevel}`;
        card.state.textContent = STATE_LABELS[train.direction];
        Object.entries(card.buttons).forEach(([direction, button]) => {
          button.disabled = locked;
          button.classList.toggle("is-active", train.direction === direction);
        });
      });
      this.systemStatus.classList.toggle("is-crashed", locked);
    }

    showMessage(message) {
      this.message.textContent = message;
    }

    showCrash(trainNames) {
      this.crashDetail.textContent = `${trainNames.join(" und ")} kollidieren. Die Simulation ist eingefroren.`;
      this.crashOverlay.hidden = false;
      this.update();
    }

    hideCrash() {
      this.crashOverlay.hidden = true;
      this.systemStatus.classList.remove("is-crashed");
    }
  }

  window.Stellwerk = window.Stellwerk || {};
  window.Stellwerk.StellwerkUI = StellwerkUI;
}());
