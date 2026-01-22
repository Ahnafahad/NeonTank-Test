// Game constants (extracted from HTML)
export const Constants = {
  // Canvas dimensions
  GAME_WIDTH: 1000,
  GAME_HEIGHT: 700,

  // Game timing
  TARGET_FPS: 60,
  SUDDEN_DEATH_TIME: 60000, // 60 seconds in ms

  // Tank properties
  TANK_SIZE: 30,
  TANK_BASE_SPEED: 3,
  TANK_ROTATION_SPEED: 0.2,
  TANK_MAX_HEALTH: 100,
  TANK_RECOIL_DISTANCE: 2,

  // Ammo system
  MAX_AMMO: 5,
  RELOAD_DURATION: 90, // frames
  SHOOT_COOLDOWN: 15, // frames

  // Charging
  CHARGE_THRESHOLD: 30, // frames to full charge
  CHARGE_AMMO_COST: 2,
  CHARGE_DAMAGE: 30,

  // Bullet properties
  BULLET_SPEED: 7,
  BULLET_RADIUS: 4,
  BULLET_DAMAGE: 10,
  BULLET_MAX_BOUNCES: 1,
  CHARGE_BULLET_RADIUS: 8,
  CHARGE_BULLET_SPEED: 9,
  LASER_SPEED: 12,
  LASER_DAMAGE: 15,
  SHOTGUN_DAMAGE: 8,

  // Power-ups
  POWERUP_RADIUS: 12,
  POWERUP_SPAWN_INTERVAL: 5000, // ms
  POWERUP_MAX_COUNT: 3,
  POWERUP_DURATION: 600, // frames (10 seconds at 60fps)

  // Map
  WALL_HEALTH: 40,

  // Sudden Death
  SUDDEN_DEATH_INSET_SPEED: 0.2, // pixels per frame

  // Hazards
  RADIATION_DAMAGE_CHANCE: 0.1,
  RADIATION_DAMAGE: 1,

  // Particle effects
  PARTICLE_DECAY_MIN: 0.02,
  PARTICLE_DECAY_MAX: 0.05,

  // Colors
  PLAYER1_COLOR: '#ff0055',
  PLAYER2_COLOR: '#00ffff',
  BACKGROUND_COLOR: '#050505',
  GRID_COLOR: '#1a1a1a',
} as const;

// Dynamic constants (can be modified by settings)
export let GAME_SPEED: number = 1.0;
export let MAX_BOUNCES: number = Constants.BULLET_MAX_BOUNCES;
export let STARTING_HEALTH: number = Constants.TANK_MAX_HEALTH;

export function setGameSpeed(speed: number) {
  GAME_SPEED = speed;
}

export function setMaxBounces(bounces: number) {
  MAX_BOUNCES = bounces;
}

export function setStartingHealth(health: number) {
  STARTING_HEALTH = health;
}
