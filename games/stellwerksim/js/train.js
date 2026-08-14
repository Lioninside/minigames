(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  function svgElement(name, attributes) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes || {}).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  class Train {
    constructor(definition, config, initialRoute) {
      this.id = definition.id;
      this.name = definition.name;
      this.color = definition.color;
      this.siding = definition.siding;
      this.config = config;
      this.route = initialRoute.map((segmentId) => ({ segmentId, direction: 1 }));
      this.position = config.initialHeadPosition;
      this.direction = "stopped";
      this.pathDirection = "forward";
      this.speedLevel = config.initialSpeedLevel;
      this.passengerIds = [];
      this.cargoColor = null;
      this.group = null;
      this.cars = [];
      this.nameLabel = null;
      this.passengerIndicator = null;
      this.passengerCount = null;
      this.passengerVisualKey = null;
    }

    mount(parent) {
      this.group = svgElement("g", { "data-train-id": this.id });
      for (let index = 0; index < this.config.trainLength; index += 1) {
        const car = svgElement("rect", {
          x: -9,
          y: -5,
          width: 18,
          height: 10,
          fill: this.color,
          class: "train-car"
        });
        this.cars.push(car);
        this.group.append(car);
      }
      this.nameLabel = svgElement("text", { class: "train-name", "text-anchor": "middle" });
      this.nameLabel.textContent = this.name;
      this.passengerIndicator = svgElement("g", { class: "train-passenger-indicator", visibility: "hidden" });
      const passengerHead = svgElement("circle", { cx: -6, cy: -3, r: 2.6, class: "train-passenger-head" });
      const passengerBody = svgElement("rect", { x: -9.2, y: 0, width: 6.4, height: 5.2, rx: 1.2, class: "train-passenger-body" });
      this.passengerCount = svgElement("text", { x: 0, y: 4, class: "train-passenger-count" });
      this.passengerIndicator.append(passengerHead, passengerBody, this.passengerCount);
      this.group.append(this.nameLabel, this.passengerIndicator);
      parent.append(this.group);
    }

    setDirection(direction) {
      if (direction !== "stopped" && direction !== this.pathDirection) {
        this.reversePath();
        this.pathDirection = direction;
      }
      this.direction = direction;
    }

    reversePath() {
      const routeLength = this.route.length;
      this.route = this.route
        .slice()
        .reverse()
        .map((step) => ({ segmentId: step.segmentId, direction: -step.direction }));
      this.position = routeLength - this.position + this.config.trainLength - 1;

      const requiredSegments = Math.max(this.config.trainLength, Math.floor(this.position) + 1);
      this.route.length = Math.min(this.route.length, requiredSegments);
    }

    setSpeedLevel(level) {
      this.speedLevel = Number(level);
    }

    getCarRoutePositions() {
      const positions = [];
      for (let index = 0; index < this.config.trainLength; index += 1) {
        positions.push(this.position - index * this.config.carriageSpacing);
      }
      return positions;
    }

    getOccupiedSegmentIds(network) {
      const occupied = new Set();
      this.getCarRoutePositions().forEach((position) => {
        occupied.add(network.getRouteSegmentId(this.route, position));
      });
      return occupied;
    }

    getCarPoses(network) {
      return this.getCarRoutePositions().map((position) => network.getRoutePose(this.route, position));
    }

    render(network) {
      if (!this.group) return;
      const poses = this.getCarPoses(network);
      poses.forEach((pose, index) => {
        this.cars[index].setAttribute("transform", `translate(${pose.x} ${pose.y}) rotate(${pose.angle})`);
      });
      const head = poses[0];
      this.nameLabel.setAttribute("x", head.x);
      this.nameLabel.setAttribute("y", head.y - 14);
      this.renderPassengerIndicator(head);
    }

    renderPassengerIndicator(head) {
      const count = this.passengerIds.length;
      if (!count) {
        this.passengerIndicator.setAttribute("visibility", "hidden");
        this.passengerVisualKey = null;
        return;
      }

      this.passengerIndicator.setAttribute("visibility", "visible");
      this.passengerIndicator.setAttribute("transform", `translate(${head.x} ${head.y - 28})`);
      const visualKey = `${this.cargoColor}|${count}`;
      if (this.passengerVisualKey === visualKey) return;
      this.passengerVisualKey = visualKey;
      this.passengerIndicator.style.setProperty("--passenger-color", this.cargoColor);
      this.passengerCount.textContent = `x ${count}`;
    }
  }

  window.Stellwerk = window.Stellwerk || {};
  window.Stellwerk.Train = Train;
}());
