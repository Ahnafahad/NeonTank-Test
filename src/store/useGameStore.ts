'use client';

import { create } from 'zustand';

export type GameMode = 'local' | 'ai' | 'online';
export type GameScreen = 'menu' | 'modeSelect' | 'options' | 'playing' | 'gameover';
export type AIDifficulty = 'easy' | 'medium' | 'hard';
export type PlayerControls = 'wasd' | 'arrows';

interface GameState {
  // Navigation
  currentScreen: GameScreen;

  // Game mode
  mode: GameMode;

  // AI settings
  aiDifficulty: AIDifficulty;
  playerControls: PlayerControls;

  // Game state
  isPlaying: boolean;
  isPaused: boolean;

  // Scores (persists across rounds)
  scores: { p1: number; p2: number };

  // Current game stats (updated during play)
  currentStats: {
    p1Health: number;
    p2Health: number;
    elapsedTime: number;
    suddenDeath: boolean;
  };

  // Winner of last round
  lastWinner: 1 | 2 | null;

  // Multiplayer
  sessionId: string | null;
  opponentId: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'searching' | 'connected';

  // Actions
  setScreen: (screen: GameScreen) => void;
  setMode: (mode: GameMode) => void;
  setAIDifficulty: (difficulty: AIDifficulty) => void;
  setPlayerControls: (controls: PlayerControls) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: (winner: 1 | 2) => void;
  updateStats: (stats: Partial<GameState['currentStats']>) => void;
  resetScores: () => void;
  goToMainMenu: () => void;

  // Multiplayer actions
  setConnectionStatus: (status: GameState['connectionStatus']) => void;
  setSessionId: (sessionId: string | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  // Initial state
  currentScreen: 'menu',
  mode: 'local',
  aiDifficulty: 'medium',
  playerControls: 'wasd',
  isPlaying: false,
  isPaused: false,
  scores: { p1: 0, p2: 0 },
  currentStats: {
    p1Health: 100,
    p2Health: 100,
    elapsedTime: 0,
    suddenDeath: false,
  },
  lastWinner: null,
  sessionId: null,
  opponentId: null,
  connectionStatus: 'disconnected',

  // Actions
  setScreen: (screen) => set({ currentScreen: screen }),

  setMode: (mode) => set({ mode }),

  setAIDifficulty: (aiDifficulty) => set({ aiDifficulty }),

  setPlayerControls: (playerControls) => set({ playerControls }),

  startGame: () => set({
    currentScreen: 'playing',
    isPlaying: true,
    isPaused: false,
    currentStats: {
      p1Health: 100,
      p2Health: 100,
      elapsedTime: 0,
      suddenDeath: false,
    },
    lastWinner: null,
  }),

  pauseGame: () => set({ isPaused: true }),

  resumeGame: () => set({ isPaused: false }),

  endGame: (winner) => set((state) => ({
    isPlaying: false,
    currentScreen: 'gameover',
    lastWinner: winner,
    scores: {
      p1: state.scores.p1 + (winner === 1 ? 1 : 0),
      p2: state.scores.p2 + (winner === 2 ? 1 : 0),
    },
  })),

  updateStats: (stats) => set((state) => ({
    currentStats: { ...state.currentStats, ...stats },
  })),

  resetScores: () => set({ scores: { p1: 0, p2: 0 } }),

  goToMainMenu: () => set({
    currentScreen: 'menu',
    isPlaying: false,
    isPaused: false,
    lastWinner: null,
    connectionStatus: 'disconnected',
    sessionId: null,
  }),

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  setSessionId: (sessionId) => set({ sessionId }),
}));
