'use client';

import { motion } from 'framer-motion';

interface TimerProps {
  elapsedMs: number;
  suddenDeath: boolean;
}

export default function Timer({ elapsedMs, suddenDeath }: TimerProps) {
  // Convert milliseconds to minutes and seconds
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // Format time as "00:00"
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  if (suddenDeath) {
    return (
      <motion.div
        className="text-center"
        animate={{
          scale: [1, 1.1, 1],
          opacity: [1, 0.7, 1],
        }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <span
          className="text-2xl font-bold tracking-wider uppercase"
          style={{
            color: '#ff0000',
            textShadow: '0 0 10px #ff0000, 0 0 20px #ff0000, 0 0 30px #ff0000, 0 0 40px #ff0000',
          }}
        >
          SUDDEN DEATH!
        </span>
      </motion.div>
    );
  }

  return (
    <div className="text-center">
      <span
        className="text-xl font-bold tracking-wider"
        style={{
          color: '#ffffff',
          textShadow: '0 0 10px rgba(255,255,255,0.5), 0 0 20px rgba(255,255,255,0.3)',
        }}
      >
        Time: {formattedTime}
      </span>
    </div>
  );
}
