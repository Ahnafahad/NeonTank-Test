'use client';

import { motion } from 'framer-motion';

interface GameOverScreenProps {
  winner: 1 | 2;
  scores: {
    p1: number;
    p2: number;
  };
  onRematch: () => void;
  onMainMenu: () => void;
}

export function GameOverScreen({ winner, scores, onRematch, onMainMenu }: GameOverScreenProps) {
  const isRedWinner = winner === 1;
  const winnerColor = isRedWinner ? '#ff0055' : '#00ffff';
  const winnerText = isRedWinner ? 'RED WINS!' : 'BLUE WINS!';
  const winnerGradient = isRedWinner
    ? 'from-red-500 via-pink-500 to-red-500'
    : 'from-cyan-500 via-blue-500 to-cyan-500';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-md" />

      {/* Background glow based on winner */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.3 }}
          transition={{ duration: 0.5 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[100px]"
          style={{ backgroundColor: winnerColor }}
        />
      </div>

      {/* Content */}
      <motion.div
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="relative z-10 flex flex-col items-center px-6 py-8 max-w-md w-full mx-4"
      >
        {/* Winner Text */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <motion.h1
            className={`text-5xl md:text-7xl font-black tracking-wider text-center bg-gradient-to-r ${winnerGradient} bg-clip-text text-transparent`}
            animate={{
              textShadow: [
                `0 0 20px ${winnerColor}40`,
                `0 0 40px ${winnerColor}60`,
                `0 0 20px ${winnerColor}40`,
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {winnerText}
          </motion.h1>

          {/* Glow behind text */}
          <motion.div
            className="absolute inset-0 -z-10 blur-2xl opacity-50"
            style={{ background: `linear-gradient(90deg, ${winnerColor}, transparent, ${winnerColor})` }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.div>

        {/* Score Display */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-center gap-8 mb-10"
        >
          <div className="flex flex-col items-center">
            <span className="text-xs font-semibold text-pink-400/60 uppercase tracking-wider mb-1">
              Red
            </span>
            <span
              className="text-4xl md:text-5xl font-bold"
              style={{
                color: '#ff0055',
                textShadow: `0 0 20px rgba(255, 0, 85, 0.5)`,
              }}
            >
              {scores.p1}
            </span>
          </div>

          <span className="text-2xl text-gray-600 font-light">-</span>

          <div className="flex flex-col items-center">
            <span className="text-xs font-semibold text-cyan-400/60 uppercase tracking-wider mb-1">
              Blue
            </span>
            <span
              className="text-4xl md:text-5xl font-bold"
              style={{
                color: '#00ffff',
                textShadow: `0 0 20px rgba(0, 255, 255, 0.5)`,
              }}
            >
              {scores.p2}
            </span>
          </div>
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 w-full"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={onRematch}
            className="
              flex-1 py-4 px-8
              text-lg font-bold tracking-widest
              text-white
              bg-gradient-to-r from-pink-600 to-cyan-600
              border-0
              rounded-lg
              shadow-[0_0_30px_rgba(0,255,255,0.3),0_0_30px_rgba(255,0,85,0.3)]
              transition-all duration-200
              hover:shadow-[0_0_40px_rgba(0,255,255,0.5),0_0_40px_rgba(255,0,85,0.5)]
              focus:outline-none focus:ring-2 focus:ring-cyan-500/50
            "
          >
            REMATCH
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={onMainMenu}
            className="
              flex-1 py-4 px-8
              text-lg font-bold tracking-widest
              text-gray-300
              bg-gray-800/80 border-2 border-gray-600
              rounded-lg
              transition-all duration-200
              hover:text-white hover:border-gray-500
              hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]
              focus:outline-none focus:ring-2 focus:ring-gray-500/50
            "
          >
            MAIN MENU
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
