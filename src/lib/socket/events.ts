// Socket.io Event Type Definitions for Neon Tank Duel

import { BulletType } from '@/engine/entities/Bullet';
import { PowerUpType } from '@/engine/entities/PowerUp';

// ============================================================================
// Player Input Structure
// ============================================================================

export interface PlayerInput {
  // Movement vector (-1 to 1 for each axis)
  movement: {
    x: number;
    y: number;
  };
  // Is the player shooting
  shoot: boolean;
  // Charge level for charged shots (0-100)
  chargeLevel: number;
  // Input sequence number for reconciliation
  sequenceNumber: number;
  // Timestamp when input was created
  timestamp: number;
  // Timestamp when shoot button was pressed (for lag compensation)
  shootTimestamp?: number;
}

// ============================================================================
// Serialized Game Entities
// ============================================================================

export interface SerializedTank {
  id: number;
  x: number;
  y: number;
  angle: number;
  health: number;
  maxHealth: number;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  reloadProgress: number; // 0-1
  chargeLevel: number;
  isCharging: boolean;
  currentWeapon: BulletType;
  speedTimer: number;
  shieldTimer: number;
  weaponTimer: number;
  dead: boolean;
  color: string;
}

export interface SerializedBullet {
  id: string;
  x: number;
  y: number;
  velX: number;
  velY: number;
  radius: number;
  color: string;
  ownerId: number;
  type: BulletType;
  bounces: number;
}

export interface SerializedPowerUp {
  id: string;
  x: number;
  y: number;
  type: PowerUpType;
  active: boolean;
}

export interface SerializedWall {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  active: boolean;
  health?: number;
  maxHealth?: number;
  destructible: boolean;
}

export interface SerializedHazard {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: 'RADIATION' | 'SPIKE';
}

// ============================================================================
// Game State
// ============================================================================

export interface GameStateSnapshot {
  // Server tick number
  tick: number;
  // Server timestamp
  timestamp: number;
  // Last processed input sequence per player
  lastProcessedInput: {
    [playerId: string]: number;
  };
  // Entity data
  tanks: SerializedTank[];
  bullets: SerializedBullet[];
  powerups: SerializedPowerUp[];
  walls: SerializedWall[];
  hazards: SerializedHazard[];
  // Game state
  scores: {
    p1: number;
    p2: number;
  };
  gameTime: number;
  suddenDeath: boolean;
  suddenDeathInset: number;
  // Round info
  roundNumber: number;
  roundActive: boolean;
  // Server configuration
  tickRate: number; // Server tick rate (Hz) for client interpolation tuning
  // Delta compression support
  isDelta?: boolean; // True if this is a delta update
  removedBullets?: string[]; // IDs of bullets that were removed
}

// ============================================================================
// Player & Session Info
// ============================================================================

export interface PlayerInfo {
  id: string;
  name: string;
  tankId: number; // 1 or 2
  connected: boolean;
  latency: number;
}

export interface SessionInfo {
  sessionId: string;
  players: PlayerInfo[];
  gameState: 'waiting' | 'countdown' | 'playing' | 'round_over' | 'game_over';
  countdown?: number;
  createdAt: number;
}

// ============================================================================
// Client to Server Events
// ============================================================================

export interface JoinGamePayload {
  sessionId: string;
  playerId: string;
  playerName: string;
  gameSettings?: {
    scoreLimitValue: number;
    timeLimitEnabled: boolean;
    timeLimitSeconds: number;
  };
}

export interface LeaveGamePayload {
  sessionId: string;
  playerId: string;
  reason?: 'disconnect' | 'quit' | 'timeout';
}

export interface PlayerInputPayload {
  sessionId: string;
  playerId: string;
  input: PlayerInput;
}

export interface ReadyPayload {
  sessionId: string;
  playerId: string;
}

export interface ChatMessagePayload {
  sessionId: string;
  playerId: string;
  message: string;
}

// Map of client to server events
export interface ClientToServerEvents {
  join_game: (payload: JoinGamePayload, callback: (response: JoinGameResponse) => void) => void;
  leave_game: (payload: LeaveGamePayload) => void;
  player_input: (payload: PlayerInputPayload) => void;
  player_ready: (payload: ReadyPayload) => void;
  chat_message: (payload: ChatMessagePayload) => void;
  ping: (timestamp: number, callback: (serverTime: number) => void) => void;
}

// ============================================================================
// Server to Client Events
// ============================================================================

export interface JoinGameResponse {
  success: boolean;
  error?: string;
  session?: SessionInfo;
  assignedTankId?: number;
}

export interface GameStatePayload {
  sessionId: string;
  state: GameStateSnapshot;
}

export interface PlayerJoinedPayload {
  sessionId: string;
  player: PlayerInfo;
}

export interface PlayerLeftPayload {
  sessionId: string;
  playerId: string;
  reason: 'disconnect' | 'quit' | 'timeout';
}

export interface GameOverPayload {
  sessionId: string;
  winner: number; // Tank ID (1 or 2)
  finalScores: {
    p1: number;
    p2: number;
  };
  stats: {
    totalRounds: number;
    gameDuration: number;
  };
}

export interface MatchFoundPayload {
  sessionId: string;
  opponent: PlayerInfo;
  assignedTankId: number;
}

export interface RoundStartPayload {
  sessionId: string;
  roundNumber: number;
  countdown: number;
}

export interface RoundOverPayload {
  sessionId: string;
  roundNumber: number;
  winner: number;
  scores: {
    p1: number;
    p2: number;
  };
}

export interface CountdownPayload {
  sessionId: string;
  countdown: number;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

// Map of server to client events
export interface ServerToClientEvents {
  game_state: (payload: GameStatePayload) => void;
  player_joined: (payload: PlayerJoinedPayload) => void;
  player_left: (payload: PlayerLeftPayload) => void;
  game_over: (payload: GameOverPayload) => void;
  match_found: (payload: MatchFoundPayload) => void;
  round_start: (payload: RoundStartPayload) => void;
  round_over: (payload: RoundOverPayload) => void;
  countdown: (payload: CountdownPayload) => void;
  error: (payload: ErrorPayload) => void;
  chat_received: (payload: { playerId: string; playerName: string; message: string }) => void;
  pong: (serverTime: number) => void;
}

// ============================================================================
// Inter-Server Events (for scaling)
// ============================================================================

export interface InterServerEvents {
  ping: () => void;
}

// ============================================================================
// Socket Data (per-socket)
// ============================================================================

export interface SocketData {
  playerId: string;
  playerName: string;
  sessionId: string | null;
  tankId: number | null;
  lastActivity: number;
}
