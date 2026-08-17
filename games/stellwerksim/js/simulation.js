(function () {
  "use strict";

  class Simulation {
    constructor(network, config) {
      this.network = network;
      this.config = config;
      this.trains = [];
      this.crashed = false;
      this.gameMode = config.initialGameMode;
      this.passengerService = null;
      this.onStateChange = null;
      this.onCrash = null;
      this.onMessage = null;
      this.resetSimulation();
    }

    resetSimulation() {
      this.crashed = false;
      this.network.resetSwitches();
      this.network.trainLayer.replaceChildren();
      this.trains = this.config.trainDefinitions.map((definition) => {
        const initialRoute = this.network.getSidingStartRoute(definition.siding, 12);
        const train = new window.Stellwerk.Train(definition, this.config, initialRoute);
        train.mount(this.network.trainLayer);
        return train;
      });
      this.passengerService = this.gameMode === "passengers"
        ? new window.Stellwerk.PassengerService(this.network, this.config)
        : null;
      this.network.setStationsVisible(this.gameMode === "passengers");
      this.network.renderPassengerQueues(this.passengerService ? this.passengerService.passengers : []);
      this.rebuildOccupancy();
      this.render();
      this.emitMessage(this.gameMode === "passengers"
        ? "Personenverkehr: Reisende warten an den Bahnhoefen."
        : "Freier Betrieb: Alle sechs Zuege stehen bereit.");
      this.emitStateChange();
    }

    setGameMode(mode) {
      if (mode !== "free" && mode !== "passengers") return;
      if (this.gameMode === mode && !this.crashed) return;
      this.gameMode = mode;
      this.resetSimulation();
    }

    getTrain(trainId) {
      return this.trains.find((train) => train.id === trainId);
    }

    setTrainDirection(trainId, direction) {
      if (this.crashed) return;
      const train = this.getTrain(trainId);
      if (!train || train.direction === direction) return;
      train.setDirection(direction);
      const label = direction === "forward" ? "vorwaerts" : direction === "reverse" ? "rueckwaerts" : "angehalten";
      this.emitMessage(`${train.name} ${label}.`);
      this.emitStateChange();
    }

    setTrainSpeed(trainId, level) {
      if (this.crashed) return;
      const train = this.getTrain(trainId);
      if (!train) return;
      train.setSpeedLevel(level);
      this.emitStateChange();
    }

    toggleSwitch(switchId) {
      if (this.crashed) return;
      const switchData = this.network.switches.get(switchId);
      if (!switchData) return;
      if (switchData.locked) {
        this.emitMessage(`${switchId} ist wegen Gleisbelegung gesperrt.`);
        return;
      }
      if (this.network.toggleSwitch(switchId)) {
        const state = this.network.switches.get(switchId).state === "straight" ? "gerade" : "abzweigend";
        this.emitMessage(`${switchId} auf ${state} gestellt.`);
      }
    }

    update(deltaSeconds) {
      if (this.crashed) return;
      let remaining = Math.min(this.config.maxFrameDelta, Math.max(0, deltaSeconds));
      while (remaining > 0 && !this.crashed) {
        const maxSpeed = Math.max(...this.trains
          .filter((train) => train.direction !== "stopped")
          .map((train) => this.config.speedLevels[train.speedLevel]), 0);
        const step = maxSpeed > 0
          ? Math.min(remaining, this.config.maxSubstepDistance / maxSpeed)
          : remaining;

        this.trains.forEach((train) => this.advanceTrain(train, step));
        const occupancy = this.rebuildOccupancy();
        this.updateSwitchLocks(occupancy);
        const collision = this.findCollision(occupancy);
        if (collision) this.crash(collision);
        if (!this.crashed && this.passengerService) {
          const passengerUpdate = this.passengerService.update(this.trains, step);
          if (passengerUpdate.changed) {
            this.network.renderPassengerQueues(this.passengerService.passengers);
            this.emitStateChange();
          }
          if (passengerUpdate.message) this.emitMessage(passengerUpdate.message);
        }
        remaining -= step;
      }
      this.render();
    }

    advanceTrain(train, deltaSeconds) {
      if (train.direction === "stopped") return;
      let remainingDistance = this.config.speedLevels[train.speedLevel] * deltaSeconds;

      let guard = 0;
      while (remainingDistance > 0.00001 && guard < 30) {
        guard += 1;
        const available = train.route.length - train.position - 0.001;
        if (remainingDistance < available) {
          train.position += remainingDistance;
          break;
        }

        train.position = train.route.length - 0.001;
        remainingDistance -= Math.max(0, available);
        const nextStep = this.network.getTraversalSuccessor(train.route[train.route.length - 1]);
        if (!nextStep) {
          train.setDirection("stopped");
          this.emitMessage(`${train.name} steht am Prellbock.`);
          this.emitStateChange();
          break;
        }
        train.route.push(nextStep);
      }
    }

    rebuildOccupancy() {
      const occupancy = new Map();
      this.trains.forEach((train) => {
        train.getOccupiedSegmentIds(this.network).forEach((segmentId) => {
          if (!occupancy.has(segmentId)) occupancy.set(segmentId, new Set());
          occupancy.get(segmentId).add(train.id);
        });
      });
      this.network.setOccupancy(occupancy);
      return occupancy;
    }

    updateSwitchLocks(occupancy) {
      this.network.switches.forEach((switchData) => {
        const locked = switchData.protectedSegmentIds.some((segmentId) => {
          const occupants = occupancy.get(segmentId);
          return occupants && occupants.size > 0;
        });
        this.network.setSwitchLocked(switchData.id, locked);
      });
    }

    findCollision(occupancy) {
      for (const occupants of occupancy.values()) {
        if (occupants.size > 1) return [...occupants].slice(0, 2);
      }

      for (let first = 0; first < this.trains.length; first += 1) {
        const firstPoses = this.trains[first].getCarPoses(this.network);
        for (let second = first + 1; second < this.trains.length; second += 1) {
          const secondPoses = this.trains[second].getCarPoses(this.network);
          for (const a of firstPoses) {
            for (const b of secondPoses) {
              if (Math.hypot(a.x - b.x, a.y - b.y) < 12) {
                return [this.trains[first].id, this.trains[second].id];
              }
            }
          }
        }
      }
      return null;
    }

    crash(trainIds) {
      if (this.crashed) return;
      this.crashed = true;
      this.trains.forEach((train) => train.setDirection("stopped"));
      this.network.switches.forEach((switchData) => this.network.setSwitchLocked(switchData.id, true));
      const involved = trainIds.map((id) => this.getTrain(id).name);
      this.emitMessage(`Kollision: ${involved.join(" und ")}.`);
      this.emitStateChange();
      if (typeof this.onCrash === "function") this.onCrash(involved);
    }

    render() {
      this.trains.forEach((train) => train.render(this.network));
    }

    getPassengerSummary() {
      return this.passengerService ? this.passengerService.getSummary() : null;
    }

    getTrainPassengerStatus(train) {
      return this.passengerService ? this.passengerService.getTrainStatus(train) : null;
    }

    emitStateChange() {
      if (typeof this.onStateChange === "function") this.onStateChange();
    }

    emitMessage(message) {
      if (typeof this.onMessage === "function") this.onMessage(message);
    }
  }

  window.Stellwerk = window.Stellwerk || {};
  window.Stellwerk.Simulation = Simulation;
}());
