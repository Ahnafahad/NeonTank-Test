'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toggle, Slider, Select } from '@/components/ui';
import { useSettingsStore } from '@/store/useSettingsStore';

interface OptionsMenuProps {
  onBack: () => void;
}

type SectionKey = 'gameplay' | 'graphics' | 'map' | 'audio' | 'advanced';

const sectionLabels: Record<SectionKey, string> = {
  gameplay: 'Gameplay',
  graphics: 'Graphics',
  map: 'Map',
  audio: 'Audio',
  advanced: 'Advanced',
};

export function OptionsMenu({ onBack }: OptionsMenuProps) {
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(
    new Set(['gameplay'])
  );

  const settings = useSettingsStore();

  const toggleSection = (section: SectionKey) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-950 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-pink-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex items-center justify-between p-4 md:p-6 border-b border-cyan-500/20"
      >
        <button
          onClick={onBack}
          className="
            flex items-center gap-2 px-4 py-2
            text-sm font-medium text-gray-400
            hover:text-white transition-colors
            focus:outline-none focus:text-white
          "
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <h1 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-500">
          OPTIONS
        </h1>

        <div className="w-20" /> {/* Spacer for centering */}
      </motion.div>

      {/* Scrollable Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Gameplay Section */}
          <CollapsibleSection
            title={sectionLabels.gameplay}
            isExpanded={expandedSections.has('gameplay')}
            onToggle={() => toggleSection('gameplay')}
          >
            <div className="space-y-4">
              <Toggle
                label="Charging Enabled"
                value={settings.charging}
                onChange={(v) => settings.updateSetting('charging', v)}
              />
              <Toggle
                label="Ammo System"
                value={settings.ammoSystem}
                onChange={(v) => settings.updateSetting('ammoSystem', v)}
              />
              <Toggle
                label="Unlimited Ammo"
                value={settings.unlimitedAmmo}
                onChange={(v) => settings.updateSetting('unlimitedAmmo', v)}
                disabled={!settings.ammoSystem}
              />
              <Toggle
                label="Friendly Fire"
                value={settings.friendlyFire}
                onChange={(v) => settings.updateSetting('friendlyFire', v)}
              />
              <Slider
                label="Starting Health"
                min={50}
                max={200}
                step={10}
                value={settings.startingHealth}
                onChange={(v) => settings.updateSetting('startingHealth', v)}
                valueFormatter={(v) => `${v} HP`}
              />
              <Toggle
                label="Bullet Ricochet"
                value={settings.bulletRicochet}
                onChange={(v) => settings.updateSetting('bulletRicochet', v)}
              />
              <Toggle
                label="Recoil"
                value={settings.recoil}
                onChange={(v) => settings.updateSetting('recoil', v)}
              />
              <Slider
                label="Game Speed"
                min={0.5}
                max={2.0}
                step={0.1}
                value={settings.gameSpeed}
                onChange={(v) => settings.updateSetting('gameSpeed', v)}
                valueFormatter={(v) => `${v.toFixed(1)}x`}
              />
              <Toggle
                label="Low Gravity"
                value={settings.lowGravity}
                onChange={(v) => settings.updateSetting('lowGravity', v)}
              />
              <Slider
                label="Max Bounces"
                min={0}
                max={5}
                step={1}
                value={settings.maxBounces}
                onChange={(v) => settings.updateSetting('maxBounces', v)}
              />
            </div>
          </CollapsibleSection>

          {/* Graphics Section */}
          <CollapsibleSection
            title={sectionLabels.graphics}
            isExpanded={expandedSections.has('graphics')}
            onToggle={() => toggleSection('graphics')}
          >
            <div className="space-y-4">
              <Toggle
                label="Particle Effects"
                value={settings.particleEffects}
                onChange={(v) => settings.updateSetting('particleEffects', v)}
              />
              <Toggle
                label="Bullet Trails"
                value={settings.bulletTrails}
                onChange={(v) => settings.updateSetting('bulletTrails', v)}
              />
              <Toggle
                label="Screen Shake"
                value={settings.screenShake}
                onChange={(v) => settings.updateSetting('screenShake', v)}
              />
              <Select
                label="Weather"
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'rain', label: 'Rain' },
                  { value: 'snow', label: 'Snow' },
                  { value: 'fog', label: 'Fog' },
                ]}
                value={settings.weather}
                onChange={(v) => settings.updateSetting('weather', v as typeof settings.weather)}
              />
              <Select
                label="Colorblind Mode"
                options={[
                  { value: 'none', label: 'Off' },
                  { value: 'protanopia', label: 'Protanopia' },
                  { value: 'deuteranopia', label: 'Deuteranopia' },
                  { value: 'tritanopia', label: 'Tritanopia' },
                ]}
                value={settings.colorblindMode}
                onChange={(v) => settings.updateSetting('colorblindMode', v as typeof settings.colorblindMode)}
              />
              <Slider
                label="Trail Length"
                min={1}
                max={10}
                value={settings.bulletTrailLength}
                onChange={(v) => settings.updateSetting('bulletTrailLength', v)}
                disabled={!settings.bulletTrails}
              />
              <Slider
                label="Shake Intensity"
                min={0}
                max={100}
                value={settings.screenShakeIntensity}
                onChange={(v) => settings.updateSetting('screenShakeIntensity', v)}
                disabled={!settings.screenShake}
                valueFormatter={(v) => `${v}%`}
              />
              <Slider
                label="Particle Density"
                min={10}
                max={200}
                value={settings.particleDensity}
                onChange={(v) => settings.updateSetting('particleDensity', v)}
                disabled={!settings.particleEffects}
                valueFormatter={(v) => `${v}%`}
              />
              <Toggle
                label="Damage Numbers"
                value={settings.damageNumbers}
                onChange={(v) => settings.updateSetting('damageNumbers', v)}
              />
            </div>
          </CollapsibleSection>

          {/* Map Section */}
          <CollapsibleSection
            title={sectionLabels.map}
            isExpanded={expandedSections.has('map')}
            onToggle={() => toggleSection('map')}
          >
            <div className="space-y-4">
              <Select
                label="Map Variant"
                options={[
                  { value: 'classic', label: 'Classic' },
                  { value: 'maze', label: 'Maze' },
                  { value: 'open', label: 'Open Arena' },
                  { value: 'fortress', label: 'Fortress' },
                  { value: 'random', label: 'Random' },
                ]}
                value={settings.mapVariant}
                onChange={(v) => settings.updateSetting('mapVariant', v as typeof settings.mapVariant)}
              />
              <Toggle
                label="Destructible Crates"
                value={settings.destructibleCrates}
                onChange={(v) => settings.updateSetting('destructibleCrates', v)}
              />
              <Toggle
                label="Hazards"
                value={settings.hazards}
                onChange={(v) => settings.updateSetting('hazards', v)}
              />
              <Toggle
                label="Sudden Death"
                value={settings.suddenDeath}
                onChange={(v) => settings.updateSetting('suddenDeath', v)}
              />
              <Toggle
                label="Power-Ups"
                value={settings.powerUps}
                onChange={(v) => settings.updateSetting('powerUps', v)}
              />
              <Slider
                label="Power-up Spawn Rate"
                min={1}
                max={20}
                value={settings.powerupSpawnRate}
                onChange={(v) => settings.updateSetting('powerupSpawnRate', v)}
                disabled={!settings.powerUps}
                valueFormatter={(v) => `${v}s`}
              />
            </div>
          </CollapsibleSection>

          {/* Audio Section */}
          <CollapsibleSection
            title={sectionLabels.audio}
            isExpanded={expandedSections.has('audio')}
            onToggle={() => toggleSection('audio')}
          >
            <div className="space-y-4">
              <Toggle
                label="Music"
                value={settings.musicEnabled}
                onChange={(v) => settings.updateSetting('musicEnabled', v)}
              />
              <Slider
                label="Music Volume"
                min={0}
                max={100}
                value={settings.musicVolume}
                onChange={(v) => settings.updateSetting('musicVolume', v)}
                disabled={!settings.musicEnabled}
                valueFormatter={(v) => `${v}%`}
              />
              <Toggle
                label="Sound Effects"
                value={settings.soundEffects}
                onChange={(v) => settings.updateSetting('soundEffects', v)}
              />
              <Slider
                label="SFX Volume"
                min={0}
                max={100}
                value={settings.sfxVolume}
                onChange={(v) => settings.updateSetting('sfxVolume', v)}
                disabled={!settings.soundEffects}
                valueFormatter={(v) => `${v}%`}
              />
            </div>
          </CollapsibleSection>

          {/* Advanced Section */}
          <CollapsibleSection
            title={sectionLabels.advanced}
            isExpanded={expandedSections.has('advanced')}
            onToggle={() => toggleSection('advanced')}
          >
            <div className="space-y-4">
              <Toggle
                label="Minimap"
                value={settings.minimap}
                onChange={(v) => settings.updateSetting('minimap', v)}
              />
              <Toggle
                label="Kill Cam"
                value={settings.killcam}
                onChange={(v) => settings.updateSetting('killcam', v)}
              />
              <Toggle
                label="Time Limit Enabled"
                value={settings.timeLimitEnabled}
                onChange={(v) => settings.updateSetting('timeLimitEnabled', v)}
              />
              <Slider
                label="Time Limit"
                min={30}
                max={300}
                step={30}
                value={settings.timeLimitSeconds}
                onChange={(v) => settings.updateSetting('timeLimitSeconds', v)}
                disabled={!settings.timeLimitEnabled}
                valueFormatter={(v) => {
                  const minutes = Math.floor(v / 60);
                  const seconds = v % 60;
                  return seconds > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${minutes} min`;
                }}
              />
              <Toggle
                label="Score Limit Enabled"
                value={settings.scoreLimitEnabled}
                onChange={(v) => settings.updateSetting('scoreLimitEnabled', v)}
              />
              <Slider
                label="Score Limit"
                min={1}
                max={10}
                value={settings.scoreLimitValue}
                onChange={(v) => settings.updateSetting('scoreLimitValue', v)}
                disabled={!settings.scoreLimitEnabled}
                valueFormatter={(v) => `${v} wins`}
              />
            </div>
          </CollapsibleSection>

          {/* Restore Defaults Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => settings.resetToDefaults()}
            className="
              w-full mt-8 py-3 px-6
              text-sm font-bold tracking-wider
              text-pink-400
              bg-pink-500/10 border border-pink-500/30
              rounded-lg
              transition-all duration-200
              hover:bg-pink-500/20 hover:border-pink-500/50
              hover:shadow-[0_0_15px_rgba(255,0,85,0.3)]
              focus:outline-none focus:ring-2 focus:ring-pink-500/50
            "
          >
            RESTORE DEFAULTS
          </motion.button>
        </div>
      </div>
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({ title, isExpanded, onToggle, children }: CollapsibleSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900/60 border border-cyan-500/30 rounded-xl overflow-hidden"
    >
      <button
        type="button"
        onClick={onToggle}
        className="
          w-full flex items-center justify-between p-4
          text-left font-semibold text-cyan-100
          hover:bg-cyan-500/5 transition-colors
          focus:outline-none focus:bg-cyan-500/5
        "
      >
        <span>{title}</span>
        <motion.svg
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-5 h-5 text-cyan-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-cyan-500/10">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
