// Settings type definitions for Neon Tank Duel

// === Weather Types ===
export type WeatherType = 'none' | 'rain' | 'snow' | 'fog';

// === Map Variant Types ===
export type MapVariant = 'classic' | 'maze' | 'open' | 'fortress' | 'random';

// === Colorblind Mode Types ===
export type ColorblindMode = 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';

// === Setting Categories ===
export interface VisualEffectsSettings {
  bulletTrails: boolean;
  bulletTrailLength: number;
  screenShake: boolean;
  screenShakeIntensity: number;
  weather: WeatherType;
  particleDensity: number;
  damageNumbers: boolean;
  particleEffects: boolean;
}

export interface GameplayModSettings {
  friendlyFire: boolean;
  gameSpeed: number;
  unlimitedAmmo: boolean;
  lowGravity: boolean;
  maxBounces: number;
  startingHealth: number;
  charging: boolean;
  ammoSystem: boolean;
  bulletRicochet: boolean;
  recoil: boolean;
}

export interface MapGameplaySettings {
  mapVariant: MapVariant;
  powerupSpawnRate: number;
  timeLimitEnabled: boolean;
  timeLimitSeconds: number;
  scoreLimitEnabled: boolean;
  scoreLimitValue: number;
  powerUps: boolean;
  destructibleCrates: boolean;
  hazards: boolean;
  suddenDeath: boolean;
}

export interface AudioSettings {
  soundEffects: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
}

export interface AccessibilitySettings {
  colorblindMode: ColorblindMode;
  minimap: boolean;
  killcam: boolean;
}

// === Main Game Settings Interface ===
export interface GameSettings {
  // === EXISTING FEATURES (10) ===
  charging: boolean;              // Charge shot mechanic
  ammoSystem: boolean;            // Ammo & reload
  powerUps: boolean;              // Spawn power-ups
  destructibleCrates: boolean;    // Crates can be destroyed
  hazards: boolean;               // Radiation zones
  suddenDeath: boolean;           // Sudden death mode
  bulletRicochet: boolean;        // Bullets bounce
  recoil: boolean;                // Tank recoil on shoot
  particleEffects: boolean;       // Explosion particles
  soundEffects: boolean;          // Audio enabled

  // === NEW FEATURES (20+) ===

  // VISUAL EFFECTS
  bulletTrails: boolean;          // Glowing trails
  bulletTrailLength: number;      // 1-10 frames
  screenShake: boolean;           // Camera shake on hit
  screenShakeIntensity: number;   // 0-100%
  weather: WeatherType;
  particleDensity: number;        // 10-200% count
  damageNumbers: boolean;         // Floating damage text

  // GAMEPLAY MODS
  friendlyFire: boolean;          // Can hit yourself
  gameSpeed: number;              // 0.5 - 2.0 multiplier
  unlimitedAmmo: boolean;         // No reload
  lowGravity: boolean;            // Bullets arc
  maxBounces: number;             // 0-5 bounces
  startingHealth: number;         // 50-200 HP

  // MAP & GAMEPLAY
  mapVariant: MapVariant;
  powerupSpawnRate: number;       // 1-20 seconds
  timeLimitEnabled: boolean;      // Round timer
  timeLimitSeconds: number;       // 30-300s
  scoreLimitEnabled: boolean;     // First to X wins
  scoreLimitValue: number;        // 1-10 rounds

  // EXTRA FEATURES
  minimap: boolean;               // Top-down mini view
  killcam: boolean;               // Slow-mo on death
  musicEnabled: boolean;          // Background music
  musicVolume: number;            // 0-100%
  sfxVolume: number;              // 0-100%
  colorblindMode: ColorblindMode;
}

// === Settings Store State Interface ===
export interface SettingsState extends GameSettings {
  // Actions
  updateSetting: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => void;
  resetToDefaults: () => void;

  // Batch update action
  updateSettings: (settings: Partial<GameSettings>) => void;
}

// === Setting Metadata for UI ===
export interface SettingMetadata<T = unknown> {
  key: keyof GameSettings;
  label: string;
  description: string;
  category: SettingCategory;
  type: 'boolean' | 'number' | 'select';
  defaultValue: T;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly T[];
}

export type SettingCategory =
  | 'visual'
  | 'gameplay'
  | 'map'
  | 'audio'
  | 'accessibility';

// === Default Values Export ===
export const DEFAULT_SETTINGS: GameSettings = {
  // Existing features (mostly ON)
  charging: true,
  ammoSystem: true,
  powerUps: true,
  destructibleCrates: true,
  hazards: true,
  suddenDeath: true,
  bulletRicochet: true,
  recoil: true,
  particleEffects: true,
  soundEffects: true,

  // Visual effects
  bulletTrails: true,
  bulletTrailLength: 5,
  screenShake: true,
  screenShakeIntensity: 50,
  weather: 'none',
  particleDensity: 100,
  damageNumbers: true,

  // Gameplay mods
  friendlyFire: false,
  gameSpeed: 1.0,
  unlimitedAmmo: false,
  lowGravity: false,
  maxBounces: 2,
  startingHealth: 100,

  // Map & gameplay
  mapVariant: 'classic',
  powerupSpawnRate: 10,
  timeLimitEnabled: false,
  timeLimitSeconds: 120,
  scoreLimitEnabled: true,
  scoreLimitValue: 5,

  // Extra features
  minimap: false,
  killcam: true,
  musicEnabled: true,
  musicVolume: 70,
  sfxVolume: 80,
  colorblindMode: 'none',
};

// === Setting Constraints ===
export const SETTING_CONSTRAINTS = {
  bulletTrailLength: { min: 1, max: 10, step: 1 },
  screenShakeIntensity: { min: 0, max: 100, step: 5 },
  particleDensity: { min: 10, max: 200, step: 10 },
  gameSpeed: { min: 0.5, max: 2.0, step: 0.1 },
  maxBounces: { min: 0, max: 5, step: 1 },
  startingHealth: { min: 50, max: 200, step: 10 },
  powerupSpawnRate: { min: 1, max: 20, step: 1 },
  timeLimitSeconds: { min: 30, max: 300, step: 30 },
  scoreLimitValue: { min: 1, max: 10, step: 1 },
  musicVolume: { min: 0, max: 100, step: 5 },
  sfxVolume: { min: 0, max: 100, step: 5 },
} as const;

// === Option Arrays for Select Inputs ===
export const WEATHER_OPTIONS: readonly WeatherType[] = ['none', 'rain', 'snow', 'fog'] as const;
export const MAP_VARIANT_OPTIONS: readonly MapVariant[] = ['classic', 'maze', 'open', 'fortress', 'random'] as const;
export const COLORBLIND_MODE_OPTIONS: readonly ColorblindMode[] = ['none', 'deuteranopia', 'protanopia', 'tritanopia'] as const;
