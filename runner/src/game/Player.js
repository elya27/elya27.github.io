// src/game/Player.js
import { CONFIG } from "../core/Config.js";
import { ANIM } from "../core/AnimConfig.js";
import { Animator } from "../core/Animator.js";
import { SpriteSheet } from "../core/SpriteSheet.js";

export class Player {
  constructor(lanes, viewHeight = CONFIG.VIEW.H, assets = null) {
    this.lanes = lanes;
    this.viewHeight = viewHeight;
    this.assets = assets;

    this.laneIndex = 1;
    this._fromLane = 1;
    this._toLane = 1;

    this.x = this.lanes.laneCenterX(this.laneIndex);
    this.y = Math.floor(this.viewHeight * CONFIG.VIEW.PLAYER_Y_RATIO);

    this._switchT = 1;
    this._switchMs = CONFIG.LANES.SWITCH_DURATION_MS;
    this._cooldownMs = 0;

    this.stunnedMs = 0;
    this.slidingMs = 0;

    // animators берут настройки из AnimConfig
    this.anim = {
      run: new Animator(ANIM.player.run),
      stun: new Animator(ANIM.player.stun),
    };
    this._current = "run";
  }

  setAssets(assets) { this.assets = assets; }

  setViewHeight(h) {
    this.viewHeight = h;
    this.y = Math.floor(this.viewHeight * CONFIG.VIEW.PLAYER_Y_RATIO);
  }

  canChangeLane() {
    return this.stunnedMs <= 0 && this.slidingMs <= 0 && this._cooldownMs <= 0;
  }

  requestLaneChange(dir) {
    if (!this.canChangeLane()) return;

    const next = this.lanes.clampLane(this.laneIndex + dir);
    if (next === this.laneIndex) return;

    this._fromLane = this.laneIndex;
    this._toLane = next;
    this.laneIndex = next;

    this._switchT = 0;
    this._cooldownMs = CONFIG.LANES.SWITCH_COOLDOWN_MS;
  }

  applyStun(ms) { this.stunnedMs = Math.max(this.stunnedMs, ms); }
  applySlide(ms) { this.slidingMs = Math.max(this.slidingMs, ms); }

  update(dt) {
    const dtMs = dt * 1000;

    this._cooldownMs = Math.max(0, this._cooldownMs - dtMs);
    this.stunnedMs = Math.max(0, this.stunnedMs - dtMs);
    this.slidingMs = Math.max(0, this.slidingMs - dtMs);

    // lane tween
    if (this._switchT < 1) {
      this._switchT = Math.min(1, this._switchT + dtMs / this._switchMs);
      const t = easeOutCubic(this._switchT);
      const x0 = this.lanes.laneCenterX(this._fromLane);
      const x1 = this.lanes.laneCenterX(this._toLane);
      this.x = x0 + (x1 - x0) * t;
    } else {
      this.x = this.lanes.laneCenterX(this.laneIndex);
    }

    // choose anim
    const nextAnim = this.stunnedMs > 0 ? "stun" : "run";
    if (nextAnim !== this._current) {
      this._current = nextAnim;
      this.anim[this._current].reset();
    }
    this.anim[this._current].update(dt);
  }

  render(ctx) {
    const cfg = ANIM.player[this._current];
    const img = this.assets?.getImage?.(cfg.sheet);

    if (img) {
      const { frameW, frameH } = this.assets.manifest[cfg.sheet];
      const sheet = new SpriteSheet({ image: img, frameW, frameH });

      ctx.save();
      if (this.stunnedMs > 0) ctx.globalAlpha = 0.85;

      sheet.drawFrame(ctx, this.anim[this._current].frame(), this.x, this.y, 1.0);

      if (this.slidingMs > 0) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(120,200,255,0.85)";
        ctx.fillRect(Math.floor(this.x - 14), Math.floor(this.y + frameH / 2 + 6), 28, 4);
      }
      ctx.restore();
      return;
    }

    // fallback
    const size = 26;
    ctx.save();
    if (this.stunnedMs > 0) ctx.globalAlpha = 0.55;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(Math.floor(this.x - size / 2), Math.floor(this.y - size / 2), size, size);

    if (this.slidingMs > 0) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(120,200,255,0.85)";
      ctx.fillRect(Math.floor(this.x - size / 2), Math.floor(this.y + size / 2 + 6), size, 4);
    }
    ctx.restore();
  }
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
