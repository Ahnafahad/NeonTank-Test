'use client';

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Game, GameMode, GameSettings } from '@/engine/core/Game';
import { useResponsiveCanvas } from '@/hooks/useResponsiveCanvas';
import { GameStats } from '@/types/game';

interface GameCanvasProps {
  mode: GameMode;
  settings?: Partial<GameSettings>;
  onGameOver?: (winnerId: number) => void;
}

export interface GameCanvasRef {
  getStats: () => GameStats;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

const GameCanvas = forwardRef<GameCanvasRef, GameCanvasProps>(
  ({ mode, settings, onGameOver }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<Game | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const gameOverCallbackRef = useRef(onGameOver);

    // Keep callback ref updated
    useEffect(() => {
      gameOverCallbackRef.current = onGameOver;
    }, [onGameOver]);

    // Get responsive dimensions
    const { scale, offsetX, offsetY } = useResponsiveCanvas();

    // Get game stats
    const getStats = useCallback((): GameStats => {
      if (!gameRef.current) {
        return {
          health: { p1: 100, p2: 100 },
          scores: { p1: 0, p2: 0 },
          gameTime: 0,
          suddenDeath: false,
        };
      }

      return {
        health: {
          p1: gameRef.current.getP1Health(),
          p2: gameRef.current.getP2Health(),
        },
        scores: gameRef.current.getScores(),
        gameTime: gameRef.current.getGameTime(),
        suddenDeath: gameRef.current.isSuddenDeath(),
      };
    }, []);

    // Pause game
    const pause = useCallback(() => {
      gameRef.current?.pause();
    }, []);

    // Resume game
    const resume = useCallback(() => {
      gameRef.current?.resume();
    }, []);

    // Reset game
    const reset = useCallback(() => {
      gameRef.current?.reset();
    }, []);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getStats,
      pause,
      resume,
      reset,
    }), [getStats, pause, resume, reset]);

    // Initialize game
    useEffect(() => {
      if (!canvasRef.current) return;

      // Create game instance
      const game = new Game(canvasRef.current, mode, settings);
      gameRef.current = game;

      // Start the game
      game.start();

      // Poll for game over state
      const checkGameOver = setInterval(() => {
        if (game.state === 'gameover') {
          const scores = game.getScores();
          const p1Health = game.getP1Health();
          const winnerId = p1Health <= 0 ? 2 : 1;

          if (gameOverCallbackRef.current) {
            gameOverCallbackRef.current(winnerId);
          }
          clearInterval(checkGameOver);
        }
      }, 100);

      // Cleanup
      return () => {
        clearInterval(checkGameOver);
        game.destroy();
        gameRef.current = null;
      };
    }, [mode, settings]);

    return (
      <div
        ref={containerRef}
        className="fixed inset-0 flex items-center justify-center bg-black overflow-hidden"
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          <canvas
            ref={canvasRef}
            className="block border-2 border-[#333] shadow-[0_0_20px_rgba(255,0,85,0.3),0_0_40px_rgba(0,255,255,0.2)]"
            style={{
              imageRendering: 'pixelated',
            }}
          />
        </div>
      </div>
    );
  }
);

GameCanvas.displayName = 'GameCanvas';

export default GameCanvas;
