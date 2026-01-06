// src/entities/Pickup.js
import { Entity } from "./Entity.js";

export class Pickup extends Entity {
  constructor({ weaponId, lane, y, lanes, viewH, assets = null }) {
    super();
    this.weaponId = weaponId;
    this.lane = lane;
    this.lanes = lanes;
    this.viewH = viewH;
    this.assets = assets;

    this.x = lanes.laneCenterX(lane);
    this.y = y;
  }

  setViewH(h) { this.viewH = h; }
  setAssets(assets) { this.assets = assets; }

  update(dt, { speedPxPerSec }) {
    this.y += speedPxPerSec * dt;
    this.x = this.lanes.laneCenterX(this.lane);
    if (this.y > this.viewH + 120) this.dead = true;
  }

  getHitbox() {
    const w = this.lanes.laneW * 0.52;
    const h = 30;
    return { x: this.x - w / 2, y: this.y - h / 2, w, h };
  }

  render(ctx) {
    if (this.dead) return;
    const hb = this.getHitbox();

    ctx.save();
    ctx.fillStyle = "rgba(200,255,200,0.14)";
    ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
    ctx.strokeStyle = "rgba(200,255,200,0.30)";
    ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);

    ctx.fillStyle = "rgba(220,255,220,0.85)";
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.weaponId, this.x, this.y);
    ctx.restore();
  }
}
