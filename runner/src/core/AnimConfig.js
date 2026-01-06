// src/core/AnimConfig.js
import { CONFIG } from "./Config.js";

/**
 * Правило: каждый спрайт-лист — одна строка кадров.
 * frames = индексы кадров по X.
 */
export const ANIM = {
  player: {
    run:   { sheet: "player_run",  frames: [0, 1, 2, 3], frameMs: CONFIG.ANIM.FRAME_MS, loop: true },
    stun:  { sheet: "player_stun", frames: [0, 1],       frameMs: 130,                  loop: true },
    // dead добавим позже, когда появится логика смерти с анимацией
  },

  obstacles: {
    // с анимацией
    FLIES:        { sheet: "obs_flies",   frames: [0, 1, 2, 3, 4], frameMs: 100, loop: true },
    COCKROACHES:  { sheet: "obs_roaches", frames: [0, 1, 2, 3, 4], frameMs: 110, loop: true },
    RAT:          { sheet: "obs_rat",     frames: [0, 1],          frameMs: 240, loop: true },

    // статичные
    TRASH:        { sheet: "obs_trash",   frames: [0, 1, 2, 3, 4, 5, 6, 7], frameMs: 999, loop: true, randomStatic: true },
    WET:          { sheet: "obs_wet",     frames: [0, 1, 2],                frameMs: 999, loop: true, randomStatic: true },

    // DOOR: разные состояния
    DOOR_CLOSED:  { sheet: "obs_door",    frames: [0],       frameMs: 999, loop: true },
    DOOR_OPENING: { sheet: "obs_door",    frames: [0, 1, 2], frameMs: CONFIG.ANIM.FRAME_MS_FAST, loop: false },
    DOOR_OPEN:    { sheet: "obs_door",    frames: [2],       frameMs: 999, loop: true },

    // HAND: скрыта / активна / неактивна
    HAND_ACTIVE:  { sheet: "obs_hand",    frames: [0, 1, 2], frameMs: 90,  loop: true },
    HAND_INACTIVE:{ sheet: "obs_hand",    frames: [0],       frameMs: 999, loop: true },
  },
};
