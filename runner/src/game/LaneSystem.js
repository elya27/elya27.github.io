// src/game/LaneSystem.js
import { CONFIG } from "../core/Config.js";

export class LaneSystem {
  constructor(viewWidth = CONFIG.VIEW.W) {
    this.viewWidth = viewWidth;
    this._recalc();
  }

  setViewWidth(w) {
    this.viewWidth = w;
    this._recalc();
  }

  _recalc() {
    const pad = CONFIG.LANES.SIDE_PADDING;
    const innerW = this.viewWidth - pad * 2;
    this.laneW = innerW / CONFIG.LANES.COUNT;
    this.pad = pad;

    this.centers = Array.from({ length: CONFIG.LANES.COUNT }, (_, i) => {
      return pad + this.laneW * i + this.laneW / 2;
    });
  }

  clampLane(i) {
    return Math.max(0, Math.min(CONFIG.LANES.COUNT - 1, i));
  }

  laneCenterX(i) {
    return this.centers[this.clampLane(i)];
  }
}
