'use client';

import { motion } from 'framer-motion';

interface HealthBarProps {
  health: number;
  maxHealth: number;
  color: '#ff0055' | '#00ffff';
  playerName: string;
}

export default function HealthBar({ health, maxHealth, color, playerName }: HealthBarProps) {
  const healthPercentage = Math.max(0, Math.min(100, (health / maxHealth) * 100));

  // Determine bar color based on health percentage
  const getHealthColor = (): string => {
    if (healthPercentage > 60) return '#00ff00'; // Green
    if (healthPercentage > 30) return '#ffff00'; // Yellow
    return '#ff0000'; // Red
  };

  const healthColor = getHealthColor();

  return (
    <div className="flex flex-col items-center w-[250px]">
      {/* Player Name */}
      <span
        className="text-sm font-bold mb-1 tracking-wider uppercase"
        style={{
          color: color,
          textShadow: `0 0 10px ${color}, 0 0 20px ${color}`,
        }}
      >
        {playerName}
      </span>

      {/* Health Bar Container */}
      <div
        className="relative w-full h-6 rounded-md overflow-hidden"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          border: `2px solid ${color}`,
          boxShadow: `0 0 10px ${color}40, inset 0 0 10px rgba(0, 0, 0, 0.5)`,
        }}
      >
        {/* Health Fill */}
        <motion.div
          className="absolute top-0 left-0 h-full"
          initial={{ width: '100%' }}
          animate={{ width: `${healthPercentage}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            background: `linear-gradient(180deg, ${healthColor}cc 0%, ${healthColor} 50%, ${healthColor}99 100%)`,
            boxShadow: `0 0 15px ${healthColor}80, inset 0 2px 4px rgba(255, 255, 255, 0.3)`,
          }}
        />

        {/* Gradient Overlay for Neon Effect */}
        <div
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)',
          }}
        />

        {/* Health Text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-xs font-bold"
            style={{
              color: '#ffffff',
              textShadow: '0 0 4px rgba(0,0,0,0.8), 1px 1px 2px rgba(0,0,0,0.5)',
            }}
          >
            {Math.round(health)} / {maxHealth}
          </span>
        </div>
      </div>
    </div>
  );
}
