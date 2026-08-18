(function () {
  "use strict";

  function shuffled(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }
    return copy;
  }

  class PassengerService {
    constructor(network, config) {
      this.network = network;
      this.config = config;
      this.passengers = [];
      this.operations = new Map();
      this.completed = false;
      this.createPassengers();
    }

    createPassengers() {
      const destinations = [];
      while (destinations.length < this.config.passengerCount) {
        destinations.push(...shuffled(this.config.stations));
      }
      this.passengers = destinations.slice(0, this.config.passengerCount).map((destination, index) => {
        const sourceChoices = this.config.stations.filter((station) => station.id !== destination.id);
        const source = sourceChoices[Math.floor(Math.random() * sourceChoices.length)];
        return {
          id: `passenger-${index + 1}`,
          color: destination.color,
          destinationStationId: destination.id,
          sourceStationId: source.id,
          status: "waiting",
          trainId: null
        };
      });
    }

    update(trains, deltaSeconds) {
      let changed = false;
      let message = null;

      trains.forEach((train) => {
        const station = train.direction === "stopped"
          ? this.network.getStationAtRoutePosition(train.route, train.position)
          : null;
        const operation = this.operations.get(train.id);

        if (!station) {
          if (operation) {
            this.operations.delete(train.id);
            changed = true;
          }
          return;
        }

        if (operation && operation.stationId !== station.id) {
          this.operations.delete(train.id);
          changed = true;
        }

        let activeOperation = this.operations.get(train.id);
        if (!activeOperation) {
          activeOperation = this.createOperation(train, station);
          if (!activeOperation) return;
          this.operations.set(train.id, activeOperation);
          message = `${train.name}: ${activeOperation.label} bei ${station.name}.`;
          changed = true;
        }

        activeOperation.elapsed += deltaSeconds;
        if (activeOperation.elapsed + 0.00001 < this.config.stationDwellSeconds) return;

        this.completeOperation(train, activeOperation);
        this.operations.delete(train.id);
        changed = true;
        message = `${train.name}: ${activeOperation.completeLabel}.`;
      });

      const wasCompleted = this.completed;
      this.completed = this.passengers.length > 0 && this.passengers.every((passenger) => passenger.status === "delivered");
      if (this.completed && !wasCompleted) {
        message = "Geschafft: Alle Personen sind an ihrem Zielbahnhof.";
      }

      return { changed, message };
    }

    createOperation(train, station) {
      const onboard = train.passengerIds.map((id) => this.passengers.find((passenger) => passenger.id === id));
      const unload = onboard.find((passenger) => passenger && passenger.destinationStationId === station.id);
      if (unload) {
        return {
          type: "unload",
          passengerId: unload.id,
          stationId: station.id,
          elapsed: 0,
          label: "Aussteigen",
          completeLabel: "Person ausgestiegen"
        };
      }

      const pickup = this.passengers.find((passenger) => (
        passenger.status === "waiting"
        && passenger.sourceStationId === station.id
        && (!train.cargoColor || train.cargoColor === passenger.color)
      ));
      if (!pickup) return null;
      return {
        type: "board",
        passengerId: pickup.id,
        stationId: station.id,
        elapsed: 0,
        label: "Einsteigen",
        completeLabel: "Person eingestiegen"
      };
    }

    completeOperation(train, operation) {
      const passenger = this.passengers.find((entry) => entry.id === operation.passengerId);
      if (!passenger) return;

      if (operation.type === "board") {
        passenger.status = "onboard";
        passenger.trainId = train.id;
        train.passengerIds.push(passenger.id);
        train.cargoColor = passenger.color;
        return;
      }

      passenger.status = "delivered";
      passenger.trainId = null;
      train.passengerIds = train.passengerIds.filter((id) => id !== passenger.id);
      if (!train.passengerIds.length) train.cargoColor = null;
    }

    getTrainStatus(train) {
      const operation = this.operations.get(train.id);
      const cargoColor = train.cargoColor;
      const cargoCount = train.passengerIds.length;
      return {
        cargoColor,
        cargoCount,
        cargoLabel: cargoCount ? `${cargoCount}x ${this.getStationNameForColor(cargoColor)}` : "Leer",
        serviceLabel: operation ? operation.label : ""
      };
    }

    getSummary() {
      const delivered = this.passengers.filter((passenger) => passenger.status === "delivered").length;
      return { delivered, total: this.passengers.length, completed: this.completed };
    }

    getStationNameForColor(color) {
      const station = this.config.stations.find((entry) => entry.color === color);
      return station ? station.name : "Unbekannt";
    }
  }

  window.Stellwerk = window.Stellwerk || {};
  window.Stellwerk.PassengerService = PassengerService;
}());
