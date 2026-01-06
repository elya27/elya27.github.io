// src/game/Background.js
import { CONFIG } from "../core/Config.js";

/**
 * Фон коридора:
 * - центр: пол
 * - края: стены
 * - декоративные двери на стенах (НЕ препятствия)
 * - бесконечный скролл по Y через scrollY
 *
 * Работает без картинок (процедурный fallback), но если есть PNG — использует.
 */
export class Background {
  constructor({ viewW, viewH, lanes, assets = null }) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.lanes = lanes;
    this.assets = assets;

    this.scrollY = 0;

    // кеш паттернов, чтобы не пересоздавать каждый кадр
    this._patternFloor = null;
    this._patternWall = null;
    this._patternFloorKey = null;
    this._patternWallKey = null;

    // расстояние между декоративными дверями (в пикселях)
    this.doorSpacing = 190;
  }

  setAssets(assets) {
    this.assets = assets;
    this._patternFloor = null;
    this._patternWall = null;
    this._patternFloorKey = null;
    this._patternWallKey = null;
  }

  onResize(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
  }

  update(dt, speedPxPerSec) {
    this.scrollY += speedPxPerSec * dt;
  }

  render(ctx) {
    const w = this.viewW;
    const h = this.viewH;

    const pad = CONFIG.LANES.SIDE_PADDING;
    const floorX = pad;
    const floorW = w - pad * 2;

    // --- Базовые заливки ---
    // стены
    this._fillWalls(ctx, 0, 0, pad, h, w - pad, 0, pad, h);
    // пол
    this._fillFloor(ctx, floorX, 0, floorW, h);

    // --- Декоративные двери на стенах ---
    this._drawDecorDoors(ctx);

    // NEW: затемнение стен
    this._darkenWalls(ctx);

    // внутренняя тень у границы коридора (как было)
    this._drawWallShadows(ctx);

    // общий стиль
    this._drawVignette(ctx);

    // --- Лёгкие разделители полос (как декор, не обязательно) ---
    this._drawLaneSeparators(ctx);
  }

  _fillFloor(ctx, x, y, w, h) {
    // Если есть floor tile — используем createPattern
    const img = this.assets?.getImage?.("bg_floor");
    if (img) {
      const key = "bg_floor";
      if (!this._patternFloor || this._patternFloorKey !== key) {
        this._patternFloor = ctx.createPattern(img, "repeat");
        this._patternFloorKey = key;
      }

      ctx.save();
      // смещение паттерна по скроллу: чтобы “ехал” вниз
      const off = ((Math.floor(this.scrollY) % img.height) + img.height) % img.height;
      ctx.translate(0, off);
      ctx.fillStyle = this._patternFloor;
      ctx.fillRect(x, y - img.height, w, h + img.height * 2);
      ctx.restore();
      return;
    }

    // Процедурный fallback: плитка/грязь
    ctx.save();
    ctx.fillStyle = "#141414";
    ctx.fillRect(x, y, w, h);

    const tileH = 64;
    const offset = this.scrollY % tileH;

    for (let yy = -tileH; yy < h + tileH; yy += tileH) {
      const rowY = yy + offset;
      // “швы” плитки
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, rowY, w, 1);

      // пятна/грязь (простые прямоугольники)
      const seed = hashInt(Math.floor((this.scrollY + rowY) / tileH));
      const spots = 2 + (seed % 3);
      for (let i = 0; i < spots; i++) {
        const sx = x + 10 + ((hashInt(seed + i * 17) % 1000) / 1000) * (w - 20);
        const sw = 10 + (hashInt(seed + i * 31) % 22);
        const sh = 6 + (hashInt(seed + i * 47) % 14);
        const sy = rowY + 10 + (hashInt(seed + i * 53) % 36);
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = "#000000";
        ctx.fillRect(sx, sy, sw, sh);
      }
    }

    ctx.restore();
  }

  _fillWalls(ctx, lx, ly, lw, lh, rx, ry, rw, rh) {
    const img = this.assets?.getImage?.("bg_wall");
    if (img) {
      const key = "bg_wall";
      if (!this._patternWall || this._patternWallKey !== key) {
        this._patternWall = ctx.createPattern(img, "repeat");
        this._patternWallKey = key;
      }
      ctx.save();
      // this.scrollY * 0.9 для эффекта параллакса
      const off = ((Math.floor(this.scrollY) % img.height) + img.height) % img.height;
      ctx.translate(0, off);
      ctx.fillStyle = this._patternWall;
      ctx.fillRect(lx, ly - img.height, lw, lh + img.height * 2);
      ctx.fillRect(rx, ry - img.height, rw, rh + img.height * 2);
      ctx.restore();
      return;
    }

    // Процедурные стены
    ctx.save();
    ctx.fillStyle = "#101010";
    ctx.fillRect(lx, ly, lw, lh);
    ctx.fillRect(rx, ry, rw, rh);

    // вертикальные полосы/потёртости
    const stripeW = 6;
    const offset = this.scrollY % 48;
    for (let yy = -48; yy < lh + 48; yy += 48) {
      const y0 = yy + offset;
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(lx + lw - stripeW, y0, stripeW, 18);
      ctx.fillRect(rx, y0 + 12, stripeW, 18);

      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "#000000";
      ctx.fillRect(lx + 8, y0 + 24, lw - 16, 6);
      ctx.fillRect(rx + 8, y0 + 30, rw - 16, 6);
    }

    ctx.restore();
  }

  _drawDecorDoors(ctx) {
    const pad = CONFIG.LANES.SIDE_PADDING;
    const doorW = Math.max(16, Math.floor(pad * 0.72));
    const doorH = 76;

    // сколько дверей помещается на экране + запас
    const count = Math.ceil((this.viewH + this.doorSpacing * 2) / this.doorSpacing);

    // позиционируем по scrollY так, чтобы двери “ехали”
    const offset = this.scrollY % this.doorSpacing;

    for (let i = -1; i < count; i++) {
      const y = i * this.doorSpacing + offset - 40;

      // выбираем сторону детерминированно по индексу “сегмента”
      const seg = Math.floor((this.scrollY - y) / this.doorSpacing);
      const r = hashInt(seg);
      const side = (r % 2 === 0) ? "L" : "R";

      const x = side === "L"
        ? Math.floor(pad - doorW - 2)
        : Math.floor(this.viewW - pad + 2);

      // дверь — декоративная: прямоугольник + рамка + ручка
      ctx.save();
      ctx.globalAlpha = 0.30;

      // “проекционная” тень от дверной ниши
      ctx.fillStyle = "#000000";
      if (side === "L") ctx.fillRect(x + doorW, y + 6, 6, doorH - 12);
      else ctx.fillRect(x - 6, y + 6, 6, doorH - 12);

      // сама дверь
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(x, y, doorW, doorH);

      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, doorW - 2, doorH - 2);

      // ручка
      ctx.globalAlpha = 0.30;
      ctx.fillStyle = "#d0d0d0";
      const knobY = y + Math.floor(doorH * 0.55);
      if (side === "L") ctx.fillRect(x + doorW - 6, knobY, 3, 2);
      else ctx.fillRect(x + 3, knobY, 3, 2);

      ctx.restore();
    }
  }

  _drawLaneSeparators(ctx) {
    const w = this.viewW;
    const h = this.viewH;

    const pad = CONFIG.LANES.SIDE_PADDING;
    const innerW = w - pad * 2;
    const laneW = innerW / CONFIG.LANES.COUNT;

    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;

    // границы коридора
    ctx.beginPath();
    ctx.moveTo(pad, 0);
    ctx.lineTo(pad, h);
    ctx.moveTo(w - pad, 0);
    ctx.lineTo(w - pad, h);
    ctx.stroke();

    // разделители
    ctx.globalAlpha = 0.07;
    for (let i = 1; i < CONFIG.LANES.COUNT; i++) {
      const x = pad + laneW * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawWallShadows(ctx) {
    const pad = CONFIG.LANES.SIDE_PADDING;

    ctx.save();
    // тёмные края у стен (создаёт “глубину”)
    ctx.globalAlpha = 0.35;
    const gradL = ctx.createLinearGradient(pad, 0, pad + 28, 0);
    gradL.addColorStop(0, "rgba(0,0,0,0.55)");
    gradL.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradL;
    ctx.fillRect(pad, 0, 30, this.viewH);

    const gradR = ctx.createLinearGradient(this.viewW - pad, 0, this.viewW - pad - 28, 0);
    gradR.addColorStop(0, "rgba(0,0,0,0.55)");
    gradR.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradR;
    ctx.fillRect(this.viewW - pad - 30, 0, 30, this.viewH);
    ctx.restore();
  }

  _darkenWalls(ctx) {
    const pad = CONFIG.LANES.SIDE_PADDING;
    const h = this.viewH;
    const w = this.viewW;

    ctx.save();

    // 1) Горизонтальный градиент по каждой стене:
    // снаружи (у края экрана) темнее, к коридору — светлее
    const left = ctx.createLinearGradient(0, 0, pad, 0);
    left.addColorStop(0.00, "rgba(0,0,0,0.0)");
    left.addColorStop(0.80, "rgba(0,0,0,0.05)");
    left.addColorStop(1.00, "rgba(0,0,0,0.30)");

    const right = ctx.createLinearGradient(w, 0, w - pad, 0);
    right.addColorStop(0.00, "rgba(0,0,0,0.0)");
    right.addColorStop(0.80, "rgba(0,0,0,0.05)");
    right.addColorStop(1.00, "rgba(0,0,0,0.30)");

    ctx.fillStyle = left;
    ctx.fillRect(0, 0, pad, h);

    ctx.fillStyle = right;
    ctx.fillRect(w - pad, 0, pad, h);

    // 2) Вертикальная “грязная” засветка: верх/низ чуть темнее (как в реальном коридоре)
    const v = ctx.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0.00, "rgba(0,0,0,0.28)");
    v.addColorStop(0.35, "rgba(0,0,0,0.05)");
    v.addColorStop(0.75, "rgba(0,0,0,0.08)");
    v.addColorStop(1.00, "rgba(0,0,0,0.26)");

    ctx.fillStyle = v;
    ctx.fillRect(0, 0, pad, h);
    ctx.fillRect(w - pad, 0, pad, h);

    // 3) Лёгкое затемнение углов стен (добавляет “объём”)
    ctx.globalAlpha = 0.55;
    const r1 = ctx.createRadialGradient(pad * 0.55, h * 0.35, 10, pad * 0.55, h * 0.35, h * 0.65);
    r1.addColorStop(0, "rgba(0,0,0,0)");
    r1.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = r1;
    ctx.fillRect(0, 0, pad, h);

    const r2 = ctx.createRadialGradient(w - pad * 0.55, h * 0.35, 10, w - pad * 0.55, h * 0.35, h * 0.65);
    r2.addColorStop(0, "rgba(0,0,0,0)");
    r2.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = r2;
    ctx.fillRect(w - pad, 0, pad, h);

    ctx.restore();
  }

  _drawVignette(ctx) {
    ctx.save();
    // легкая виньетка (только стиль)
    const g = ctx.createRadialGradient(
      this.viewW / 2, this.viewH * 0.6, 60,
      this.viewW / 2, this.viewH * 0.6, this.viewH * 0.95
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.restore();
  }
}

function hashInt(n) {
  // простой детерминированный хеш
  let x = n | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}
