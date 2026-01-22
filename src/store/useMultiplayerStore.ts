'use client';

import { create } from 'zustand';
import type { GameStateSnapshot } from '@/lib/socket/events';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'matchmaking' | 'matched' | 'in_game' | 'error';

export interface MultiplayerState {
  // Connection state
  connectionStatus: ConnectionStatus;
  sessionId: string | null;
  playerId: string | null;
  playerName: string;

  // Opponent info
  opponentId: string | null;
  opponentName: string | null;

  // Game state
  assignedTankId: number | null;
  countdown: number | null;
  roundNumber: number;

  // Network stats
  latency: number;
  queuePosition: number | null;

  // Error handling
  error: string | null;

  // Game state snapshot from server
  gameState: GameStateSnapshot | null;

  // Actions
  setConnectionStatus: (status: ConnectionStatus) => void;
  setSessionInfo: (sessionId: string, playerId: string) => void;
  setPlayerName: (name: string) => void;
  setOpponent: (id: string, name: string) => void;
  setAssignedTankId: (tankId: number) => void;
  setCountdown: (countdown: number | null) => void;
  setRoundNumber: (round: number) => void;
  setLatency: (ms: number) => void;
  setQueuePosition: (pos: number | null) => void;
  setError: (error: string | null) => void;
  setGameState: (state: GameStateSnapshot | null) => void;
  reset: () => void;
}

const initialState = {
  connectionStatus: 'disconnected' as ConnectionStatus,
  sessionId: null,
  playerId: null,
  playerName: 'Player',
  opponentId: null,
  opponentName: null,
  assignedTankId: null,
  countdown: null,
  roundNumber: 0,
  latency: 0,
  queuePosition: null,
  error: null,
  gameState: null,
};

export const useMultiplayerStore = create<MultiplayerState>((set) => ({
  ...initialState,

  setConnectionStatus: (status) => set({ connectionStatus: status, error: status === 'error' ? null : undefined }),

  setSessionInfo: (sessionId, playerId) => set({ sessionId, playerId }),

  setPlayerName: (name) => set({ playerName: name }),

  setOpponent: (id, name) => set({ opponentId: id, opponentName: name }),

  setAssignedTankId: (tankId) => set({ assignedTankId: tankId }),

  setCountdown: (countdown) => set({ countdown }),

  setRoundNumber: (round) => set({ roundNumber: round }),

  setLatency: (ms) => set({ latency: ms }),

  setQueuePosition: (pos) => set({ queuePosition: pos }),

  setError: (error) => set({ error, connectionStatus: error ? 'error' : undefined }),

  setGameState: (state) => set({ gameState: state }),

  reset: () => set(initialState),
}));
