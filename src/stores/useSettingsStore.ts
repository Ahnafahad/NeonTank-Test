import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// === Type Definitions ===
export type WeatherType = 'none' | 'rain' | 'snow' | 'fog';
export type MapVariant = 'classic' | 'maze' | 'open' | 'fortress' | 'random';
export type ColorblindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

// === GAMEPLAY Settings (10 settings) ===
export interface GameplaySettings {
  chargingEnabled: boolean;        // Charge shot mechanic
  ammoLimit: number;               // 0 = unlimited
  friendlyFire: boolean;           // Can hit yourself/teammates
  tankSpeed: number;               // 1-10 multiplier
  maxHealth: number;               // 1-5 hit points
  bulletRicochet: boolean;         // Bullets bounce off walls
  recoil: boolean;                 // Tank recoil on shoot
  gameSpeed: number;               // 0.5-2.0 game speed multiplier
  lowGravity: boolean;             // Bullets arc differently
  maxBounces: number;              // 0-5 max bullet bounces
}

// === GRAPHICS Settings (9 settings) ===
export interface GraphicsSettings {
  particlesEnabled: boolean;       // Explosion particles
  bulletTrails: boolean;           // Glowing bullet trails
  screenShakeEnabled: boolean;     // Camera shake on hit
  weather: WeatherType;            // Weather effects
  colorblindMode: ColorblindMode;  // Accessibility
  bulletTrailLength: number;       // 1-10 trail length
  screenShakeIntensity: number;    // 0-100 intensity
  particleDensity: number;         // 10-200 particle count %
  damageNumbers: boolean;          // Floating damage text
}

// === MAP Settings (6 settings) ===
export interface MapSettings {
  variant: MapVariant;             // Map layout variant
  destructibleCrates: boolean;     // Crates can be destroyed
  hazards: boolean;                // Radiation zones enabled
  suddenDeath: boolean;            // Shrinking arena
  powerUps: boolean;               // Spawn power-ups
  powerupSpawnRate: number;        // 1-20 seconds between spawns
}

// === AUDIO Settings (4 settings) ===
export interface AudioSettings {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  musicVolume: number;             // 0-100
  sfxVolume: number;               // 0-100
}

// === ADVANCED Settings (6 settings) ===
export interface AdvancedSettings {
  minimap: boolean;                // Top-down mini view
  killcam: boolean;                // Slow-mo on death
  timeLimitEnabled: boolean;       // Round timer enabled
  timeLimitSeconds: number;        // 30-300 seconds
  scoreLimitEnabled: boolean;      // First to X wins enabled
  scoreLimitValue: number;         // 1-10 rounds to win
}

// === Combined Settings Interface ===
export interface Settings {
  gameplay: GameplaySettings;
  graphics: GraphicsSettings;
  map: MapSettings;
  audio: AudioSettings;
  advanced: AdvancedSettings;
}

// === Settings Store State Interface ===
interface SettingsStore extends Settings {
  setGameplaySetting: <K extends keyof GameplaySettings>(key: K, value: GameplaySettings[K]) => void;
  setGraphicsSetting: <K extends keyof GraphicsSettings>(key: K, value: GraphicsSettings[K]) => void;
  setMapSetting: <K extends keyof MapSettings>(key: K, value: MapSettings[K]) => void;
  setAudioSetting: <K extends keyof AudioSettings>(key: K, value: AudioSettings[K]) => void;
  setAdvancedSetting: <K extends keyof AdvancedSettings>(key: K, value: AdvancedSettings[K]) => void;
  restoreDefaults: () => void;
}

// === Default Settings (35 total settings) ===
export const defaultSettings: Settings = {
  gameplay: {
    chargingEnabled: true,
    ammoLimit: 0,
    friendlyFire: false,
    tankSpeed: 5,
    maxHealth: 3,
    bulletRicochet: true,
    recoil: true,
    gameSpeed: 1.0,
    lowGravity: false,
    maxBounces: 2,
  },
  graphics: {
    particlesEnabled: true,
    bulletTrails: true,
    screenShakeEnabled: true,
    weather: 'none',
    colorblindMode: 'none',
    bulletTrailLength: 5,
    screenShakeIntensity: 50,
    particleDensity: 100,
    damageNumbers: true,
  },
  map: {
    variant: 'classic',
    destructibleCrates: true,
    hazards: true,
    suddenDeath: true,
    powerUps: true,
    powerupSpawnRate: 10,
  },
  audio: {
    musicEnabled: true,
    sfxEnabled: true,
    musicVolume: 70,
    sfxVolume: 80,
  },
  advanced: {
    minimap: false,
    killcam: true,
    timeLimitEnabled: false,
    timeLimitSeconds: 120,
    scoreLimitEnabled: true,
    scoreLimitValue: 5,
  },
};

// === Setting Constraints ===
export const SETTING_CONSTRAINTS = {
  // Gameplay
  ammoLimit: { min: 0, max: 20, step: 1 },
  tankSpeed: { min: 1, max: 10, step: 1 },
  maxHealth: { min: 1, max: 5, step: 1 },
  gameSpeed: { min: 0.5, max: 2.0, step: 0.1 },
  maxBounces: { min: 0, max: 5, step: 1 },
  // Graphics
  bulletTrailLength: { min: 1, max: 10, step: 1 },
  screenShakeIntensity: { min: 0, max: 100, step: 5 },
  particleDensity: { min: 10, max: 200, step: 10 },
  // Map
  powerupSpawnRate: { min: 1, max: 20, step: 1 },
  // Audio
  musicVolume: { min: 0, max: 100, step: 5 },
  sfxVolume: { min: 0, max: 100, step: 5 },
  // Advanced
  timeLimitSeconds: { min: 30, max: 300, step: 30 },
  scoreLimitValue: { min: 1, max: 10, step: 1 },
} as const;

// === Option Arrays for Select Inputs ===
export const WEATHER_OPTIONS: readonly WeatherType[] = ['none', 'rain', 'snow', 'fog'] as const;
export const MAP_VARIANT_OPTIONS: readonly MapVariant[] = ['classic', 'maze', 'open', 'fortress', 'random'] as const;
export const COLORBLIND_MODE_OPTIONS: readonly ColorblindMode[] = ['none', 'deuteranopia', 'protanopia', 'tritanopia'] as const;

// === Zustand Store ===
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setGameplaySetting: (key, value) =>
        set((state) => ({
          gameplay: { ...state.gameplay, [key]: value },
        })),
      setGraphicsSetting: (key, value) =>
        set((state) => ({
          graphics: { ...state.graphics, [key]: value },
        })),
      setMapSetting: (key, value) =>
        set((state) => ({
          map: { ...state.map, [key]: value },
        })),
      setAudioSetting: (key, value) =>
        set((state) => ({
          audio: { ...state.audio, [key]: value },
        })),
      setAdvancedSetting: (key, value) =>
        set((state) => ({
          advanced: { ...state.advanced, [key]: value },
        })),
      restoreDefaults: () => set(defaultSettings),
    }),
    {
      name: 'neon-tank-duel-settings',
      storage: createJSONStorage(() => localStorage),
      // Merge persisted state with defaults to handle new settings added in updates
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<Settings>;
        return {
          ...currentState,
          gameplay: { ...currentState.gameplay, ...persisted?.gameplay },
          graphics: { ...currentState.graphics, ...persisted?.graphics },
          map: { ...currentState.map, ...persisted?.map },
          audio: { ...currentState.audio, ...persisted?.audio },
          advanced: { ...currentState.advanced, ...persisted?.advanced },
        };
      },
    }
  )
);

// === Engine Settings Interface (for Game.ts) ===
export interface EngineSettings {
  // Core gameplay
  charging: boolean;
  ammoSystem: boolean;
  unlimitedAmmo: boolean;
  friendlyFire: boolean;
  bulletRicochet: boolean;
  recoil: boolean;
  gameSpeed: number;
  lowGravity: boolean;
  maxBounces: number;
  startingHealth: number;
  tankSpeed: number;

  // Map features
  powerUps: boolean;
  destructibleCrates: boolean;
  hazards: boolean;
  suddenDeath: boolean;
  mapVariant: MapVariant;
  powerupSpawnRate: number;

  // Graphics
  particleEffects: boolean;
  bulletTrails: boolean;
  bulletTrailLength: number;
  screenShake: boolean;
  screenShakeIntensity: number;
  weather: WeatherType;
  particleDensity: number;
  damageNumbers: boolean;
  colorblindMode: ColorblindMode;

  // Audio
  soundEffects: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;

  // Advanced/UI
  minimap: boolean;
  killcam: boolean;
  timeLimitEnabled: boolean;
  timeLimitSeconds: number;
  scoreLimitEnabled: boolean;
  scoreLimitValue: number;
}

/**
 * Converts the nested settings store structure to a flat object for Game.ts consumption.
 * Call this when initializing or updating the game engine.
 */
export function getGameEngineSettings(): EngineSettings {
  const state = useSettingsStore.getState();

  return {
    // Core gameplay
    charging: state.gameplay.chargingEnabled,
    ammoSystem: state.gameplay.ammoLimit > 0,
    unlimitedAmmo: state.gameplay.ammoLimit === 0,
    friendlyFire: state.gameplay.friendlyFire,
    bulletRicochet: state.gameplay.bulletRicochet,
    recoil: state.gameplay.recoil,
    gameSpeed: state.gameplay.gameSpeed,
    lowGravity: state.gameplay.lowGravity,
    maxBounces: state.gameplay.maxBounces,
    startingHealth: state.gameplay.maxHealth * 33, // Convert 1-5 hits to health points
    tankSpeed: state.gameplay.tankSpeed,

    // Map features
    powerUps: state.map.powerUps,
    destructibleCrates: state.map.destructibleCrates,
    hazards: state.map.hazards,
    suddenDeath: state.map.suddenDeath,
    mapVariant: state.map.variant,
    powerupSpawnRate: state.map.powerupSpawnRate,

    // Graphics
    particleEffects: state.graphics.particlesEnabled,
    bulletTrails: state.graphics.bulletTrails,
    bulletTrailLength: state.graphics.bulletTrailLength,
    screenShake: state.graphics.screenShakeEnabled,
    screenShakeIntensity: state.graphics.screenShakeIntensity,
    weather: state.graphics.weather,
    particleDensity: state.graphics.particleDensity,
    damageNumbers: state.graphics.damageNumbers,
    colorblindMode: state.graphics.colorblindMode,

    // Audio
    soundEffects: state.audio.sfxEnabled,
    musicEnabled: state.audio.musicEnabled,
    musicVolume: state.audio.musicVolume,
    sfxVolume: state.audio.sfxVolume,

    // Advanced/UI
    minimap: state.advanced.minimap,
    killcam: state.advanced.killcam,
    timeLimitEnabled: state.advanced.timeLimitEnabled,
    timeLimitSeconds: state.advanced.timeLimitSeconds,
    scoreLimitEnabled: state.advanced.scoreLimitEnabled,
    scoreLimitValue: state.advanced.scoreLimitValue,
  };
}

// === Selector Hooks for Setting Categories ===

/**
 * Get all gameplay settings (reactive)
 */
export const useGameplaySettings = () => useSettingsStore((state) => state.gameplay);

/**
 * Get all graphics settings (reactive)
 */
export const useGraphicsSettings = () => useSettingsStore((state) => state.graphics);

/**
 * Get all map settings (reactive)
 */
export const useMapSettings = () => useSettingsStore((state) => state.map);

/**
 * Get all audio settings (reactive)
 */
export const useAudioSettings = () => useSettingsStore((state) => state.audio);

/**
 * Get all advanced settings (reactive)
 */
export const useAdvancedSettings = () => useSettingsStore((state) => state.advanced);

// === Non-reactive Getters (for use outside React components) ===

export const getGameplaySettings = (): GameplaySettings => useSettingsStore.getState().gameplay;
export const getGraphicsSettings = (): GraphicsSettings => useSettingsStore.getState().graphics;
export const getMapSettings = (): MapSettings => useSettingsStore.getState().map;
export const getAudioSettings = (): AudioSettings => useSettingsStore.getState().audio;
export const getAdvancedSettings = (): AdvancedSettings => useSettingsStore.getState().advanced;

/**
 * Get all settings (non-reactive)
 */
export const getSettings = (): Settings => {
  const state = useSettingsStore.getState();
  return {
    gameplay: state.gameplay,
    graphics: state.graphics,
    map: state.map,
    audio: state.audio,
    advanced: state.advanced,
  };
};

// === Utility Functions ===

/**
 * Check if any settings differ from defaults
 */
export const hasCustomSettings = (): boolean => {
  const current = getSettings();
  return (
    JSON.stringify(current.gameplay) !== JSON.stringify(defaultSettings.gameplay) ||
    JSON.stringify(current.graphics) !== JSON.stringify(defaultSettings.graphics) ||
    JSON.stringify(current.map) !== JSON.stringify(defaultSettings.map) ||
    JSON.stringify(current.audio) !== JSON.stringify(defaultSettings.audio) ||
    JSON.stringify(current.advanced) !== JSON.stringify(defaultSettings.advanced)
  );
};

/**
 * Subscribe to setting changes (for non-React usage)
 * @param callback - Function to call when settings change
 * @returns Unsubscribe function
 */
export const subscribeToSettings = (
  callback: (settings: Settings) => void
): (() => void) => {
  return useSettingsStore.subscribe(() => {
    callback(getSettings());
  });
};

/**
 * Export settings as JSON string (for sharing/backup)
 */
export const exportSettings = (): string => {
  return JSON.stringify(getSettings(), null, 2);
};

/**
 * Import settings from JSON string
 * @param json - JSON string of settings
 * @returns true if successful, false if invalid
 */
export const importSettings = (json: string): boolean => {
  try {
    const parsed = JSON.parse(json) as Partial<Settings>;
    const state = useSettingsStore.getState();

    if (parsed.gameplay) {
      Object.entries(parsed.gameplay).forEach(([key, value]) => {
        state.setGameplaySetting(key as keyof GameplaySettings, value);
      });
    }
    if (parsed.graphics) {
      Object.entries(parsed.graphics).forEach(([key, value]) => {
        state.setGraphicsSetting(key as keyof GraphicsSettings, value);
      });
    }
    if (parsed.map) {
      Object.entries(parsed.map).forEach(([key, value]) => {
        state.setMapSetting(key as keyof MapSettings, value);
      });
    }
    if (parsed.audio) {
      Object.entries(parsed.audio).forEach(([key, value]) => {
        state.setAudioSetting(key as keyof AudioSettings, value);
      });
    }
    if (parsed.advanced) {
      Object.entries(parsed.advanced).forEach(([key, value]) => {
        state.setAdvancedSetting(key as keyof AdvancedSettings, value);
      });
    }

    return true;
  } catch {
    return false;
  }
};

export default useSettingsStore;
