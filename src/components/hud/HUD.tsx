'use client';

import { motion } from 'framer-motion';
import HealthBar from './HealthBar';
import ScoreBoard from './ScoreBoard';
import Timer from './Timer';

interface HUDProps {
  p1Health: number;
  p2Health: number;
  p1Score: number;
  p2Score: number;
  elapsedTime: number;
  suddenDeath: boolean;
  maxHealth?: number;
}

export default function HUD({
  p1Health,
  p2Health,
  p1Score,
  p2Score,
  elapsedTime,
  suddenDeath,
  maxHealth = 100,
}: HUDProps) {
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Main HUD Container */}
      <div
        className="mx-auto px-4 py-3 sm:px-6 lg:px-8"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 80%, transparent 100%)',
        }}
      >
        {/* Top Row: Health Bars and Score */}
        <div className="flex items-start justify-between max-w-6xl mx-auto">
          {/* P1 Health (Left) */}
          <div className="flex-shrink-0">
            <HealthBar
              health={p1Health}
              maxHealth={maxHealth}
              color="#ff0055"
              playerName="Player 1"
            />
          </div>

          {/* Center: Score */}
          <div className="flex-shrink-0 px-4">
            <ScoreBoard p1Score={p1Score} p2Score={p2Score} />
          </div>

          {/* P2 Health (Right) */}
          <div className="flex-shrink-0">
            <HealthBar
              health={p2Health}
              maxHealth={maxHealth}
              color="#00ffff"
              playerName="Player 2"
            />
          </div>
        </div>

        {/* Bottom Row: Timer */}
        <div className="mt-2 text-center">
          <Timer elapsedMs={elapsedTime} suddenDeath={suddenDeath} />
        </div>
      </div>

      {/* Bottom Border Glow */}
      <div
        className="h-[2px] w-full"
        style={{
          background: 'linear-gradient(90deg, #ff0055 0%, #ffffff 50%, #00ffff 100%)',
          boxShadow: '0 0 10px rgba(255,255,255,0.5), 0 0 20px rgba(255,255,255,0.3)',
        }}
      />
    </motion.div>
  );
}
