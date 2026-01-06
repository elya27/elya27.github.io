// src/core/Animator.js
/**
 * Animator: управляет кадрами анимации.
 */
 export class Animator {
    constructor({ frames = [0], frameMs = 120, loop = true } = {}) {
      this.frames = frames;
      this.frameMs = frameMs;
      this.loop = loop;
  
      this.timeMs = 0;
      this.index = 0;
      this.done = false;
    }
  
    reset() {
      this.timeMs = 0;
      this.index = 0;
      this.done = false;
    }
  
    setAnim({ frames, frameMs, loop }) {
      const changed =
        frames !== this.frames ||
        frameMs !== this.frameMs ||
        loop !== this.loop;
  
      if (changed) {
        this.frames = frames ?? this.frames;
        this.frameMs = frameMs ?? this.frameMs;
        this.loop = loop ?? this.loop;
        this.reset();
      }
    }
  
    update(dt) {
      if (this.done) return;
      this.timeMs += dt * 1000;
  
      while (this.timeMs >= this.frameMs && !this.done) {
        this.timeMs -= this.frameMs;
        this.index++;
  
        if (this.index >= this.frames.length) {
          if (this.loop) {
            this.index = 0;
          } else {
            this.index = this.frames.length - 1;
            this.done = true;
          }
        }
      }
    }
  
    frame() {
      return this.frames[this.index] ?? this.frames[0] ?? 0;
    }
  }
  