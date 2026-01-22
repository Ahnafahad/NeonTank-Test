'use client';

import { motion } from 'framer-motion';

interface ScoreBoardProps {
  p1Score: number;
  p2Score: number;
}

export default function ScoreBoard({ p1Score, p2Score }: ScoreBoardProps) {
  const p1Color = '#ff0055';
  const p2Color = '#00ffff';

  return (
    <div className="flex items-center justify-center gap-4">
      {/* P1 Score */}
      <motion.span
        key={`p1-${p1Score}`}
        initial={{ scale: 1.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="text-4xl font-bold min-w-[60px] text-right"
        style={{
          color: p1Color,
          textShadow: `0 0 10px ${p1Color}, 0 0 20px ${p1Color}, 0 0 30px ${p1Color}`,
        }}
      >
        {p1Score}
      </motion.span>

      {/* Separator */}
      <span
        className="text-4xl font-bold"
        style={{
          color: '#ffffff',
          textShadow: '0 0 10px rgba(255,255,255,0.5)',
        }}
      >
        -
      </span>

      {/* P2 Score */}
      <motion.span
        key={`p2-${p2Score}`}
        initial={{ scale: 1.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="text-4xl font-bold min-w-[60px] text-left"
        style={{
          color: p2Color,
          textShadow: `0 0 10px ${p2Color}, 0 0 20px ${p2Color}, 0 0 30px ${p2Color}`,
        }}
      >
        {p2Score}
      </motion.span>
    </div>
  );
}
