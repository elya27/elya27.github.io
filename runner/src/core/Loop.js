// src/core/Loop.js

/**
 * Универсальный игровой цикл на requestAnimationFrame.
 * - dt в секундах
 * - clamp dt, чтобы не было "телепорта" после сворачивания
 */
 export class Loop {
    constructor({ onFrame, maxDtMs = 34 } = {}) {
      this.onFrame = onFrame || (() => {});
      this.maxDtMs = maxDtMs;
  
      this._raf = 0;
      this._running = false;
      this._lastTs = 0;
  
      this._tick = this._tick.bind(this);
    }
  
    start() {
      if (this._running) return;
      this._running = true;
      this._lastTs = performance.now();
      this._raf = requestAnimationFrame(this._tick);
    }
  
    stop() {
      this._running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
  
    _tick(ts) {
      if (!this._running) return;
      this._raf = requestAnimationFrame(this._tick);
  
      const dtMs = Math.min(this.maxDtMs, ts - this._lastTs);
      this._lastTs = ts;
  
      const dt = dtMs / 1000;
      this.onFrame(dt, ts);
    }
  }
  