// src/game/Spawner.js
import { CONFIG } from "../core/Config.js";
import { Obstacle } from "../entities/Obstacle.js";
import { Pickup } from "../entities/Pickup.js";

/**
 * Спавн паттернами с валидатором:
 * - в одном "ряду" (yTile) не занимать все 3 полосы
 * - тяжёлые препятствия (WET/DOOR/HAND) не ставить слишком близко по тайлам
 * - в паттерне держать минимум 1 "безопасную" полосу (предпочтительная для пикапа)
 */
export class Spawner {
  constructor({ lanes, viewH, assets = null }) {
    this.lanes = lanes;
    this.viewH = viewH;
    this.assets = assets;

    this.spawnCursorY = 0;
    this.patterns = makeBasePatterns();
  }

  setViewH(h) {
    this.viewH = h;
  }

  setAssets(assets) {
    this.assets = assets;
  }

  reset() {
    this.spawnCursorY = 0;
  }

  advance(dt, speedPxPerSec) {
    // Мир "едет вниз" (y увеличивается) — курсор спавна должен ехать так же,
    // иначе мы один раз заполним "впереди" и всё.
    this.spawnCursorY += speedPxPerSec * dt;
  }

  ensureAhead({ obstacles, pickups, difficulty01, weaponEmpty }) {
    const targetAheadY = -this.viewH * CONFIG.VIEW.SPAWN_AHEAD_SCREENS;

    while (this.spawnCursorY > targetAheadY) {
      this._spawnOnePattern({ obstacles, pickups, difficulty01, weaponEmpty });
    }
  }

  _spawnOnePattern({ obstacles, pickups, difficulty01, weaponEmpty }) {
    const tileH = CONFIG.SPAWNER.TILE_H;
    const tiles = randInt(CONFIG.SPAWNER.PATTERN_MIN_TILES, CONFIG.SPAWNER.PATTERN_MAX_TILES);
    const patternH = tiles * tileH;

    const base = this.patterns[randInt(0, this.patterns.length - 1)];

    const count = lerp(
      CONFIG.SPAWNER.OBSTACLES_PER_PATTERN_START,
      CONFIG.SPAWNER.OBSTACLES_PER_PATTERN_MAX,
      difficulty01
    );
    const obstaclesCount = Math.round(count);

    const safeLane = randInt(0, CONFIG.LANES.COUNT - 1);

    const topY = this.spawnCursorY - patternH;

    // --- ВАЛИДИРОВАННАЯ генерация списка спавнов в паттерне ---
    const placements = generateValidatedPlacements({
      base,
      tiles,
      obstaclesCount,
      safeLane,
      difficulty01,
    });

    for (const pl of placements) {
      const y = topY + pl.yTile * tileH;
      obstacles.push(
        new Obstacle({
          kind: pl.kind,
          lane: pl.lane,
          y,
          lanes: this.lanes,
          viewH: this.viewH,
          assets: this.assets,
        })
      );
    }

    // Пикап оружия: только если рука пустая
    if (weaponEmpty && Math.random() < CONFIG.PICKUPS.SPAWN_CHANCE_PER_PATTERN) {
      const lane = safeLane;
      const y = topY + tileH * randInt(1, Math.max(1, tiles - 2));
      const weaponId = randomWeaponId();

      pickups.push(
        new Pickup({
          weaponId,
          lane,
          y,
          lanes: this.lanes,
          viewH: this.viewH,
          assets: this.assets,
        })
      );
    }

    this.spawnCursorY = topY;
  }
}

function generateValidatedPlacements({ base, tiles, obstaclesCount, safeLane, difficulty01 }) {
  const MIN_GAP_HARD = CONFIG.SPAWNER.MIN_GAP_TILES_BETWEEN_HARD ?? 2;
  const hardKinds = new Set(["WET", "DOOR", "HAND"]);

  // occupancy[yTile] = Set(lanes)
  const occupancy = new Map();
  const hardRows = []; // yTile where hard placed

  const dynChance = lerp(CONFIG.SPAWNER.DYNAMIC_CHANCE_START, CONFIG.SPAWNER.DYNAMIC_CHANCE_MAX, difficulty01);

  const slots = base.slots.slice();
  shuffle(slots);

  const placements = [];

  const canPlaceAt = (lane, yTile, kind) => {
    const occ = occupancy.get(yTile) ?? new Set();

    // (4) НЕЛЬЗЯ ставить два объекта в один и тот же lane на одном yTile
    if (occ.has(lane)) return false;

    // (2.1) DOOR/HAND только на боковых
    if ((kind === "DOOR" || kind === "HAND") && lane === 1) return false;

    // 1) не занимать все 3 полосы в одном ряду
    if (!occ.has(lane) && occ.size >= CONFIG.LANES.COUNT - 1) return false;

    // 2) HAND не ставим в safeLane (чтобы гарантированно был проход)
    if (kind === "HAND" && lane === safeLane) return false;

    // 3) тяжёлые не лепить слишком близко
    if (hardKinds.has(kind)) {
      for (const r of hardRows) {
        if (Math.abs(r - yTile) < MIN_GAP_HARD) return false;
      }
    }

    return true;
  };

  const commit = (lane, yTile, kind) => {
    if (!occupancy.has(yTile)) occupancy.set(yTile, new Set());
    occupancy.get(yTile).add(lane);
    if (hardKinds.has(kind)) hardRows.push(yTile);
    placements.push({ lane, yTile, kind });
  };

  // Пытаемся набрать нужное число препятствий за несколько проходов
  // (если мало слотов / валидатор отверг — будет просто чуть “легче” паттерн)
  for (let pass = 0; pass < 3 && placements.length < obstaclesCount; pass++) {
    for (const slot of slots) {
      if (placements.length >= obstaclesCount) break;

      const yTile = clampInt(slot.yTile, 0, tiles - 1);

      // чаще оставляем safeLane свободной
      let lane = slot.lane ?? randInt(0, CONFIG.LANES.COUNT - 1);
      if (lane === safeLane && Math.random() < 0.75) lane = randLaneExcept(safeLane);

      const kind = pickKind(slot, dynChance);

      // (2.1) DOOR/HAND только на боковых: если выпало в центр — переносим на бок
      if ((kind === "DOOR" || kind === "HAND") && lane === 1) {
        lane = Math.random() < 0.5 ? 0 : 2;
      }

      if (!canPlaceAt(lane, yTile, kind)) continue;

      // и ещё: чтобы не было рядов “полностью занятых” — иногда пропускаем второй объект в ряд
      if ((occupancy.get(yTile)?.size ?? 0) === 1 && Math.random() < 0.12) continue;

      commit(lane, yTile, kind);
    }
  }

  // Финальная страховка: если вдруг возник ряд с 3 занятыми (на будущее/изменения)
  // удаляем последний добавленный в проблемном ряду
  const badRows = [];
  for (const [yTile, set] of occupancy.entries()) {
    if (set.size >= CONFIG.LANES.COUNT) badRows.push(yTile);
  }
  if (badRows.length) {
    for (const bad of badRows) {
      for (let i = placements.length - 1; i >= 0; i--) {
        if (placements[i].yTile === bad) {
          placements.splice(i, 1);
          break;
        }
      }
    }
  }

  return placements;
}

function makeBasePatterns() {
  // Только твои препятствия (без новых)
  return [
    {
      name: "simple_mix",
      slots: [
        { yTile: 1, kindPool: ["TRASH", "FLIES", "COCKROACHES"] },
        { yTile: 2, kindPool: ["WET", "TRASH"] },
        { yTile: 3, kindPool: ["FLIES", "COCKROACHES"] },
        { yTile: 5, kindPool: ["TRASH", "WET"] },
        { yTile: 6, kindPool: ["FLIES", "COCKROACHES"] },
      ],
    },
    {
      name: "dynamic_window",
      slots: [
        { yTile: 1, kindPool: ["TRASH", "WET"] },
        { yTile: 3, kindPool: ["RAT", "DOOR", "FLIES"] },
        { yTile: 4, kindPool: ["TRASH", "COCKROACHES"] },
        { yTile: 6, kindPool: ["RAT", "FLIES", "COCKROACHES"] },
      ],
    },
    {
      name: "tension_hand_rare",
      slots: [
        { yTile: 1, kindPool: ["TRASH", "WET"] },
        { yTile: 3, kindPool: ["DOOR", "RAT"] },
        { yTile: 5, kindPool: ["HAND", "RAT"] },
        { yTile: 6, kindPool: ["FLIES", "COCKROACHES"] },
      ],
    },
  ];
}

function pickKind(slot, dynChance) {
  const pool = slot.kindPool;
  const dynamic = pool.filter(k => ["RAT", "DOOR", "HAND"].includes(k));
  const staticPool = pool.filter(k => !["RAT", "DOOR", "HAND"].includes(k));

  if (dynamic.length > 0 && Math.random() < dynChance) {
    const k = dynamic[randInt(0, dynamic.length - 1)];
    // HAND ещё чуть реже
    if (k === "HAND" && Math.random() < 0.55) {
      return staticPool.length ? staticPool[randInt(0, staticPool.length - 1)] : "TRASH";
    }
    return k;
  }
  if (staticPool.length) return staticPool[randInt(0, staticPool.length - 1)];
  return pool[randInt(0, pool.length - 1)];
}

function randomWeaponId() {
  const r = Math.random();
  if (r < 0.25) return "BOTTLE";
  if (r < 0.65) return "SLIPPER";
  return "PAN";
}

function randLaneExcept(exceptLane) {
  const lanes = [0, 1, 2].filter(x => x !== exceptLane);
  return lanes[randInt(0, lanes.length - 1)];
}

function randInt(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}
function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
function clampInt(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
