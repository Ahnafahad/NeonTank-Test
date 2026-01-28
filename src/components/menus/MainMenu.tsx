'use client';

import { motion } from 'framer-motion';

export type GameMode = 'local' | 'ai' | 'online' | 'lan' | 'options';

interface MainMenuProps {
  onSelectMode: (mode: GameMode) => void;
}

const menuButtons: { label: string; mode: GameMode }[] = [
  { label: 'LOCAL 2-PLAYER', mode: 'local' },
  { label: 'VS COMPUTER', mode: 'ai' },
  { label: 'ONLINE', mode: 'online' },
  { label: 'LAN MULTIPLAYER', mode: 'lan' },
  { label: 'OPTIONS', mode: 'options' },
];

export function MainMenu({ onSelectMode }: MainMenuProps) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-950 overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Animated Title */}
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative mb-12 md:mb-16"
      >
        <motion.h1
          className="text-4xl sm:text-5xl md:text-7xl font-black tracking-wider text-center px-4"
          style={{
            background: 'linear-gradient(90deg, #ff0055, #ff0055, #00ffff, #00ffff)',
            backgroundSize: '200% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
          animate={{
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          }}
          transition={{
            duration: 4,
            ease: 'linear',
            repeat: Infinity,
          }}
        >
          NEON TANK DUEL
        </motion.h1>

        {/* Glow effect behind title */}
        <motion.div
          className="absolute inset-0 -z-10 blur-xl opacity-60"
          style={{
            background: 'linear-gradient(90deg, #ff0055, #00ffff)',
          }}
          animate={{
            opacity: [0.4, 0.7, 0.4],
          }}
          transition={{
            duration: 2,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        />
      </motion.div>

      {/* Menu Buttons */}
      <motion.div
        className="flex flex-col gap-4 w-full max-w-sm px-6"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: {
              staggerChildren: 0.1,
              delayChildren: 0.3,
            },
          },
        }}
      >
        {menuButtons.map(({ label, mode }) => (
          <motion.button
            key={mode}
            onClick={() => onSelectMode(mode)}
            variants={{
              hidden: { opacity: 0, x: -30 },
              visible: { opacity: 1, x: 0 },
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="
              relative group w-full py-4 px-6
              text-lg sm:text-xl font-bold tracking-widest text-center
              text-cyan-100
              bg-gray-900/80 border-2 border-cyan-500/50
              rounded-lg
              transition-all duration-300
              hover:border-cyan-400 hover:text-white
              hover:shadow-[0_0_20px_rgba(0,255,255,0.4),inset_0_0_20px_rgba(0,255,255,0.1)]
              focus:outline-none focus:border-cyan-400
              focus:shadow-[0_0_20px_rgba(0,255,255,0.4),inset_0_0_20px_rgba(0,255,255,0.1)]
            "
          >
            {/* Button glow on hover */}
            <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-pink-500/0 via-cyan-500/0 to-pink-500/0 group-hover:from-pink-500/10 group-hover:via-cyan-500/10 group-hover:to-pink-500/10 transition-all duration-300" />

            {/* Left accent line */}
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-0 bg-gradient-to-b from-pink-500 to-cyan-500 rounded-full group-hover:h-8 transition-all duration-300 shadow-[0_0_10px_rgba(0,255,255,0.6)]" />

            {/* Right accent line */}
            <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-0 bg-gradient-to-b from-cyan-500 to-pink-500 rounded-full group-hover:h-8 transition-all duration-300 shadow-[0_0_10px_rgba(255,0,85,0.6)]" />

            {label}
          </motion.button>
        ))}
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute bottom-6 text-xs text-gray-500"
      >
        Press any button to start
      </motion.p>
    </div>
  );
}
