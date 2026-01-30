'use client';

import { Logger } from '@/lib/logging/Logger';
import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
import { Game, GameMode, GameSettings } from '@/engine/core/Game';
import { useResponsiveCanvas } from '@/hooks/useResponsiveCanvas';
import { GameStats } from '@/types/game';
import { NetworkManager, getNetworkManager, NetworkStatus } from '@/engine/multiplayer/NetworkManager';

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
    const networkManagerRef = useRef<NetworkManager | null>(null);

    // Network state
    const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('disconnected');
    const [assignedTankId, setAssignedTankId] = useState<number | null>(null);

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

    // Initialize network for online mode
    useEffect(() => {
      if (mode !== 'online') return;

      const initNetwork = async () => {
        try {
          // Get or create NetworkManager instance
          const networkManager = getNetworkManager();
          networkManagerRef.current = networkManager;

          // Set up network callbacks
          networkManager.setCallbacks({
            onStatusChange: (status) => {
              Logger.debug('[GameCanvas] Network status:', status);
              setNetworkStatus(status);
            },
            onMatchFound: (opponent, tankId) => {
              Logger.debug('[GameCanvas] Match found! Assigned tank:', tankId);
              setAssignedTankId(tankId);
            },
            onGameState: (state) => {
              // Game state updates will be handled by Game class
              // This is where server-authoritative state would be applied
            },
            onPlayerJoined: (player) => {
              Logger.debug('[GameCanvas] Player joined:', player.name);
            },
            onPlayerLeft: (playerId, reason) => {
              Logger.debug('[GameCanvas] Player left:', playerId, reason);
            },
            onGameOver: (winner, scores) => {
              Logger.debug('[GameCanvas] Network game over:', winner, scores);
              if (gameOverCallbackRef.current) {
                gameOverCallbackRef.current(winner);
              }
            },
            onCountdown: (countdown) => {
              Logger.debug('[GameCanvas] Countdown:', countdown);
            },
            onRoundStart: (roundNumber) => {
              Logger.debug('[GameCanvas] Round started:', roundNumber);
            },
            onRoundOver: (roundNumber, winner, scores) => {
              Logger.debug('[GameCanvas] Round over:', roundNumber, winner, scores);
            },
            onError: (code, message) => {
              console.error('[GameCanvas] Network error:', code, message);
            },
            onLatencyUpdate: (latency) => {
              // Could display latency to user
            },
          });

          // Connect to server
          await networkManager.connect();
          Logger.debug('[GameCanvas] Connected to game server');

          // Start matchmaking
          await networkManager.findMatch();
          Logger.debug('[GameCanvas] Finding match...');

        } catch (error) {
          console.error('[GameCanvas] Failed to initialize network:', error);
        }
      };

      initNetwork();

      // Cleanup network on unmount
      return () => {
        if (networkManagerRef.current) {
          networkManagerRef.current.disconnect();
          networkManagerRef.current = null;
        }
      };
    }, [mode]);

    // Initialize game
    useEffect(() => {
      if (!canvasRef.current) return;

      // For online mode, wait until we have an assigned tank ID
      if (mode === 'online' && assignedTankId === null) {
        Logger.debug('[GameCanvas] Waiting for tank assignment...');
        return;
      }

      // Prepare settings with network-specific configuration
      const gameSettings: Partial<GameSettings> = {
        ...settings,
      };

      // For online mode, set the local player controls based on assigned tank ID
      if (mode === 'online' && assignedTankId !== null) {
        gameSettings.localPlayerControls = assignedTankId === 1 ? 'wasd' : 'arrows';
        Logger.debug('[GameCanvas] Local player controls:', gameSettings.localPlayerControls);
      }

      // Create game instance
      // Note: NetworkManager instance will be passed once Game class is updated (Task #1)
      const game = new Game(canvasRef.current, mode, gameSettings);
      gameRef.current = game;

      // TODO: Once Task #1 is complete, pass NetworkManager to Game:
      // const game = new Game(canvasRef.current, mode, gameSettings, networkManagerRef.current);

      // Start the game
      game.start();

      // Poll for game over state (for local/AI modes)
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
    }, [mode, settings, assignedTankId]);

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
