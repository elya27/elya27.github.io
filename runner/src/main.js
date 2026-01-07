// src/main.js
import { CONFIG } from "./core/Config.js";
import { Loop } from "./core/Loop.js";
import { Game } from "./core/Game.js";

const $ = (sel) => document.querySelector(sel);

const canvas = $("#game");
const ctx = canvas.getContext("2d", { alpha: false });

const hpFill = $("#hpFill");
const distText = $("#distText");
const weaponIcon = $("#weaponIcon");
const weaponDur = $("#weaponDur");

const screenStart = $("#screenStart");
const screenDead = $("#screenDead");
const btnStart = $("#btnStart");
const btnRetry = $("#btnRetry");
const deadDist = $("#deadDist");

function setScreen(screenEl, visible) {
  if (visible) screenEl.classList.add("visible");
  else screenEl.classList.remove("visible");
}

function preventBrowserGestures() {
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gestureend", (e) => e.preventDefault(), { passive: false });

  document.addEventListener(
    "touchmove",
    (e) => {
      // не даём странице скроллиться
      e.preventDefault();
    },
    { passive: false }
  );
}

// Создаём Game
const game = new Game({
  canvas,
  ctx,
  hpFillEl: hpFill,
  distTextEl: distText,
  weaponIconEl: weaponIcon,
  weaponDurEl: weaponDur,
  onDead: ({ distanceMeters }) => {
    deadDist.textContent = `${distanceMeters}`;
    setScreen(screenDead, true);
  },
});

// Цикл
const loop = new Loop({
  onFrame: (dt) => {
    game.update(dt);
    game.render();
  },
  maxDtMs: 34,
});

// Resize / scaling: рисуем в логических координатах CONFIG.VIEW
function resizeCanvasToScreen() {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

  const viewW = CONFIG.VIEW.W;
  const viewH = CONFIG.VIEW.H;

  const viewportW = document.documentElement.clientWidth;
  const viewportH = document.documentElement.clientHeight;

  const scale = Math.min(viewportW / viewW, viewportH / viewH);

  const cssW = Math.floor(viewW * scale);
  const cssH = Math.floor(viewH * scale);

  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;

  canvas.width = Math.floor(viewW * dpr);
  canvas.height = Math.floor(viewH * dpr);

  // Масштабируем контекст так, чтобы рисовать в логике viewW/viewH
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ctx.imageSmoothingEnabled = false;

  // Сообщаем игре её логический размер (для lane/player y)
  game.onResize(viewW, viewH);
}

function start() {
  setScreen(screenStart, false);
  setScreen(screenDead, false);
  game.startRun();
}

function boot() {
  preventBrowserGestures();
  resizeCanvasToScreen();

  // UI
  setScreen(screenStart, true);
  setScreen(screenDead, false);

  btnStart.addEventListener("click", start);
  btnRetry.addEventListener("click", start);
  screenStart.addEventListener("click", (e) => {
    if (e.target === btnStart) return;
    start();
  });

  window.addEventListener("resize", resizeCanvasToScreen);
  window.addEventListener("orientationchange", () => setTimeout(resizeCanvasToScreen, 60));

  // Запускаем цикл сразу (в меню тоже рисуем)
  loop.start();
}

if (window.vkBridge) {
  vkBridge.send("VKWebAppInit", {});
}

boot();
