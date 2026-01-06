// src/game/WeaponSystem.js
import { CONFIG } from "../core/Config.js";
import { Projectile } from "../entities/Projectile.js";

export class WeaponSystem {
  constructor() {
    this.weapon = null; // { id, durability }
    this.cooldownMs = 0;
  }

  hasWeapon() {
    return !!this.weapon;
  }

  getWeapon() {
    return this.weapon;
  }

  clearWeapon() {
    this.weapon = null;
    this.cooldownMs = 0;
  }

  tryPickup(weaponId) {
    if (CONFIG.WEAPONS.SPAWN_ONLY_IF_EMPTY_HAND && this.weapon) return false;

    if (weaponId === "BOTTLE") {
      this.weapon = { id: "BOTTLE", durability: 1 };
      return true;
    }
    if (weaponId === "SLIPPER") {
      this.weapon = { id: "SLIPPER", durability: CONFIG.WEAPONS.SLIPPER.durability };
      return true;
    }
    if (weaponId === "PAN") {
      this.weapon = { id: "PAN", durability: CONFIG.WEAPONS.PAN.durability };
      return true;
    }
    return false;
  }

  update(dt) {
    this.cooldownMs = Math.max(0, this.cooldownMs - dt * 1000);
  }

  /**
   * Action:
   * - melee: нейтрализует killable в тайле перед игроком (в той же полосе)
   * - bottle: создаёт projectile
   */
  action({ player, obstacles, projectiles, viewH }) {
    if (!this.weapon) return { used: false };
    if (this.cooldownMs > 0) return { used: false };

    const weapon = this.weapon;

    if (weapon.id === "BOTTLE") {
      const cfg = CONFIG.WEAPONS.BOTTLE;
      const travelPx = viewH * cfg.travel_ratio;

      const proj = new Projectile({
        lane: player.laneIndex,
        x: player.x,
        y: player.y - 20,
        vy: -cfg.speed_px_per_sec,
        lanes: player.lanes,
        viewH,
        travelPx,
      });

      projectiles.push(proj);

      // одноразовая
      this.clearWeapon();
      return { used: true, type: "BOTTLE" };
    }

    // melee
    const meleeCfg = weapon.id === "SLIPPER" ? CONFIG.WEAPONS.SLIPPER : CONFIG.WEAPONS.PAN;
    const hitRange = meleeCfg.hit_range_px;

    // ищем ближайшее killable препятствие "перед игроком" в той же полосе
    const candidates = obstacles
      .filter(o => !o.dead && !o.neutralized && o.isKillable() && o.lane === player.laneIndex)
      .filter(o => o.y < player.y && (player.y - o.y) <= hitRange)
      .sort((a, b) => (player.y - a.y) - (player.y - b.y));

    if (candidates.length > 0) {
      candidates[0].neutralize();

      weapon.durability -= 1;
      this.cooldownMs = meleeCfg.cooldown_ms;

      if (weapon.durability <= 0) this.clearWeapon();
      return { used: true, type: weapon.id, hit: true };
    }

    // махнул в пустоту — тоже кд (чтобы не спамили)
    this.cooldownMs = meleeCfg.cooldown_ms;
    return { used: true, type: weapon.id, hit: false };
  }
}
