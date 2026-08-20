(function () {
  "use strict";

  class MapViewport {
    constructor(viewport, plan) {
      this.viewport = viewport;
      this.plan = plan;
      this.scale = 1;
      this.pan = { x: 0, y: 0 };
      this.minScale = 0.5;
      this.maxScale = 2.5;
      this.pointers = new Map();
      this.drag = null;
      this.pinch = null;
      this.suppressNextClick = false;
      this.bind();
      this.apply();
    }

    bind() {
      this.viewport.addEventListener("wheel", (event) => {
        event.preventDefault();
        const factor = Math.exp(-event.deltaY * 0.00125);
        this.setZoom(this.scale * factor, event.clientX, event.clientY);
      }, { passive: false });

      this.viewport.addEventListener("pointerdown", (event) => this.onPointerDown(event));
      this.viewport.addEventListener("pointermove", (event) => this.onPointerMove(event));
      this.viewport.addEventListener("pointerup", (event) => this.onPointerUp(event));
      this.viewport.addEventListener("pointercancel", (event) => this.onPointerUp(event));
      this.viewport.addEventListener("click", (event) => {
        if (!this.suppressNextClick) return;
        event.preventDefault();
        event.stopPropagation();
        this.suppressNextClick = false;
      }, true);

      document.querySelectorAll("[data-map-zoom]").forEach((button) => {
        button.addEventListener("click", () => {
          const action = button.dataset.mapZoom;
          if (action === "reset") this.reset();
          if (action === "in") this.setZoom(this.scale * 1.25);
          if (action === "out") this.setZoom(this.scale / 1.25);
        });
      });
    }

    onPointerDown(event) {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target.closest(".map-zoom-controls")) return;
      this.viewport.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.pointers.size === 1) {
        this.drag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          panX: this.pan.x,
          panY: this.pan.y,
          moved: false
        };
      } else if (this.pointers.size === 2) {
        this.drag = null;
        this.pinch = this.getPinchState();
      }
    }

    onPointerMove(event) {
      if (!this.pointers.has(event.pointerId)) return;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.pointers.size >= 2) {
        const pinch = this.getPinchState();
        if (!this.pinch) this.pinch = pinch;
        const nextScale = this.pinch.scale * (pinch.distance / Math.max(1, this.pinch.distance));
        this.setZoom(nextScale, pinch.centerX, pinch.centerY);
        this.pinch = { ...this.getPinchState(), scale: this.scale };
        this.suppressNextClick = true;
        return;
      }
      if (!this.drag || this.drag.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - this.drag.startX;
      const deltaY = event.clientY - this.drag.startY;
      if (Math.hypot(deltaX, deltaY) > 3) this.drag.moved = true;
      if (!this.drag.moved) return;
      this.pan.x = this.drag.panX + deltaX;
      this.pan.y = this.drag.panY + deltaY;
      this.clampPan();
      this.apply();
    }

    onPointerUp(event) {
      if (!this.pointers.has(event.pointerId)) return;
      const moved = this.drag && this.drag.pointerId === event.pointerId && this.drag.moved;
      this.pointers.delete(event.pointerId);
      if (moved || this.pointers.size > 0) this.suppressNextClick = true;
      if (this.pointers.size === 1) {
        const [pointerId, point] = this.pointers.entries().next().value;
        this.drag = { pointerId, startX: point.x, startY: point.y, panX: this.pan.x, panY: this.pan.y, moved: false };
        this.pinch = null;
      } else {
        this.drag = null;
        this.pinch = null;
      }
    }

    getPinchState() {
      const points = [...this.pointers.values()];
      const centerX = (points[0].x + points[1].x) / 2;
      const centerY = (points[0].y + points[1].y) / 2;
      return {
        centerX,
        centerY,
        distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
        scale: this.scale
      };
    }

    setZoom(nextScale, clientX, clientY) {
      const boundedScale = Math.max(this.minScale, Math.min(this.maxScale, nextScale));
      if (Math.abs(boundedScale - this.scale) < 0.0001) return;
      const rect = this.viewport.getBoundingClientRect();
      const anchorX = clientX === undefined ? rect.left + rect.width / 2 : clientX;
      const anchorY = clientY === undefined ? rect.top + rect.height / 2 : clientY;
      const localX = anchorX - rect.left;
      const localY = anchorY - rect.top;
      const mapX = (localX - this.pan.x) / this.scale;
      const mapY = (localY - this.pan.y) / this.scale;
      this.scale = boundedScale;
      this.pan.x = localX - mapX * this.scale;
      this.pan.y = localY - mapY * this.scale;
      this.clampPan();
      this.apply();
    }

    reset() {
      this.scale = 1;
      this.pan = { x: 0, y: 0 };
      this.apply();
    }

    clampPan() {
      const width = this.viewport.clientWidth;
      const height = this.viewport.clientHeight;
      const contentWidth = width * this.scale;
      const contentHeight = height * this.scale;
      const clampAxis = (value, viewportSize, contentSize) => {
        if (contentSize <= viewportSize) return (viewportSize - contentSize) / 2;
        return Math.max(viewportSize - contentSize, Math.min(0, value));
      };
      this.pan.x = clampAxis(this.pan.x, width, contentWidth);
      this.pan.y = clampAxis(this.pan.y, height, contentHeight);
    }

    apply() {
      this.plan.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.scale})`;
      this.viewport.dataset.zoom = `${Math.round(this.scale * 100)}%`;
    }
  }

  window.Stellwerk = window.Stellwerk || {};
  window.Stellwerk.MapViewport = MapViewport;
}());
