'use client';

import { useEffect, useRef } from 'react';
import { Game } from '@/engine/core/Game';

export default function TestPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize game
    gameRef.current = new Game(canvasRef.current, 'local');
    gameRef.current.start();

    // Cleanup on unmount
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505]">
      <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-[#ff0055] to-[#00ffff] bg-clip-text text-transparent">
        Neon Tank Duel - Test Page
      </h1>

      <div className="relative">
        <canvas
          ref={canvasRef}
          className="border-2 border-gray-700 shadow-2xl"
        />
      </div>

      <div className="mt-8 text-gray-300 text-center max-w-2xl">
        <h2 className="text-xl font-semibold mb-4">Controls:</h2>
        <div className="grid grid-cols-2 gap-8">
          <div className="bg-gray-900/50 p-4 rounded-lg">
            <h3 className="text-[#ff0055] font-bold mb-2">RED PLAYER</h3>
            <p>Move: WASD</p>
            <p>Shoot: SPACE (hold to charge)</p>
          </div>
          <div className="bg-gray-900/50 p-4 rounded-lg">
            <h3 className="text-[#00ffff] font-bold mb-2">BLUE PLAYER</h3>
            <p>Move: Arrow Keys</p>
            <p>Shoot: ENTER (hold to charge)</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Phase 1 Complete: Game engine extracted and running!
        </p>
      </div>
    </div>
  );
}
