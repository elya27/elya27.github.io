// src/core/Config.js
export const CONFIG = {
    // --- Canvas / view ---
    VIEW: {
      // Логическое разрешение (под вертикальный телефон)
      W: 360,
      H: 640,
  
      // Где держим игрока по Y (в процентах высоты)
      PLAYER_Y_RATIO: 0.72,
  
      // Сколько "мира" держать впереди камеры (в экранах)
      SPAWN_AHEAD_SCREENS: 2.2,
      DESPAWN_BEHIND_SCREENS: 0.8,
  
      // Debug
      DEBUG: false,
      SHOW_HITBOXES: false,
    },
  
    // --- Lanes (3 полосы) ---
    LANES: {
      COUNT: 3,
      // Отступы от краёв (в логических пикселях)
      SIDE_PADDING: 40,
      // Ширина полосы вычисляется из W и SIDE_PADDING
      // Центры полос высчитывай в LaneSystem
      SWITCH_DURATION_MS: 140, // плавный переход между полосами
      SWITCH_COOLDOWN_MS: 90,  // анти-спам переключений
    },
  
    // --- Core run ---
    RUN: {
      // Скорость - это "скорость мира вниз" (px/sec)
      SPEED_START: 180,
      SPEED_MAX: 520,
  
      // Ускорение по времени (px/sec^2), дальше ограничиваем SPEED_MAX
      SPEED_ACCEL_PER_SEC: 3.5,
  
      // Дополнительное усложнение по дистанции (мягко)
      // Каждые N метров чуть повышаем сложность спавна
      METERS_PER_DIFFICULTY_STEP: 120,
  
      // Перевод px -> meters (для HUD/баланса)
      PX_PER_METER: 42,
    },
  
    // --- Player ---
    PLAYER: {
      HP_MAX: 100,
  
      // Короткая неуязвимость после урона (чтобы не "пилило" в одном месте)
      IFRAME_MS: 380,
  
      // Оглушение (предложенный эффект)
      STUN_MS: 450,
  
      // Скольжение от мокрого пола: на это время блокируем смену полосы
      SLIDE_MS: 520,
    },
  
    // --- Obstacles parameters ---
    // Все значения урона под HP_MAX=100
    OBSTACLES: {
      // Статичные
      FLIES: {
        id: "FLIES",
        killable: true,
        dynamic: false,
        damage: 8,
      },
      COCKROACHES: {
        id: "COCKROACHES",
        killable: true,
        dynamic: false,
        damage: 10,
      },
      TRASH: {
        id: "TRASH",
        killable: false,
        dynamic: false,
        damage: 12,
        // Лёгкий "тычок" без статуса
      },
      WET: {
        id: "WET",
        killable: false,
        dynamic: false,
        damage: 9,
        // + эффект sliding
        slide_ms: 520,
      },
  
      // Динамичные
      RAT: {
        id: "RAT",
        killable: true,
        dynamic: true,
        damage: 12,
        // Когда игрок приблизился на долю экрана — крыса перебегает
        trigger_ratio: 0.33, // 1/3 экрана
        move_duration_ms: 160,
      },
  
      DOOR: {
        id: "DOOR",
        killable: false,
        dynamic: true,
        damage: 18,
        trigger_ratio: 0.50, // половина экрана
        // При ударе "сносит" игрока в центр
        push_to_center: true,
        // + чуть оглушает (чтобы ощущалось как удар дверью)
        stun_ms: 260,
      },
  
      HAND: {
        id: "HAND",
        killable: true,
        dynamic: true,
        // мгновенная смерть
        damage: 99999,
        trigger_ratio: 0.40,
        // Сколько длится активная фаза (окно, когда опасно)
        active_ms: 650,
      },
    },
  
    // --- Weapons ---
    WEAPONS: {
      // Пикапы появляются только если рука пуста
      SPAWN_ONLY_IF_EMPTY_HAND: true,
  
      BOTTLE: {
        id: "BOTTLE",
        type: "projectile",
        single_use: true,
        // Дистанция полёта в долях экрана (твой "треть экрана")
        travel_ratio: 0.33,
        speed_px_per_sec: 420,
        // При контакте нейтрализует первое killable препятствие
      },
  
      SLIPPER: {
        id: "SLIPPER",
        type: "melee",
        durability: 3,
        // зона удара: 1 "тайл" перед игроком
        // (тайл = прямоугольник шириной полосы и высотой условного тайла)
        hit_range_px: 110,
        cooldown_ms: 220,
      },
  
      PAN: {
        id: "PAN",
        type: "melee",
        durability: 6,
        hit_range_px: 110,
        cooldown_ms: 220,
      },
    },
  
    // --- Pickups spawn ---
    PICKUPS: {
      // Базовый шанс появления оружия, когда руки пусты
      // Увеличивать с ростом сложности не надо — иначе будет слишком легко
      SPAWN_CHANCE_PER_PATTERN: 0.28,
    },
  
    // --- Patterns / Spawner ---
    // Паттерны — это "кусочки коридора" с несколькими объектами.
    SPAWNER: {
      // Высота условного "тайла" по Y (для удобства паттернов)
      TILE_H: 96,
  
      // Мини/макси длина паттерна в тайлах
      PATTERN_MIN_TILES: 4,
      PATTERN_MAX_TILES: 8,
  
      // Плотность: сколько объектов в паттерне на старте и на максимальной сложности
      OBSTACLES_PER_PATTERN_START: 2,
      OBSTACLES_PER_PATTERN_MAX: 4,
  
      // Шанс динамических (крыса/дверь/рука) растёт с трудностью
      DYNAMIC_CHANCE_START: 0.18,
      DYNAMIC_CHANCE_MAX: 0.42,
  
      // Ограничения честности:
      // - никогда не ставим 3 полосы "смертельные" одновременно
      // - не ставим WET сразу перед DOOR/ HAND слишком близко
      MIN_SAFE_LANES: 1,
      MIN_GAP_TILES_BETWEEN_HARD: 2,
    },
  
    // --- Input (touch) ---
    INPUT: {
      SWIPE_MIN_DISTANCE_PX: 28,
      SWIPE_MAX_TIME_MS: 180,
  
      DOUBLE_TAP_MAX_DELAY_MS: 260,
      DOUBLE_TAP_MAX_MOVE_PX: 18,
  
      // Чтобы не ловить свайпы при микродвижениях
      TOUCH_SLOP_PX: 8,
    },
  
    // --- Animation defaults ---
    ANIM: {
      // дефолт для циклов (бег, мухи и т.п.)
      FRAME_MS: 110,
      // для "однократных" (появление руки, открытие двери)
      FRAME_MS_FAST: 90,
    },
};
  