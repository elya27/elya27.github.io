// src/core/Game.js
import { CONFIG } from "./Config.js";
import { Background } from "../game/Background.js";
import { Input } from "./Input.js";
import { LaneSystem } from "../game/LaneSystem.js";
import { Player } from "../game/Player.js";
import { Spawner } from "../game/Spawner.js";
import { WeaponSystem } from "../game/WeaponSystem.js";
import { aabb } from "../game/Collision.js";
import { Assets } from "./Assets.js";
import { MANIFEST } from "./AssetManifest.js";

export const GAME_STATE = {
  MENU: "MENU",
  RUN: "RUN",
  DEAD: "DEAD",
};

export class Game {
  constructor({
    canvas,
    ctx,
    hpFillEl,
    distTextEl,
    weaponIconEl,
    weaponDurEl,
    onDead = () => {},
  }) {
    this.canvas = canvas;
    this.ctx = ctx;

    this.hpFillEl = hpFillEl;
    this.distTextEl = distTextEl;
    this.weaponIconEl = weaponIconEl;
    this.weaponDurEl = weaponDurEl;

    this.onDead = onDead;

    this.viewW = CONFIG.VIEW.W;
    this.viewH = CONFIG.VIEW.H;

    // assets (лениво грузим; если PNG пока нет — просто будут заглушки)
    this.assets = new Assets(MANIFEST);
    this.assets.preloadAll();

    this.state = GAME_STATE.MENU;

    this.distanceMeters = 0;
    this.hp = CONFIG.PLAYER.HP_MAX;
    this._iframesMs = 0;

    this.speed = CONFIG.RUN.SPEED_START;

    this.lanes = new LaneSystem(this.viewW);
    this.player = new Player(this.lanes, this.viewH, this.assets);

    this.background = new Background({
      viewW: this.viewW,
      viewH: this.viewH,
      lanes: this.lanes,
      assets: this.assets,
    });

    this.weaponSystem = new WeaponSystem();
    this.spawner = new Spawner({ lanes: this.lanes, viewH: this.viewH, assets: this.assets });

    this.obstacles = [];
    this.pickups = [];
    this.projectiles = [];

    this.input = new Input(this.canvas, {
      onSwipeLeft: () => {
        if (this.state !== GAME_STATE.RUN) return;
        this.player.requestLaneChange(-1);
      },
      onSwipeRight: () => {
        if (this.state !== GAME_STATE.RUN) return;
        this.player.requestLaneChange(+1);
      },
      onDoubleTap: () => {
        if (this.state !== GAME_STATE.RUN) return;

        // действие оружия
        const res = this.weaponSystem.action({
          player: this.player,
          obstacles: this.obstacles,
          projectiles: this.projectiles,
          viewH: this.viewH,
        });

        // если оглушён/скользит — Player сам блокирует смену полосы;
        // атака разрешена (ты можешь позже запретить её на stunned/sliding)
        // if (res.used) playSfx(...)
      },
    });

    this.input.setEnabled(false);
    this._updateHUD();
  }

  destroy() {
    this.input?.destroy?.();
  }

  onResize(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;

    this.lanes.setViewWidth(viewW);
    this.player.setViewHeight(viewH);
    this.spawner.setViewH(viewH);

    this.background.onResize(viewW, viewH);
    this.background.setAssets?.(this.assets);

    this.player.setAssets?.(this.assets);
    this.spawner.setAssets?.(this.assets);

    for (const o of this.obstacles) o.setViewH?.(viewH);
    for (const p of this.pickups) p.setViewH?.(viewH);
    for (const pr of this.projectiles) pr.setViewH?.(viewH);
  }

  startRun() {
    this._resetRun();
    this.state = GAME_STATE.RUN;
    this.input.setEnabled(true);
  }

  goMenu() {
    this.state = GAME_STATE.MENU;
    this.input.setEnabled(false);
  }

  update(dt) {
    if (this.state === GAME_STATE.MENU) return;
    if (this.state !== GAME_STATE.RUN) return;

    // difficulty
    this.speed = Math.min(
      CONFIG.RUN.SPEED_MAX,
      this.speed + CONFIG.RUN.SPEED_ACCEL_PER_SEC * dt
    );

    this.background.update(dt, this.speed);

    this.distanceMeters += (this.speed * dt) / CONFIG.RUN.PX_PER_METER;

    // difficulty01 (0..1) по скорости
    const difficulty01 = (this.speed - CONFIG.RUN.SPEED_START) / (CONFIG.RUN.SPEED_MAX - CONFIG.RUN.SPEED_START);

    // таймеры
    this._iframesMs = Math.max(0, this._iframesMs - dt * 1000);

    // системы
    this.player.update(dt);
    this.weaponSystem.update(dt);

    // курсор спавна должен двигаться вместе с "миром"
    this.spawner.advance(dt, this.speed);

    // спавн
    const weaponEmpty = !this.weaponSystem.hasWeapon();
    this.spawner.ensureAhead({
      obstacles: this.obstacles,
      pickups: this.pickups,
      difficulty01,
      weaponEmpty,
    });

    // update entities
    const env = { speedPxPerSec: this.speed, playerY: this.player.y };

    for (const o of this.obstacles) o.update(dt, env);
    this._resolveRatBlocking();
    for (const p of this.pickups) p.update(dt, env);
    for (const pr of this.projectiles) pr.update(dt);

    // коллизии
    this._handlePickups();
    this._handleProjectiles();
    this._handleObstacleCollisions();

    // cleanup
    this.obstacles = this.obstacles.filter(o => !o.dead);
    this.pickups = this.pickups.filter(p => !p.dead);
    this.projectiles = this.projectiles.filter(pr => !pr.dead);

    this._updateHUD();

    if (this.hp <= 0) this._die();
  }

  render() {
    this._clear("#0f0f0f");
    this.background.render(this.ctx);

    // _drawLanes можно оставить только для DEBUG или убрать совсем
    if (CONFIG.VIEW.DEBUG) this._drawLanes();

    // obstacles / pickups / projectiles
    for (const o of this.obstacles) o.render(this.ctx);
    for (const p of this.pickups) p.render(this.ctx);
    for (const pr of this.projectiles) pr.render(this.ctx);

    this.player.render(this.ctx);

    if (CONFIG.VIEW.DEBUG) {
      const ctx = this.ctx;
    
      // player HB
      const phb = this._playerHitbox();
      ctx.save();
      ctx.strokeStyle = "rgba(0,255,255,0.9)";
      ctx.lineWidth = 2;
      ctx.strokeRect(phb.x, phb.y, phb.w, phb.h);
    
      // obstacles HB
      ctx.strokeStyle = "rgba(255,0,0,0.85)";
      for (const o of this.obstacles) {
        if (o.dead || o.neutralized) continue;
        const hb = o.getHitbox();
        ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
      }
      ctx.restore();
    }
    

    if (this.state === GAME_STATE.MENU) {
      this._drawCenteredText("Dorm Runner", 26, this.viewH * 0.40);
      this._drawCenteredText("Нажми Старт", 16, this.viewH * 0.48, 0.85);
    }

    if (CONFIG.VIEW.DEBUG) {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "12px system-ui";
      ctx.fillText(`state: ${this.state}`, 10, this.viewH - 46);
      ctx.fillText(`speed: ${this.speed.toFixed(0)}`, 10, this.viewH - 30);
      ctx.fillText(`dist: ${this.distanceMeters.toFixed(1)}m`, 10, this.viewH - 16);
      ctx.fillText(`spawnCursorY: ${this.spawner.spawnCursorY.toFixed(0)}`, 10, this.viewH - 60);
      ctx.fillText(`hp: ${this.hp.toFixed(0)}`, 10, this.viewH - 76);
      ctx.restore();
    }
  }

  // --- collisions ---
  _handlePickups() {
    if (!this.pickups.length) return;

    const playerHB = this._playerHitbox();
    for (const p of this.pickups) {
      if (p.dead) continue;
      if (p.lane !== this.player.laneIndex) continue;

      if (aabb(playerHB, p.getHitbox())) {
        const ok = this.weaponSystem.tryPickup(p.weaponId);
        if (ok) p.dead = true;
      }
    }
  }

  _handleProjectiles() {
    if (!this.projectiles.length || !this.obstacles.length) return;

    for (const pr of this.projectiles) {
      if (pr.dead) continue;

      const prHB = pr.getHitbox();
      // ищем попадание в любое killable на той же полосе
      for (const o of this.obstacles) {
        if (o.dead || o.neutralized) continue;
        if (!o.isKillable()) continue;
        if (o.lane !== pr.lane) continue;

        // HAND может быть "HIDDEN" — не попадаем
        if (o.kind === "HAND" && o.state === "HIDDEN") continue;

        if (aabb(prHB, o.getHitbox())) {
          o.neutralize();
          pr.dead = true;
          break;
        }
      }
    }
  }

  _resolveRatBlocking() {
    // Если крыса перебегает в lane, где уже есть препятствие на том же "уровне",
    // отменяем перебежку (оставляем на месте).
    const rats = this.obstacles.filter(o => o.kind === "RAT" && o._moveT !== undefined && o._moveT < 1);
    if (!rats.length) return;

    for (const rat of rats) {
      const targetLane = rat._laneTo;
      if (targetLane === rat._laneFrom) continue;

      const ratHB = rat.getHitbox();

      // есть ли кто-то в targetLane, пересекающийся по Y
      const blocked = this.obstacles.some(o => {
        if (o === rat) return false;
        if (o.dead || o.neutralized) return false;
        if (o.lane !== targetLane) return false;

        const hb = o.getHitbox();
        // достаточно пересечения по вертикали (можно и AABB целиком)
        const overlapY = ratHB.y < hb.y + hb.h && ratHB.y + ratHB.h > hb.y;
        return overlapY;
      });

      if (blocked) {
        // отмена перебежки
        rat._moveT = 1;
        rat._laneTo = rat._laneFrom;
        rat.lane = rat._laneFrom;
        rat.x = this.lanes.laneCenterX(rat.lane);
      }
    }
  }

  _handleObstacleCollisions() {
    if (!this.obstacles.length) return;

    const playerHB = this._playerHitbox();

    for (const o of this.obstacles) {
      if (o.dead || o.neutralized) continue;
      if (o.lane !== this.player.laneIndex) continue;

      // HAND: опасна только когда ACTIVE (или можно сделать ACTIVE/INACTIVE)
      if (o.kind === "HAND" && o.state !== "ACTIVE") continue;

      if (!aabb(playerHB, o.getHitbox())) continue;

      if (o.kind === "HAND") {
        this.hp = 0;
        return;
      }

      // мокрый пол — эффект + небольшой урон
      if (o.kind === "WET") {
        this._applyDamage(o.cfg.damage);
        this.player.applySlide(o.cfg.slide_ms ?? CONFIG.PLAYER.SLIDE_MS);
        // мокрый пол не исчезает, но чтобы не “пилило” — i-frames
        continue;
      }

      // дверь — урон + в центр + оглушение
      if (o.kind === "DOOR") {
        this._applyDamage(o.cfg.damage);
        if (o.cfg.push_to_center) {
          // сдвигаем в центр без анимации
          this.player.laneIndex = 1;
          this.player._fromLane = 1;
          this.player._toLane = 1;
          this.player._switchT = 1;
        }
        this.player.applyStun(o.cfg.stun_ms ?? 240);
        // дверь не нейтрализуется
        continue;
      }

      // остальные — обычный урон / смерть
      const dmg = o.cfg.damage;

      if (dmg >= 9999) {
        // мгновенная смерть
        this.hp = 0;
        return;
      }

      this._applyDamage(dmg);

      // killable остаётся на месте (как тараканы/мухи),
      // но чтобы не получать несколько раз подряд — i-frames
    }
  }

  _applyDamage(amount) {
    if (this._iframesMs > 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this._iframesMs = CONFIG.PLAYER.IFRAME_MS;
  }

  _playerHitbox() {
    const size = 26;
    return {
      x: this.player.x - size / 2,
      y: this.player.y - size / 2,
      w: size,
      h: size,
    };
  }

  // --- internals ---
  _resetRun() {
    this.distanceMeters = 0;
    this.hp = CONFIG.PLAYER.HP_MAX;
    this._iframesMs = 0;

    this.speed = CONFIG.RUN.SPEED_START;

    this.player.laneIndex = 1;
    this.player._fromLane = 1;
    this.player._toLane = 1;
    this.player._switchT = 1;
    this.player.stunnedMs = 0;
    this.player.slidingMs = 0;

    this.weaponSystem.clearWeapon();
    this.obstacles.length = 0;
    this.pickups.length = 0;
    this.projectiles.length = 0;

    this.spawner.reset();
    // сразу насоздаём впереди, чтобы не было “пустоты”
    this.spawner.ensureAhead({
      obstacles: this.obstacles,
      pickups: this.pickups,
      difficulty01: 0,
      weaponEmpty: true,
    });

    this._updateHUD();
  }

  _die() {
    this.state = GAME_STATE.DEAD;
    this.input.setEnabled(false);
    this.onDead({ distanceMeters: Math.floor(this.distanceMeters) });
  }

  _updateHUD() {
    if (this.hpFillEl) {
      const pct = Math.max(0, Math.min(1, this.hp / CONFIG.PLAYER.HP_MAX));
      this.hpFillEl.style.width = `${Math.round(pct * 100)}%`;
    }
    if (this.distTextEl) {
      this.distTextEl.textContent = `${Math.floor(this.distanceMeters)} m`;
    }

    // оружие и прочность
    const w = this.weaponSystem.getWeapon();
    if (this.weaponIconEl) {
      this.weaponIconEl.src = iconForWeapon(w);
    }
    if (this.weaponDurEl) {
      this.weaponDurEl.textContent = w && w.id !== "BOTTLE" ? `${w.durability}` : "";
    }
  }

  _clear(color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
  }

  _drawCenteredText(text, sizePx, y, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#eaeaea";
    ctx.font = `700 ${sizePx}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, this.viewW / 2, y);
    ctx.restore();
  }

  _drawLanes() {
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;

    const pad = CONFIG.LANES.SIDE_PADDING;
    const innerW = w - pad * 2;
    const laneW = innerW / CONFIG.LANES.COUNT;

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(pad, 0);
    ctx.lineTo(pad, h);
    ctx.moveTo(w - pad, 0);
    ctx.lineTo(w - pad, h);
    ctx.stroke();

    ctx.globalAlpha = 0.18;
    for (let i = 1; i < CONFIG.LANES.COUNT; i++) {
      const x = pad + laneW * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function iconForWeapon(w) {
  if (!w) return "assets/sprites/ui/weapon_empty.png";
  if (w.id === "BOTTLE") return "assets/sprites/weapons/bottle.png";

  if (w.id === "SLIPPER") {
    // 3 -> 0 (новый), 2 -> 1, 1 -> 2
    const max = CONFIG.WEAPONS.SLIPPER.durability;
    const used = max - w.durability;
    const idx = Math.max(0, Math.min(2, used));
    return `assets/sprites/weapons/slipper_${idx}.png`;
  }

  if (w.id === "PAN") {
    const max = CONFIG.WEAPONS.PAN.durability;
    // max=6, сделаем 0..3 степени помятости
    const used = max - w.durability; // 0..6
    const idx = Math.max(0, Math.min(3, Math.floor((used / max) * 4)));
    return `assets/sprites/weapons/pan_${idx}.png`;
  }

  return "assets/sprites/ui/weapon_empty.png";
}
