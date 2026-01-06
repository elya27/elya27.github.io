// src/entities/Projectile.js
import { Entity } from "./Entity.js";

export class Projectile extends Entity {
  constructor({ lane, x, y, vy, lanes, viewH, travelPx }) {
    super();
    this.lane = lane;
    this.lanes = lanes;
    this.viewH = viewH;

    this.x = x;
    this.y = y;
    this.vy = vy; // отрицательная скорость (летит вверх)
    this.travelLeft = travelPx;
  }

  setViewH(h) {
    this.viewH = h;
  }

  update(dt) {
    if (this.dead) return;
    const dy = this.vy * dt;
    this.y += dy;
    this.travelLeft -= Math.abs(dy);

    if (this.travelLeft <= 0) this.dead = true;
    if (this.y < -120) this.dead = true;
  }

  getHitbox() {
    const w = this.lanes.laneW * 0.22;
    const h = 18;
    return { x: this.x - w / 2, y: this.y - h / 2, w, h };
  }

  render(ctx) {
    if (this.dead) return;
    const hb = this.getHitbox();
    ctx.save();
    ctx.fillStyle = "rgba(255,240,200,0.65)";
    ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
    ctx.restore();
  }
}
