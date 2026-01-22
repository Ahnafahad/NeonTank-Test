'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export type ControlScheme = 'wasd' | 'arrows';
export type Difficulty = 'easy' | 'medium' | 'hard';

interface ModeSelectorProps {
  mode: 'local' | 'ai' | 'online';
  onBack: () => void;
  onStart: (options?: { controls?: ControlScheme; difficulty?: Difficulty }) => void;
}

export function ModeSelector({ mode, onBack, onStart }: ModeSelectorProps) {
  const [controls, setControls] = useState<ControlScheme>('wasd');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  const handleStart = () => {
    if (mode === 'ai') {
      onStart({ controls, difficulty });
    } else {
      onStart();
    }
  };

  const getModeTitle = () => {
    switch (mode) {
      case 'local':
        return 'LOCAL 2-PLAYER';
      case 'ai':
        return 'VS COMPUTER';
      case 'online':
        return 'ONLINE MATCH';
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-950 overflow-hidden p-6">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-500">
          {getModeTitle()}
        </h2>

        {/* Content based on mode */}
        <div className="bg-gray-900/60 border border-cyan-500/30 rounded-xl p-6 mb-6">
          {mode === 'local' && (
            <LocalModeContent />
          )}

          {mode === 'ai' && (
            <AIModeContent
              controls={controls}
              setControls={setControls}
              difficulty={difficulty}
              setDifficulty={setDifficulty}
            />
          )}

          {mode === 'online' && (
            <OnlineModeContent />
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBack}
            className="
              flex-1 py-3 px-6
              text-sm font-bold tracking-wider
              text-gray-400
              bg-gray-800/80 border border-gray-600
              rounded-lg
              transition-all duration-200
              hover:text-white hover:border-gray-500
              focus:outline-none focus:ring-2 focus:ring-gray-500/50
            "
          >
            BACK
          </motion.button>

          {mode !== 'online' && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStart}
              className="
                flex-1 py-3 px-6
                text-sm font-bold tracking-wider
                text-white
                bg-gradient-to-r from-pink-600 to-cyan-600
                border border-transparent
                rounded-lg
                shadow-[0_0_20px_rgba(0,255,255,0.3)]
                transition-all duration-200
                hover:shadow-[0_0_30px_rgba(0,255,255,0.5)]
                focus:outline-none focus:ring-2 focus:ring-cyan-500/50
              "
            >
              START
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function LocalModeContent() {
  return (
    <div className="text-center py-8">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-4"
      >
        <span className="text-5xl">🎮</span>
      </motion.div>
      <h3 className="text-xl font-semibold text-cyan-100 mb-2">Ready to play!</h3>
      <p className="text-sm text-gray-400">
        Player 1: WASD + Space
        <br />
        Player 2: Arrow Keys + Enter
      </p>
    </div>
  );
}

interface AIModeContentProps {
  controls: ControlScheme;
  setControls: (controls: ControlScheme) => void;
  difficulty: Difficulty;
  setDifficulty: (difficulty: Difficulty) => void;
}

function AIModeContent({ controls, setControls, difficulty, setDifficulty }: AIModeContentProps) {
  return (
    <div className="space-y-6">
      {/* Control Selection */}
      <div>
        <label className="block text-sm text-cyan-100/80 mb-3">Your Controls</label>
        <div className="flex gap-3">
          <RadioButton
            selected={controls === 'wasd'}
            onClick={() => setControls('wasd')}
            label="WASD"
          />
          <RadioButton
            selected={controls === 'arrows'}
            onClick={() => setControls('arrows')}
            label="Arrow Keys"
          />
        </div>
      </div>

      {/* Difficulty Selection */}
      <div>
        <label className="block text-sm text-cyan-100/80 mb-3">Difficulty</label>
        <div className="flex gap-2">
          <DifficultyButton
            selected={difficulty === 'easy'}
            onClick={() => setDifficulty('easy')}
            label="Easy"
            color="green"
          />
          <DifficultyButton
            selected={difficulty === 'medium'}
            onClick={() => setDifficulty('medium')}
            label="Medium"
            color="yellow"
          />
          <DifficultyButton
            selected={difficulty === 'hard'}
            onClick={() => setDifficulty('hard')}
            label="Hard"
            color="red"
          />
        </div>
      </div>
    </div>
  );
}

function OnlineModeContent() {
  return (
    <div className="text-center py-8">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        className="inline-block mb-4"
      >
        <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full" />
      </motion.div>
      <h3 className="text-xl font-semibold text-cyan-100 mb-2">Searching for opponent...</h3>
      <p className="text-sm text-gray-400">Please wait while we find you a match</p>
    </div>
  );
}

interface RadioButtonProps {
  selected: boolean;
  onClick: () => void;
  label: string;
}

function RadioButton({ selected, onClick, label }: RadioButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex-1 flex items-center justify-center gap-2 py-2 px-4
        rounded-lg border text-sm font-medium
        transition-all duration-200
        ${selected
          ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300 shadow-[0_0_10px_rgba(0,255,255,0.3)]'
          : 'border-gray-600 bg-gray-800/50 text-gray-400 hover:border-gray-500 hover:text-gray-300'
        }
      `}
    >
      <span className={`
        w-4 h-4 rounded-full border-2 flex items-center justify-center
        ${selected ? 'border-cyan-400' : 'border-gray-500'}
      `}>
        {selected && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-2 h-2 rounded-full bg-cyan-400"
          />
        )}
      </span>
      {label}
    </button>
  );
}

interface DifficultyButtonProps {
  selected: boolean;
  onClick: () => void;
  label: string;
  color: 'green' | 'yellow' | 'red';
}

function DifficultyButton({ selected, onClick, label, color }: DifficultyButtonProps) {
  const colorClasses = {
    green: {
      active: 'border-green-500 bg-green-500/20 text-green-300 shadow-[0_0_10px_rgba(34,197,94,0.4)]',
      inactive: 'hover:border-green-500/50',
    },
    yellow: {
      active: 'border-yellow-500 bg-yellow-500/20 text-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.4)]',
      inactive: 'hover:border-yellow-500/50',
    },
    red: {
      active: 'border-red-500 bg-red-500/20 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.4)]',
      inactive: 'hover:border-red-500/50',
    },
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        flex-1 py-2 px-3
        rounded-lg border text-sm font-medium
        transition-all duration-200
        ${selected
          ? colorClasses[color].active
          : `border-gray-600 bg-gray-800/50 text-gray-400 ${colorClasses[color].inactive}`
        }
      `}
    >
      {label}
    </motion.button>
  );
}
