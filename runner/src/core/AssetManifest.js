// src/core/AssetManifest.js
export const MANIFEST = {
    // Player sheets (по 2–4 кадра в строке)
    "player_run":    { src: "assets/sprites/player/run.png", frameW: 64, frameH: 64 },
    "player_stun":   { src: "assets/sprites/player/stunned.png", frameW: 64, frameH: 64 },
  
    // Obstacles
    "obs_flies":     { src: "assets/sprites/obstacles/flies.png", frameW: 88, frameH: 88 },
    "obs_roaches":   { src: "assets/sprites/obstacles/cockroaches.png", frameW: 88, frameH: 88 },
    "obs_trash":     { src: "assets/sprites/obstacles/trash.png", frameW: 92, frameH: 92 },
    "obs_wet":       { src: "assets/sprites/obstacles/wet.png", frameW: 97, frameH: 80 },
    "obs_rat":       { src: "assets/sprites/obstacles/rat.png", frameW: 97, frameH: 97 },
    "obs_door_l":    { src: "assets/sprites/obstacles/door_left.png", frameW: 64, frameH: 64 },
    "obs_door_r":    { src: "assets/sprites/obstacles/door_right.png", frameW: 64, frameH: 64 },
    "obs_hand_l":    { src: "assets/sprites/obstacles/hand_left.png", frameW: 64, frameH: 64 },
    "obs_hand_r":    { src: "assets/sprites/obstacles/hand_right.png", frameW: 64, frameH: 64 },

    // Background (опционально, можно не иметь этих PNG — fallback отрисует сам)
    "bg_floor":      { src: "assets/sprites/bg/floor128.png", frameW: 128, frameH: 128 },
    "bg_wall":       { src: "assets/sprites/bg/wall64x128.png",  frameW: 64, frameH: 128 },

  };
  