// src/core/Input.js
import { CONFIG } from "./Config.js";

/**
 * Управление:
 * - свайп влево/вправо: смена полосы
 * - двойной тап: action
 *
 * Работает через Pointer Events (современные моб. браузеры).
 */
export class Input {
  constructor(targetEl, opts = {}) {
    this.el = targetEl;

    this.enabled = true;

    this.onSwipeLeft = opts.onSwipeLeft || (() => {});
    this.onSwipeRight = opts.onSwipeRight || (() => {});
    this.onDoubleTap = opts.onDoubleTap || (() => {});

    // pointer tracking
    this._activePointerId = null;
    this._down = null;

    // double tap
    this._lastTap = null;

    this._bind();
  }

  setEnabled(v) {
    this.enabled = !!v;
  }

  destroy() {
    this.el.removeEventListener("pointerdown", this._onPointerDown, { passive: false });
    window.removeEventListener("pointermove", this._onPointerMove, { passive: false });
    window.removeEventListener("pointerup", this._onPointerUp, { passive: false });
    window.removeEventListener("pointercancel", this._onPointerCancel, { passive: false });
  }

  _bind() {
    this._onPointerDown = (e) => {
      if (!this.enabled) return;

      // только основной палец
      if (this._activePointerId !== null) return;
      this._activePointerId = e.pointerId;

      // захват, чтобы получить up даже если палец ушёл с canvas
      try { this.el.setPointerCapture(e.pointerId); } catch {}

      const t = performance.now();
      this._down = {
        t,
        x: e.clientX,
        y: e.clientY,
        moved: false,
      };

      // чтобы браузер не пытался скроллить/выделять
      e.preventDefault();
    };

    this._onPointerMove = (e) => {
      if (!this.enabled) return;
      if (this._activePointerId !== e.pointerId) return;
      if (!this._down) return;

      const dx = e.clientX - this._down.x;
      const dy = e.clientY - this._down.y;
      const dist = Math.hypot(dx, dy);
      if (dist > CONFIG.INPUT.TOUCH_SLOP_PX) this._down.moved = true;

      e.preventDefault();
    };

    this._onPointerUp = (e) => {
      if (this._activePointerId !== e.pointerId) return;
      const down = this._down;
      this._down = null;
      this._activePointerId = null;

      if (!down || !this.enabled) return;

      const t = performance.now();
      const dt = t - down.t;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // 1) Свайп
      const swipeOk =
        dt <= CONFIG.INPUT.SWIPE_MAX_TIME_MS &&
        absX >= CONFIG.INPUT.SWIPE_MIN_DISTANCE_PX &&
        absX > absY;

      if (swipeOk) {
        if (dx < 0) this.onSwipeLeft();
        else this.onSwipeRight();
        e.preventDefault();
        return;
      }

      // 2) Тап / двойной тап
      // Тап — это "почти не двигался" и не слишком долгий
      const tapOk =
        dt <= 220 &&
        absX <= CONFIG.INPUT.DOUBLE_TAP_MAX_MOVE_PX &&
        absY <= CONFIG.INPUT.DOUBLE_TAP_MAX_MOVE_PX;

      if (!tapOk) return;

      const nowTap = { t, x: e.clientX, y: e.clientY };

      if (this._lastTap) {
        const dtt = nowTap.t - this._lastTap.t;
        const dd = Math.hypot(nowTap.x - this._lastTap.x, nowTap.y - this._lastTap.y);

        if (dtt <= CONFIG.INPUT.DOUBLE_TAP_MAX_DELAY_MS && dd <= CONFIG.INPUT.DOUBLE_TAP_MAX_MOVE_PX) {
          this._lastTap = null;
          this.onDoubleTap();
          e.preventDefault();
          return;
        }
      }

      this._lastTap = nowTap;
      // Если не пришёл второй тап — просто "сгорит" сам по времени
      window.setTimeout(() => {
        // если за время ожидания двойного тапа ничего не произошло — сброс
        if (this._lastTap && (performance.now() - this._lastTap.t) > CONFIG.INPUT.DOUBLE_TAP_MAX_DELAY_MS) {
          this._lastTap = null;
        }
      }, CONFIG.INPUT.DOUBLE_TAP_MAX_DELAY_MS + 10);
    };

    this._onPointerCancel = (e) => {
      if (this._activePointerId !== e.pointerId) return;
      this._down = null;
      this._activePointerId = null;
    };

    // Важно: passive:false чтобы работал preventDefault
    this.el.addEventListener("pointerdown", this._onPointerDown, { passive: false });
    window.addEventListener("pointermove", this._onPointerMove, { passive: false });
    window.addEventListener("pointerup", this._onPointerUp, { passive: false });
    window.addEventListener("pointercancel", this._onPointerCancel, { passive: false });
  }
}
