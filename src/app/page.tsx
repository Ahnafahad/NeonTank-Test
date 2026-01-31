'use client';

import { Logger } from '@/lib/logging/Logger';
import { useEffect, useRef, useCallback, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGameStore } from '@/store/useGameStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useMultiplayerStore } from '@/store/useMultiplayerStore';
import { useResponsiveCanvas, useIsMobile } from '@/hooks/useResponsiveCanvas';
import { Game } from '@/engine/core/Game';
import { Constants } from '@/engine/utils/Constants';
import { Vector } from '@/engine/utils/Vector';
import { MobileControls } from '@/components/mobile';
import { MatchmakingScreen } from '@/components/menus/MatchmakingScreen';
import { LANLobby } from '@/components/menus/LANLobby';
import { getNetworkManager } from '@/engine/multiplayer/NetworkManager';
import { createLANNetworkManager } from '@/engine/multiplayer/LANNetworkManager';
import type { LocalMultiplayerServer } from '@/lib/socket/localServer';
import type { LocalMultiplayerClient } from '@/lib/socket/localClient';
import type { AIDifficulty } from '@/engine/ai';

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <GameContent />
    </Suspense>
  );
}

function GameContent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const animationRef = useRef<number | null>(null);
  const [showAIDifficultySelect, setShowAIDifficultySelect] = useState(false);
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [showLANLobby, setShowLANLobby] = useState(false);
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>('medium');
  const [onlinePlayerName, setOnlinePlayerName] = useState('');
  const [onlineControlScheme, setOnlineControlScheme] = useState<'wasd' | 'arrows'>('wasd');
  const [displayScores, setDisplayScores] = useState({ p1: 0, p2: 0 });
  const [lanServer, setLanServer] = useState<LocalMultiplayerServer | null>(null);
  const [lanClient, setLanClient] = useState<LocalMultiplayerClient | null>(null);
  const [isLanHost, setIsLanHost] = useState(false);

  const searchParams = useSearchParams();
  const joinSessionId = searchParams.get('session');

  const {
    currentScreen,
    mode,
    scores,
    lastWinner,
    currentStats,
    startGame,
    endGame,
    goToMainMenu,
    setScreen,
    setMode,
    updateStats,
  } = useGameStore();

  // Get all settings from store
  const settingsStore = useSettingsStore();

  // Get multiplayer store for player names
  const { playerName: multiplayerPlayerName, opponentName } = useMultiplayerStore();

  // Auto-join if session ID is present
  useEffect(() => {
    if (joinSessionId && !showMatchmaking && currentScreen === 'menu') {
      setShowMatchmaking(true);
    }
  }, [joinSessionId, showMatchmaking, currentScreen]);

  const isMobile = useIsMobile();
  const { width, height } = useResponsiveCanvas(
    Constants.GAME_WIDTH,
    Constants.GAME_HEIGHT,
    20,
    80, // Reserved for HUD
    isMobile ? 200 : 0 // Reserved for mobile controls
  );

  // Game stats polling
  const pollGameStats = useCallback(() => {
    if (gameRef.current && gameRef.current.state === 'playing') {
      // Get scores from game engine (works for all modes including online)
      const currentScores = gameRef.current.getScores();
      setDisplayScores({ ...currentScores }); // Force new object for React comparison

      updateStats({
        p1Health: gameRef.current.getP1Health(),
        p2Health: gameRef.current.getP2Health(),
        elapsedTime: gameRef.current.getGameTime(),
        suddenDeath: gameRef.current.isSuddenDeath(),
      });
      animationRef.current = requestAnimationFrame(pollGameStats);
    } else if (gameRef.current?.state === 'gameover') {
      const p1Dead = gameRef.current.getP1Health() <= 0;
      endGame(p1Dead ? 2 : 1);
    }
  }, [updateStats, endGame]);

  // Initialize game when entering playing state
  useEffect(() => {
    if (currentScreen === 'playing' && canvasRef.current && !gameRef.current) {
      // Get snapshot of all settings from store
      const gameSettings = {
        charging: settingsStore.charging,
        ammoSystem: settingsStore.ammoSystem,
        powerUps: settingsStore.powerUps,
        destructibleCrates: settingsStore.destructibleCrates,
        hazards: settingsStore.hazards,
        suddenDeath: settingsStore.suddenDeath,
        bulletRicochet: settingsStore.bulletRicochet,
        recoil: settingsStore.recoil,
        particleEffects: settingsStore.particleEffects,
        soundEffects: settingsStore.soundEffects,
        bulletTrails: settingsStore.bulletTrails,
        bulletTrailLength: settingsStore.bulletTrailLength,
        screenShake: settingsStore.screenShake,
        screenShakeIntensity: settingsStore.screenShakeIntensity,
        weather: settingsStore.weather,
        particleDensity: settingsStore.particleDensity,
        damageNumbers: settingsStore.damageNumbers,
        friendlyFire: settingsStore.friendlyFire,
        gameSpeed: settingsStore.gameSpeed,
        unlimitedAmmo: settingsStore.unlimitedAmmo,
        lowGravity: settingsStore.lowGravity,
        maxBounces: settingsStore.maxBounces,
        startingHealth: settingsStore.startingHealth,
        mapVariant: settingsStore.mapVariant,
        powerupSpawnRate: settingsStore.powerupSpawnRate,
        timeLimitEnabled: settingsStore.timeLimitEnabled,
        timeLimitSeconds: settingsStore.timeLimitSeconds,
        scoreLimitEnabled: settingsStore.scoreLimitEnabled,
        scoreLimitValue: settingsStore.scoreLimitValue,
        minimap: settingsStore.minimap,
        killcam: settingsStore.killcam,
        musicEnabled: settingsStore.musicEnabled,
        musicVolume: settingsStore.musicVolume,
        sfxVolume: settingsStore.sfxVolume,
        colorblindMode: settingsStore.colorblindMode,
        aiDifficulty: 'medium' as AIDifficulty, // Default, will be overridden for AI mode
      };

      // Merge with mode-specific settings
      if (mode === 'ai') {
        gameRef.current = new Game(canvasRef.current, mode, {
          ...gameSettings,
          aiDifficulty,
        });
      } else if (mode === 'online') {
        const networkManager = getNetworkManager();
        gameRef.current = new Game(canvasRef.current, mode, {
          ...gameSettings,
          localPlayerControls: onlineControlScheme,
        }, networkManager);
      } else if (mode === 'lan') {
        // Create LAN network manager
        const lanNetworkManager = isLanHost && lanServer
          ? createLANNetworkManager('host', lanServer)
          : !isLanHost && lanClient
          ? createLANNetworkManager('guest', lanClient)
          : null;

        if (!lanNetworkManager) {
          console.error('[LAN] Failed to create LAN network manager');
          return;
        }

        // Pass LAN network manager to Game constructor
        gameRef.current = new Game(
          canvasRef.current,
          mode,
          {
            ...gameSettings,
            localPlayerControls: 'wasd', // Default for now, can be made configurable
          },
          undefined, // No online network manager
          lanNetworkManager // Pass LAN network manager
        );

        // Set up LAN connection callbacks
        lanNetworkManager.setCallbacks({
          onConnectionLost: () => {
            Logger.debug('[LAN] Connection lost');
            endGame(isLanHost ? 1 : 2); // End game if connection lost
          }
        });
      } else {
        gameRef.current = new Game(canvasRef.current, mode, gameSettings);
      }

      gameRef.current.start();
      animationRef.current = requestAnimationFrame(pollGameStats);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [currentScreen, mode, aiDifficulty, onlineControlScheme, pollGameStats, settingsStore]);

  // Cleanup game on screen change
  useEffect(() => {
    if (currentScreen !== 'playing' && gameRef.current) {
      gameRef.current.destroy();
      gameRef.current = null;
    }

    // If we left online mode completely (back to menu), disconnect
    if (currentScreen === 'menu' && mode === 'online') {
      getNetworkManager().disconnect();
    }

    // If we left LAN mode, disconnect
    if (currentScreen === 'menu' && mode === 'lan') {
      if (lanServer) {
        lanServer.destroy();
        setLanServer(null);
      }
      if (lanClient) {
        lanClient.destroy();
        setLanClient(null);
      }
    }
  }, [currentScreen, mode]);

  const handleRematch = () => {
    if (gameRef.current) {
      gameRef.current.destroy();
      gameRef.current = null;
    }
    startGame();
  };

  const handleStartGame = (selectedMode: 'local' | 'ai' | 'online' | 'lan') => {
    if (selectedMode === 'ai') {
      setShowAIDifficultySelect(true);
      return;
    }
    if (selectedMode === 'online') {
      setShowMatchmaking(true);
      return;
    }
    if (selectedMode === 'lan') {
      setShowLANLobby(true);
      return;
    }
    setMode(selectedMode);
    startGame();
  };

  const handleOnlineMatchStart = (playerName: string, controls: 'wasd' | 'arrows') => {
    setOnlinePlayerName(playerName);
    setOnlineControlScheme(controls);
    setShowMatchmaking(false);
    setMode('online');
    startGame();
  };

  const handleCancelMatchmaking = () => {
    setShowMatchmaking(false);
  };

  const handleCancelLANLobby = () => {
    setShowLANLobby(false);
  };

  const handleLANGameStart = (isHost: boolean, server: LocalMultiplayerServer | null, client: LocalMultiplayerClient | null) => {
    setShowLANLobby(false);
    setIsLanHost(isHost);
    setLanServer(server);
    setLanClient(client);
    setMode('lan');
    startGame();
  };

  const handleStartAIGame = (difficulty: AIDifficulty) => {
    setAIDifficulty(difficulty);
    setShowAIDifficultySelect(false);
    setMode('ai');
    startGame();
  };

  // Format time display
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Main Menu Screen
  if (currentScreen === 'menu') {
    // LAN Lobby
    if (showLANLobby) {
      return (
        <LANLobby
          onBack={handleCancelLANLobby}
          onGameStart={handleLANGameStart}
        />
      );
    }

    // Online Matchmaking
    if (showMatchmaking) {
      return (
        <MatchmakingScreen
          onCancel={handleCancelMatchmaking}
          onMatchStart={handleOnlineMatchStart}
          joinSessionId={joinSessionId}
        />
      );
    }

    // AI Difficulty Selection
    if (showAIDifficultySelect) {
      return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-white uppercase tracking-wider">
            Select Difficulty
          </h2>

          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button
              onClick={() => handleStartAIGame('easy')}
              className="px-8 py-4 text-xl font-bold border-2 border-green-500 text-white rounded-full hover:bg-green-500 hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all duration-200 uppercase tracking-wider"
            >
              Easy
            </button>

            <button
              onClick={() => handleStartAIGame('medium')}
              className="px-8 py-4 text-xl font-bold border-2 border-yellow-500 text-white rounded-full hover:bg-yellow-500 hover:text-black hover:shadow-[0_0_30px_rgba(234,179,8,0.5)] transition-all duration-200 uppercase tracking-wider"
            >
              Medium
            </button>

            <button
              onClick={() => handleStartAIGame('hard')}
              className="px-8 py-4 text-xl font-bold border-2 border-red-500 text-white rounded-full hover:bg-red-500 hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] transition-all duration-200 uppercase tracking-wider"
            >
              Hard
            </button>

            <button
              onClick={() => setShowAIDifficultySelect(false)}
              className="px-8 py-4 text-lg font-bold border-2 border-gray-600 text-gray-400 rounded-full hover:border-white hover:text-white transition-all duration-200 uppercase tracking-wider mt-4"
            >
              Back
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl md:text-6xl font-bold mb-12 text-center tracking-widest bg-gradient-to-r from-[#ff0055] to-[#00ffff] bg-clip-text text-transparent drop-shadow-lg animate-pulse">
          NEON TANK DUEL
        </h1>

        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={() => handleStartGame('local')}
            className="px-8 py-4 text-xl font-bold border-2 border-[#ff0055] text-white rounded-full hover:bg-[#ff0055] hover:shadow-[0_0_30px_#ff0055] transition-all duration-200 uppercase tracking-wider"
          >
            Local 2-Player
          </button>

          <button
            onClick={() => handleStartGame('ai')}
            className="px-8 py-4 text-xl font-bold border-2 border-[#00ffff] text-white rounded-full hover:bg-[#00ffff] hover:text-black hover:shadow-[0_0_30px_#00ffff] transition-all duration-200 uppercase tracking-wider"
          >
            VS Computer
          </button>

          <button
            onClick={() => handleStartGame('online')}
            className="px-8 py-4 text-xl font-bold border-2 border-purple-500 text-white rounded-full hover:bg-purple-500 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all duration-200 uppercase tracking-wider"
          >
            Online Battle
          </button>

          <button
            onClick={() => handleStartGame('lan')}
            className="px-8 py-4 text-xl font-bold border-2 border-green-500 text-white rounded-full hover:bg-green-500 hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all duration-200 uppercase tracking-wider"
          >
            LAN Multiplayer
          </button>

          <button
            onClick={() => setScreen('options')}
            className="px-8 py-4 text-xl font-bold border-2 border-gray-500 text-gray-400 rounded-full hover:border-white hover:text-white transition-all duration-200 uppercase tracking-wider"
          >
            Options
          </button>
        </div>

        <div className="mt-12 text-gray-500 text-center text-sm">
          <p className="mb-1">Player 1: WASD + SPACE</p>
          <p>Player 2: Arrows + ENTER</p>
        </div>
      </div>
    );
  }

  // Options Screen (placeholder)
  if (currentScreen === 'options') {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
        <h2 className="text-3xl font-bold mb-8 text-white">Options</h2>
        <p className="text-gray-400 mb-8">Settings coming soon...</p>
        <button
          onClick={goToMainMenu}
          className="px-6 py-3 border-2 border-white text-white rounded-full hover:bg-white hover:text-black transition-all"
        >
          Back to Menu
        </button>
      </div>
    );
  }

  // Game Over Screen
  if (currentScreen === 'gameover') {
    const winnerName = lastWinner === 1
      ? 'YOU WIN'
      : (mode === 'ai' ? 'CPU WINS' : 'BLUE WINS');

    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
        <div className="bg-black/80 backdrop-blur-md p-8 rounded-xl border border-gray-700 text-center">
          <h2
            className="text-5xl font-bold mb-4 uppercase"
            style={{ color: lastWinner === 1 ? '#ff0055' : '#00ffff' }}
          >
            {winnerName}!
          </h2>

          {mode === 'ai' && (
            <p className="text-gray-400 mb-4 capitalize">
              Difficulty: {aiDifficulty}
            </p>
          )}

          <div className="text-3xl font-bold mb-8">
            <span className="text-[#ff0055]">{scores.p1}</span>
            <span className="text-white mx-4">-</span>
            <span className="text-[#00ffff]">{scores.p2}</span>
          </div>

          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={handleRematch}
              className="px-8 py-4 text-xl font-bold border-2 border-white text-white rounded-full hover:bg-white hover:text-black transition-all uppercase"
            >
              Rematch
            </button>
            <button
              onClick={goToMainMenu}
              className="px-8 py-4 text-xl font-bold border-2 border-gray-500 text-gray-400 rounded-full hover:border-white hover:text-white transition-all uppercase"
            >
              Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Playing Screen
  return (
    <div className="min-h-screen max-h-screen bg-[#050505] flex flex-col overflow-hidden">
      {/* HUD */}
      <div className="w-full px-4 py-2 flex justify-between items-center shrink-0" style={{ height: '80px' }}>
        <div className="text-left">
          <div className="text-[#ff0055] font-bold text-sm mb-1">
            {mode === 'online' ? (multiplayerPlayerName || 'PLAYER 1') : 'PLAYER 1'}
          </div>
          <div className="w-32 md:w-48 h-4 bg-black border border-[#ff0055] rounded overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#88002d] to-[#ff0055] transition-all duration-200"
              style={{ width: `${currentStats.p1Health}%` }}
            />
          </div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold">
            <span className="text-[#ff0055]">{displayScores.p1}</span>
            <span className="text-white mx-2">-</span>
            <span className="text-[#00ffff]">{displayScores.p2}</span>
          </div>
          <div className={`text-sm ${currentStats.suddenDeath ? 'text-red-500 animate-pulse font-bold' : 'text-gray-400'}`}>
            {currentStats.suddenDeath ? 'SUDDEN DEATH!' : `Time: ${formatTime(currentStats.elapsedTime)}`}
          </div>
        </div>

        <div className="text-right">
          <div className="text-[#00ffff] font-bold text-sm mb-1">
            {mode === 'ai'
              ? `CPU (${aiDifficulty.charAt(0).toUpperCase()})`
              : mode === 'online'
                ? (opponentName || 'PLAYER 2')
                : 'PLAYER 2'}
          </div>
          <div className="w-32 md:w-48 h-4 bg-black border border-[#00ffff] rounded overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#008888] to-[#00ffff] transition-all duration-200"
              style={{ width: `${currentStats.p2Health}%` }}
            />
          </div>
        </div>
      </div>

      {/* Game Canvas - Responsive - Centered */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          width={Constants.GAME_WIDTH}
          height={Constants.GAME_HEIGHT}
          className="border-2 border-gray-700 shadow-[0_0_30px_rgba(0,255,255,0.1)]"
          style={{
            width: `${width}px`,
            height: `${height}px`,
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        />
      </div>

      {/* Mobile Controls */}
      <MobileControls
        onP1Move={(vector: Vector) => {
          gameRef.current?.getInputManager().setJoystickMovement(1, vector);
        }}
        onP1MoveEnd={() => {
          gameRef.current?.getInputManager().resetJoystick(1);
        }}
        onP1ShootStart={() => {
          gameRef.current?.getInputManager().setShootButton(1, true);
        }}
        onP1ShootEnd={() => {
          gameRef.current?.getInputManager().setShootButton(1, false);
        }}
        onP2Move={(vector: Vector) => {
          gameRef.current?.getInputManager().setJoystickMovement(2, vector);
        }}
        onP2MoveEnd={() => {
          gameRef.current?.getInputManager().resetJoystick(2);
        }}
        onP2ShootStart={() => {
          gameRef.current?.getInputManager().setShootButton(2, true);
        }}
        onP2ShootEnd={() => {
          gameRef.current?.getInputManager().setShootButton(2, false);
        }}
        p1Reloading={false}
        p2Reloading={false}
        p1ChargeLevel={0}
        p2ChargeLevel={0}
        isOnlineMode={mode === 'online'}
      />
    </div>
  );
}
