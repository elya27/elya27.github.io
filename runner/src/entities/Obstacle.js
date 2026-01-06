// src/entities/Obstacle.js
import { CONFIG } from "../core/Config.js";
import { ANIM } from "../core/AnimConfig.js";
import { Entity } from "./Entity.js";
import { Animator } from "../core/Animator.js";
import { SpriteSheet } from "../core/SpriteSheet.js";

export class Obstacle extends Entity {
  constructor({ kind, lane, y, lanes, viewH, assets = null }) {
    super();
    this.kind = kind;
    this.cfg = CONFIG.OBSTACLES[kind];
    this.lane = lane;

    this.lanes = lanes;
    this.viewH = viewH;
    this.assets = assets;

    this.x = lanes.laneCenterX(lane);
    this.y = y;

    this.triggered = false;
    this.state = "IDLE";
    this.neutralized = false;

    // RAT movement
    if (kind === "RAT") {
      this.facingDir = Math.random() < 0.5 ? -1 : 1;
      this._laneFrom = lane;
      this._laneTo = lane;
      this._moveT = 1;
      this._moveMs = this.cfg.move_duration_ms ?? 160;
    }

    // HAND
    if (kind === "HAND") {
      this.state = "HIDDEN";
      this.activeLeftMs = 0;
    }

    // DOOR
    if (kind === "DOOR") {
      this.state = "CLOSED";
    }

    // animators by config
    this._animators = this._makeAnimators();
    this._currentKey = this._animKey();

    // (3) TRASH: выбираем случайный кадр один раз
    this._staticFrame = null;
    if (this.kind === "TRASH") {
      const cfg = ANIM.obstacles.TRASH;
      if (cfg?.randomStatic && Array.isArray(cfg.frames) && cfg.frames.length) {
        this._staticFrame = cfg.frames[Math.floor(Math.random() * cfg.frames.length)];
      }
    }
    
  }

  setViewH(h) { this.viewH = h; }
  setAssets(assets) { this.assets = assets; }

  isKillable() { return !!this.cfg.killable; }

  distanceToPlayer(playerY) {
    return playerY - this.y;
  }

  tryTrigger(playerY) {
    if (this.triggered) return;

    const ratio = this.cfg.trigger_ratio;
    if (!ratio) return;

    const distPx = this.viewH * ratio;
    if (this.distanceToPlayer(playerY) <= distPx) {
      this.triggered = true;

      if (this.kind === "RAT") {
        const target = this.lanes.clampLane(this.lane + this.facingDir);
        this._laneFrom = this.lane;
        this._laneTo = target;
        this._moveT = 0;
      }

      if (this.kind === "DOOR") {
        this.state = "OPENING";
        this._setAnimKey(this._animKey()); // сброс анимации
      }

      if (this.kind === "HAND") {
        this.state = "ACTIVE";
        this.activeLeftMs = this.cfg.active_ms ?? 650;
        this._setAnimKey(this._animKey());
      }
    }
  }

  neutralize() {
    if (!this.isKillable()) return false;
    if (this.neutralized) return false;

    this.neutralized = true;
    this.dead = true;
    return true;
  }

  update(dt, { speedPxPerSec, playerY }) {
    if (this.dead) return;

    this.y += speedPxPerSec * dt;
    this.tryTrigger(playerY);

    // RAT move tween
    if (this.kind === "RAT" && this._moveT < 1) {
      const dtMs = dt * 1000;
      this._moveT = Math.min(1, this._moveT + dtMs / this._moveMs);
      const t = easeOutCubic(this._moveT);

      const x0 = this.lanes.laneCenterX(this._laneFrom);
      const x1 = this.lanes.laneCenterX(this._laneTo);
      this.x = x0 + (x1 - x0) * t;

      if (this._moveT >= 1) {
        this.lane = this._laneTo;
        this.x = this.lanes.laneCenterX(this.lane);
      }
    } else {
      this.x = this.lanes.laneCenterX(this.lane);
    }

    // HAND timer
    if (this.kind === "HAND" && this.state === "ACTIVE") {
      this.activeLeftMs -= dt * 1000;
      if (this.activeLeftMs <= 0) {
        this.state = "INACTIVE";
        this._setAnimKey(this._animKey());
      }
    }

    // DOOR: когда анимация открытия закончилась — OPEN
    if (this.kind === "DOOR" && this.state === "OPENING") {
      const key = this._animKey();
      const anim = this._animators[key];
      if (anim?.done) {
        this.state = "OPEN";
        this._setAnimKey(this._animKey());
      }
    }

    // update current anim
    const nextKey = this._animKey();
    if (nextKey !== this._currentKey) this._setAnimKey(nextKey);
    this._animators[this._currentKey]?.update(dt);

    if (this.y > this.viewH + 120) this.dead = true;
  }

  getHitbox() {
    const w = this.lanes.laneW * 0.82;
    const h = 44;
    return { x: this.x - w / 2, y: this.y - h / 2, w, h };
  }

  render(ctx) {
    if (this.dead || this.neutralized) return;

    // HAND hidden = invisible
    if (this.kind === "HAND" && this.state === "HIDDEN") return;

    const animCfg = this._animCfgForKey(this._currentKey);
    const sheetKey = this._sheetKeyForThis();
    const img = this.assets?.getImage?.(sheetKey);

    if (img && animCfg) {
      const { frameW, frameH } = this.assets.manifest[sheetKey];
      const sheet = new SpriteSheet({ image: img, frameW, frameH });
      let frame = this._animators[this._currentKey].frame();
      if (this._staticFrame !== null ||
        (this.kind === "TRASH" || this.kind === "WET")) frame = this._staticFrame;

      // (1) RAT: поворачиваем спрайт на ±90°
      if (this.kind === "RAT") {
        const rot = this.facingDir < 0 ? Math.PI / 2 : -Math.PI / 2;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(rot);

        // рисуем кадр вручную, чтобы не было "floor()" и дёрганья при повороте
        const sx = frame * frameW;
        ctx.drawImage(
          img,
          sx, 0, frameW, frameH,
          -frameW / 2, -frameH / 2, frameW, frameH
        );

        ctx.restore();
        return;
      }

      sheet.drawFrame(ctx, frame, this.x, this.y, 1.0);
      return;
    }

    // fallback rect
    const hb = this.getHitbox();
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
    ctx.strokeStyle = "rgba(255,255,255,0.20)";
    ctx.lineWidth = 2;
    ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.kind + (this.kind === "DOOR" ? `:${this.state}` : ""), this.x, this.y);
    ctx.restore();
  }

  // --- anim helpers ---
  _makeAnimators() {
    const anims = {};
    const defs = this._allAnimDefs();
    for (const [key, def] of Object.entries(defs)) {
      anims[key] = new Animator(def);
    }
    return anims;
  }

  _allAnimDefs() {
    // базовая анимация для препятствия
    const baseDef = ANIM.obstacles[this.kind] || null;

    // специальные состояния
    if (this.kind === "DOOR") {
      return {
        DOOR_CLOSED: ANIM.obstacles.DOOR_CLOSED,
        DOOR_OPENING: ANIM.obstacles.DOOR_OPENING,
        DOOR_OPEN: ANIM.obstacles.DOOR_OPEN,
      };
    }
    if (this.kind === "HAND") {
      return {
        HAND_ACTIVE: ANIM.obstacles.HAND_ACTIVE,
        HAND_INACTIVE: ANIM.obstacles.HAND_INACTIVE,
      };
    }
    // обычный объект
    return {
      BASE: baseDef || { sheet: null, frames: [0], frameMs: 999, loop: true },
    };
  }

  _sheetKeyForThis() {
    if (this.kind === "DOOR") {
      if (this.lane === 0) return "obs_door_l";
      if (this.lane === 2) return "obs_door_r";
      return "obs_door"; // fallback (но в центр уже не должно спавнить)
    }
    if (this.kind === "HAND") {
      if (this.lane === 0) return "obs_hand_l";
      if (this.lane === 2) return "obs_hand_r";
      return "obs_hand";
    }

    // остальное как раньше
    const map = {
      FLIES: "obs_flies",
      COCKROACHES: "obs_roaches",
      TRASH: "obs_trash",
      WET: "obs_wet",
      RAT: "obs_rat",
    };
    return map[this.kind] ?? "obs_trash";
  }

  _animKey() {
    if (this.kind === "DOOR") {
      if (this.state === "OPENING") return "DOOR_OPENING";
      if (this.state === "OPEN") return "DOOR_OPEN";
      return "DOOR_CLOSED";
    }
    if (this.kind === "HAND") {
      if (this.state === "ACTIVE") return "HAND_ACTIVE";
      return "HAND_INACTIVE";
    }
    return "BASE";
  }

  _animCfgForKey(key) {
    const defs = this._allAnimDefs();
    return defs[key] || null;
  }

  _setAnimKey(key) {
    this._currentKey = key;
    this._animators[this._currentKey]?.reset?.();
  }
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
