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
      this.vehicles = definition.vehicles;
      this.config = config;
      this.route = initialRoute.map((segmentId) => ({ segmentId, direction: 1 }));
      this.vehicleOffsets = this.createVehicleOffsets();
      this.trainExtent = this.vehicleOffsets[this.vehicleOffsets.length - 1] || 0;
      this.position = Math.min(this.route.length - 0.55, Math.max(config.initialHeadPosition, this.trainExtent + 0.55));
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

    createVehicleOffsets() {
      const offsets = [];
      let offset = 0;
      this.vehicles.forEach((vehicle, index) => {
        if (index > 0) offset += (this.vehicles[index - 1].routeLength + vehicle.routeLength) / 2;
        offsets.push(offset);
      });
      return offsets;
    }

    mount(parent) {
      this.group = svgElement("g", { "data-train-id": this.id, class: "train" });
      this.vehicles.forEach((vehicle) => {
        const car = this.createVehicle(vehicle);
        this.cars.push(car);
        this.group.append(car.group);
      });
      this.nameLabel = svgElement("text", { class: "train-name", "text-anchor": "middle" });
      this.nameLabel.textContent = this.name;
      this.passengerIndicator = svgElement("g", { class: "train-passenger-indicator", visibility: "hidden" });
      const passengerHead = svgElement("circle", { cx: -7, cy: -4, r: 3.2, class: "train-passenger-head" });
      const passengerBody = svgElement("rect", { x: -11, y: 0, width: 8, height: 6.6, rx: 1.4, class: "train-passenger-body" });
      this.passengerCount = svgElement("text", { x: 2, y: 5, class: "train-passenger-count" });
      this.passengerIndicator.append(passengerHead, passengerBody, this.passengerCount);
      this.group.append(this.nameLabel, this.passengerIndicator);
      parent.append(this.group);
    }

    createVehicle(vehicle) {
      const group = svgElement("g", { class: `train-vehicle train-${vehicle.type}` });
      const width = vehicle.type === "locomotive" ? 19 : 38;
      const height = vehicle.type === "locomotive" ? 12 : 13;
      const body = vehicle.type === "locomotive"
        ? svgElement("path", { d: "M-10 -6 H7 L11 -3 V5 L7 6 H-10 Z", fill: vehicle.color, class: "train-body train-locomotive-body" })
        : svgElement("rect", { x: -width / 2, y: -height / 2, width, height, fill: vehicle.color, class: "train-body train-wagon-body" });
      group.append(body);

      if (vehicle.type === "locomotive") {
        const cabWindow = svgElement("rect", { x: -4, y: -3.8, width: 5.7, height: 4.4, rx: 0.7, class: "train-window" });
        const lamp = svgElement("circle", { cx: 8.4, cy: 1.2, r: 1.15, class: "train-lamp" });
        group.append(cabWindow, lamp);
      } else {
        [-12, 0, 12].forEach((x) => group.append(svgElement("rect", { x: x - 3.6, y: -3.9, width: 7.2, height: 4.1, rx: 0.6, class: "train-window" })));
        group.append(svgElement("line", { x1: -width / 2 + 2, y1: 3.4, x2: width / 2 - 2, y2: 3.4, class: "train-stripe" }));
      }
      [-width * 0.29, width * 0.29].forEach((x) => group.append(svgElement("circle", { cx: x, cy: height / 2 + 1, r: 2.25, class: "train-wheel" })));
      return { group, vehicle };
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
      this.position = routeLength - this.position + this.trainExtent;

      const requiredSegments = Math.max(Math.ceil(this.trainExtent) + 2, Math.floor(this.position) + 1);
      this.route.length = Math.min(this.route.length, requiredSegments);
    }

    setSpeedLevel(level) {
      this.speedLevel = Number(level);
    }

    getCarRoutePositions() {
      return this.vehicleOffsets.map((offset) => this.position - offset);
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
      const travellingBackward = this.pathDirection === "reverse";
      const visualPoses = travellingBackward ? poses.slice().reverse() : poses;
      visualPoses.forEach((pose, index) => {
        const angle = travellingBackward ? pose.angle + 180 : pose.angle;
        this.cars[index].group.setAttribute("transform", `translate(${pose.x} ${pose.y}) rotate(${angle})`);
      });
      const visualHead = visualPoses[0];
      this.nameLabel.setAttribute("x", visualHead.x);
      this.nameLabel.setAttribute("y", visualHead.y - 17);
      this.renderPassengerIndicator(visualHead);
    }

    renderPassengerIndicator(head) {
      const count = this.passengerIds.length;
      if (!count) {
        this.passengerIndicator.setAttribute("visibility", "hidden");
        this.passengerVisualKey = null;
        return;
      }

      this.passengerIndicator.setAttribute("visibility", "visible");
      this.passengerIndicator.setAttribute("transform", `translate(${head.x} ${head.y - 31})`);
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
