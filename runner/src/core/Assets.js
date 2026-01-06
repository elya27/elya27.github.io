// src/core/Assets.js
export class Assets {
    constructor(manifest = {}) {
      this.manifest = manifest; // { key: { src } }
      this.images = new Map();  // key -> HTMLImageElement
      this.status = new Map();  // key -> "loading"|"ready"|"error"
    }
  
    preloadAll() {
      for (const key of Object.keys(this.manifest)) {
        this.loadImage(key);
      }
    }
  
    loadImage(key) {
      if (this.status.get(key) === "loading" || this.status.get(key) === "ready") return;
  
      const item = this.manifest[key];
      if (!item?.src) return;
  
      const img = new Image();
      this.images.set(key, img);
      this.status.set(key, "loading");
  
      img.onload = () => this.status.set(key, "ready");
      img.onerror = () => this.status.set(key, "error");
      img.src = item.src;
    }
  
    getImage(key) {
      if (this.status.get(key) !== "ready") return null;
      return this.images.get(key) ?? null;
    }
  }
  