// src/core/SpriteSheet.js
/**
 * SpriteSheet: одно изображение со строкой кадров:
 * frame 0..N-1, одинаковые размеры frameW x frameH.
 */
 export class SpriteSheet {
    constructor({ image, frameW, frameH }) {
      this.image = image;
      this.frameW = frameW;
      this.frameH = frameH;
    }
  
    drawFrame(ctx, frameIndex, x, y, scale = 1) {
      if (!this.image) return;
  
      const sx = frameIndex * this.frameW;
      const sy = 0;
  
      const dw = this.frameW * scale;
      const dh = this.frameH * scale;
  
      ctx.drawImage(
        this.image,
        sx, sy, this.frameW, this.frameH,
        Math.floor(x - dw / 2), Math.floor(y - dh / 2),
        Math.floor(dw), Math.floor(dh)
      );
    }
  }
  