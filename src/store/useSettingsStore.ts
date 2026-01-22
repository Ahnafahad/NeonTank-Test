'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  GameSettings,
  SettingsState,
  VisualEffectsSettings,
  GameplayModSettings,
  MapGameplaySettings,
  AudioSettings,
  AccessibilitySettings,
  DEFAULT_SETTINGS,
} from '../types/settings';

// Re-export types for convenience
export type {
  GameSettings,
  SettingsState,
  VisualEffectsSettings,
  GameplayModSettings,
  MapGameplaySettings,
  AudioSettings,
  AccessibilitySettings,
} from '../types/settings';

export { DEFAULT_SETTINGS } from '../types/settings';

/**
 * Zustand settings store with localStorage persistence
 * Manages all game settings for Neon Tank Duel
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // === SPREAD ALL DEFAULT SETTINGS ===
      ...DEFAULT_SETTINGS,

      // === ACTIONS ===

      /**
       * Update a single setting by key
       * @param key - The setting key to update
       * @param value - The new value for the setting
       */
      updateSetting: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
        set({ [key]: value } as Partial<GameSettings>);
      },

      /**
       * Reset all settings to their default values
       */
      resetToDefaults: () => {
        set(DEFAULT_SETTINGS);
      },

      /**
       * Update multiple settings at once
       * @param settings - Partial settings object to merge
       */
      updateSettings: (settings: Partial<GameSettings>) => {
        set(settings);
      },
    }),
    {
      name: 'neon-tank-duel-settings',
      storage: createJSONStorage(() => localStorage),
      // Only persist the settings values, not the actions
      partialize: (state) => ({
        charging: state.charging,
        ammoSystem: state.ammoSystem,
        powerUps: state.powerUps,
        destructibleCrates: state.destructibleCrates,
        hazards: state.hazards,
        suddenDeath: state.suddenDeath,
        bulletRicochet: state.bulletRicochet,
        recoil: state.recoil,
        particleEffects: state.particleEffects,
        soundEffects: state.soundEffects,
        bulletTrails: state.bulletTrails,
        bulletTrailLength: state.bulletTrailLength,
        screenShake: state.screenShake,
        screenShakeIntensity: state.screenShakeIntensity,
        weather: state.weather,
        particleDensity: state.particleDensity,
        damageNumbers: state.damageNumbers,
        friendlyFire: state.friendlyFire,
        gameSpeed: state.gameSpeed,
        unlimitedAmmo: state.unlimitedAmmo,
        lowGravity: state.lowGravity,
        maxBounces: state.maxBounces,
        startingHealth: state.startingHealth,
        mapVariant: state.mapVariant,
        powerupSpawnRate: state.powerupSpawnRate,
        timeLimitEnabled: state.timeLimitEnabled,
        timeLimitSeconds: state.timeLimitSeconds,
        scoreLimitEnabled: state.scoreLimitEnabled,
        scoreLimitValue: state.scoreLimitValue,
        minimap: state.minimap,
        killcam: state.killcam,
        musicEnabled: state.musicEnabled,
        musicVolume: state.musicVolume,
        sfxVolume: state.sfxVolume,
        colorblindMode: state.colorblindMode,
      }),
      // Merge persisted state with defaults to handle new settings added in updates
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<GameSettings>),
      }),
    }
  )
);

// === SELECTOR HOOKS FOR SETTING CATEGORIES ===

/**
 * Get all visual effects settings
 */
export const useVisualEffectsSettings = (): VisualEffectsSettings => {
  return useSettingsStore((state) => ({
    bulletTrails: state.bulletTrails,
    bulletTrailLength: state.bulletTrailLength,
    screenShake: state.screenShake,
    screenShakeIntensity: state.screenShakeIntensity,
    weather: state.weather,
    particleDensity: state.particleDensity,
    damageNumbers: state.damageNumbers,
    particleEffects: state.particleEffects,
  }));
};

/**
 * Get all gameplay mod settings
 */
export const useGameplayModSettings = (): GameplayModSettings => {
  return useSettingsStore((state) => ({
    friendlyFire: state.friendlyFire,
    gameSpeed: state.gameSpeed,
    unlimitedAmmo: state.unlimitedAmmo,
    lowGravity: state.lowGravity,
    maxBounces: state.maxBounces,
    startingHealth: state.startingHealth,
    charging: state.charging,
    ammoSystem: state.ammoSystem,
    bulletRicochet: state.bulletRicochet,
    recoil: state.recoil,
  }));
};

/**
 * Get all map and gameplay settings
 */
export const useMapGameplaySettings = (): MapGameplaySettings => {
  return useSettingsStore((state) => ({
    mapVariant: state.mapVariant,
    powerupSpawnRate: state.powerupSpawnRate,
    timeLimitEnabled: state.timeLimitEnabled,
    timeLimitSeconds: state.timeLimitSeconds,
    scoreLimitEnabled: state.scoreLimitEnabled,
    scoreLimitValue: state.scoreLimitValue,
    powerUps: state.powerUps,
    destructibleCrates: state.destructibleCrates,
    hazards: state.hazards,
    suddenDeath: state.suddenDeath,
  }));
};

/**
 * Get all audio settings
 */
export const useAudioSettings = (): AudioSettings => {
  return useSettingsStore((state) => ({
    soundEffects: state.soundEffects,
    musicEnabled: state.musicEnabled,
    musicVolume: state.musicVolume,
    sfxVolume: state.sfxVolume,
  }));
};

/**
 * Get all accessibility settings
 */
export const useAccessibilitySettings = (): AccessibilitySettings => {
  return useSettingsStore((state) => ({
    colorblindMode: state.colorblindMode,
    minimap: state.minimap,
    killcam: state.killcam,
  }));
};

// === NON-HOOK GETTERS (for use outside React components) ===

/**
 * Get all current settings (non-reactive)
 */
export const getSettings = (): GameSettings => {
  const state = useSettingsStore.getState();
  return {
    charging: state.charging,
    ammoSystem: state.ammoSystem,
    powerUps: state.powerUps,
    destructibleCrates: state.destructibleCrates,
    hazards: state.hazards,
    suddenDeath: state.suddenDeath,
    bulletRicochet: state.bulletRicochet,
    recoil: state.recoil,
    particleEffects: state.particleEffects,
    soundEffects: state.soundEffects,
    bulletTrails: state.bulletTrails,
    bulletTrailLength: state.bulletTrailLength,
    screenShake: state.screenShake,
    screenShakeIntensity: state.screenShakeIntensity,
    weather: state.weather,
    particleDensity: state.particleDensity,
    damageNumbers: state.damageNumbers,
    friendlyFire: state.friendlyFire,
    gameSpeed: state.gameSpeed,
    unlimitedAmmo: state.unlimitedAmmo,
    lowGravity: state.lowGravity,
    maxBounces: state.maxBounces,
    startingHealth: state.startingHealth,
    mapVariant: state.mapVariant,
    powerupSpawnRate: state.powerupSpawnRate,
    timeLimitEnabled: state.timeLimitEnabled,
    timeLimitSeconds: state.timeLimitSeconds,
    scoreLimitEnabled: state.scoreLimitEnabled,
    scoreLimitValue: state.scoreLimitValue,
    minimap: state.minimap,
    killcam: state.killcam,
    musicEnabled: state.musicEnabled,
    musicVolume: state.musicVolume,
    sfxVolume: state.sfxVolume,
    colorblindMode: state.colorblindMode,
  };
};

/**
 * Get visual effects settings (non-reactive)
 */
export const getVisualEffectsSettings = (): VisualEffectsSettings => {
  const state = useSettingsStore.getState();
  return {
    bulletTrails: state.bulletTrails,
    bulletTrailLength: state.bulletTrailLength,
    screenShake: state.screenShake,
    screenShakeIntensity: state.screenShakeIntensity,
    weather: state.weather,
    particleDensity: state.particleDensity,
    damageNumbers: state.damageNumbers,
    particleEffects: state.particleEffects,
  };
};

/**
 * Get gameplay mod settings (non-reactive)
 */
export const getGameplayModSettings = (): GameplayModSettings => {
  const state = useSettingsStore.getState();
  return {
    friendlyFire: state.friendlyFire,
    gameSpeed: state.gameSpeed,
    unlimitedAmmo: state.unlimitedAmmo,
    lowGravity: state.lowGravity,
    maxBounces: state.maxBounces,
    startingHealth: state.startingHealth,
    charging: state.charging,
    ammoSystem: state.ammoSystem,
    bulletRicochet: state.bulletRicochet,
    recoil: state.recoil,
  };
};

/**
 * Get map and gameplay settings (non-reactive)
 */
export const getMapGameplaySettings = (): MapGameplaySettings => {
  const state = useSettingsStore.getState();
  return {
    mapVariant: state.mapVariant,
    powerupSpawnRate: state.powerupSpawnRate,
    timeLimitEnabled: state.timeLimitEnabled,
    timeLimitSeconds: state.timeLimitSeconds,
    scoreLimitEnabled: state.scoreLimitEnabled,
    scoreLimitValue: state.scoreLimitValue,
    powerUps: state.powerUps,
    destructibleCrates: state.destructibleCrates,
    hazards: state.hazards,
    suddenDeath: state.suddenDeath,
  };
};

/**
 * Get audio settings (non-reactive)
 */
export const getAudioSettings = (): AudioSettings => {
  const state = useSettingsStore.getState();
  return {
    soundEffects: state.soundEffects,
    musicEnabled: state.musicEnabled,
    musicVolume: state.musicVolume,
    sfxVolume: state.sfxVolume,
  };
};

/**
 * Get accessibility settings (non-reactive)
 */
export const getAccessibilitySettings = (): AccessibilitySettings => {
  const state = useSettingsStore.getState();
  return {
    colorblindMode: state.colorblindMode,
    minimap: state.minimap,
    killcam: state.killcam,
  };
};

// === UTILITY FUNCTIONS ===

/**
 * Check if any settings differ from defaults
 */
export const hasCustomSettings = (): boolean => {
  const current = getSettings();
  return Object.keys(DEFAULT_SETTINGS).some(
    (key) => current[key as keyof GameSettings] !== DEFAULT_SETTINGS[key as keyof GameSettings]
  );
};

/**
 * Get a list of settings that differ from defaults
 */
export const getModifiedSettings = (): Partial<GameSettings> => {
  const current = getSettings();
  const modified: Partial<GameSettings> = {};

  (Object.keys(DEFAULT_SETTINGS) as Array<keyof GameSettings>).forEach((key) => {
    if (current[key] !== DEFAULT_SETTINGS[key]) {
      (modified as Record<keyof GameSettings, unknown>)[key] = current[key];
    }
  });

  return modified;
};

/**
 * Subscribe to setting changes (for non-React usage)
 * @param callback - Function to call when settings change
 * @returns Unsubscribe function
 */
export const subscribeToSettings = (
  callback: (settings: GameSettings) => void
): (() => void) => {
  return useSettingsStore.subscribe((state) => {
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
    const parsed = JSON.parse(json) as Partial<GameSettings>;
    useSettingsStore.getState().updateSettings(parsed);
    return true;
  } catch {
    return false;
  }
};

export default useSettingsStore;
