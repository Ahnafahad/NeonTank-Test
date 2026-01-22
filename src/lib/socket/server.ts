// Socket.io Server Configuration for Neon Tank Duel

import { Server as NetServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  SessionInfo,
  PlayerInfo,
  GameStateSnapshot,
  PlayerInput,
  SerializedTank,
} from './events';

// ============================================================================
// Types
// ============================================================================

export type NeonTankSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type NeonTankServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// ============================================================================
// Game Session
// ============================================================================

export interface GameSession {
  id: string;
  players: Map<string, PlayerInfo>;
  sockets: Map<string, string>; // playerId -> socketId
  gameState: SessionInfo['gameState'];
  stateSnapshot: GameStateSnapshot | null;
  inputBuffer: Map<string, PlayerInput[]>;
  tickRate: number;
  tickInterval: NodeJS.Timeout | null;
  currentTick: number;
  createdAt: number;
  lastActivity: number;
  roundNumber: number;
  scores: { p1: number; p2: number };
}

// ============================================================================
// Room & Session Management
// ============================================================================

class SessionManager {
  private sessions: Map<string, GameSession> = new Map();
  private playerToSession: Map<string, string> = new Map();

  createSession(sessionId: string): GameSession {
    const session: GameSession = {
      id: sessionId,
      players: new Map(),
      sockets: new Map(),
      gameState: 'waiting',
      stateSnapshot: null,
      inputBuffer: new Map(),
      tickRate: 30, // 30 Hz server tick rate
      tickInterval: null,
      currentTick: 0,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      roundNumber: 0,
      scores: { p1: 0, p2: 0 },
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): GameSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionByPlayer(playerId: string): GameSession | undefined {
    const sessionId = this.playerToSession.get(playerId);
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  addPlayerToSession(sessionId: string, player: PlayerInfo, socketId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Max 2 players per session
    if (session.players.size >= 2) return false;

    session.players.set(player.id, player);
    session.sockets.set(player.id, socketId);
    session.inputBuffer.set(player.id, []);
    session.lastActivity = Date.now();
    this.playerToSession.set(player.id, sessionId);

    return true;
  }

  removePlayerFromSession(playerId: string): GameSession | undefined {
    const sessionId = this.playerToSession.get(playerId);
    if (!sessionId) return undefined;

    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.players.delete(playerId);
    session.sockets.delete(playerId);
    session.inputBuffer.delete(playerId);
    this.playerToSession.delete(playerId);

    // If session is empty, clean it up
    if (session.players.size === 0) {
      if (session.tickInterval) {
        clearInterval(session.tickInterval);
      }
      this.sessions.delete(sessionId);
    }

    return session;
  }

  updatePlayerSocket(playerId: string, socketId: string): void {
    const session = this.getSessionByPlayer(playerId);
    if (session) {
      session.sockets.set(playerId, socketId);
    }
  }

  isSessionReady(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session !== undefined && session.players.size === 2;
  }

  getAllSessions(): GameSession[] {
    return Array.from(this.sessions.values());
  }

  cleanupInactiveSessions(maxAge: number = 30 * 60 * 1000): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity > maxAge) {
        if (session.tickInterval) {
          clearInterval(session.tickInterval);
        }
        for (const playerId of session.players.keys()) {
          this.playerToSession.delete(playerId);
        }
        this.sessions.delete(sessionId);
      }
    }
  }
}

// ============================================================================
// Socket Server Singleton
// ============================================================================

let io: NeonTankServer | null = null;
const sessionManager = new SessionManager();

// ============================================================================
// Initialize Socket Server
// ============================================================================

export function initializeSocketServer(httpServer: NetServer): NeonTankServer {
  if (io) {
    console.log('[Socket.io] Server already initialized');
    return io;
  }

  io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? process.env.NEXT_PUBLIC_APP_URL
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // ============================================================================
  // Connection Handler
  // ============================================================================

  io.on('connection', (socket: NeonTankSocket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Initialize socket data
    socket.data.lastActivity = Date.now();
    socket.data.sessionId = null;
    socket.data.tankId = null;

    // ========================================================================
    // Join Game Handler
    // ========================================================================

    socket.on('join_game', (payload, callback) => {
      const { sessionId, playerId, playerName } = payload;

      console.log(`[Socket.io] Player ${playerId} (${playerName}) joining session ${sessionId}`);

      // Get or create session
      let session = sessionManager.getSession(sessionId);
      if (!session) {
        session = sessionManager.createSession(sessionId);
      }

      // Check if session is full
      if (session.players.size >= 2) {
        callback({
          success: false,
          error: 'Session is full',
        });
        return;
      }

      // Assign tank ID (1 or 2)
      const assignedTankId = session.players.size === 0 ? 1 : 2;

      // Create player info
      const player: PlayerInfo = {
        id: playerId,
        name: playerName,
        tankId: assignedTankId,
        connected: true,
        latency: 0,
      };

      // Add player to session
      const added = sessionManager.addPlayerToSession(sessionId, player, socket.id);
      if (!added) {
        callback({
          success: false,
          error: 'Failed to join session',
        });
        return;
      }

      // Update socket data
      socket.data.playerId = playerId;
      socket.data.playerName = playerName;
      socket.data.sessionId = sessionId;
      socket.data.tankId = assignedTankId;

      // Join socket room
      socket.join(sessionId);

      // Notify other players in session
      socket.to(sessionId).emit('player_joined', {
        sessionId,
        player,
      });

      // Build session info for response
      const sessionInfo: SessionInfo = {
        sessionId,
        players: Array.from(session.players.values()),
        gameState: session.gameState,
        createdAt: session.createdAt,
      };

      callback({
        success: true,
        session: sessionInfo,
        assignedTankId,
      });

      // Check if game can start
      if (sessionManager.isSessionReady(sessionId)) {
        startGameCountdown(sessionId);
      }
    });

    // ========================================================================
    // Leave Game Handler
    // ========================================================================

    socket.on('leave_game', (payload) => {
      const { sessionId, playerId, reason } = payload;

      console.log(`[Socket.io] Player ${playerId} leaving session ${sessionId}: ${reason}`);

      handlePlayerLeave(socket, playerId, reason || 'quit');
    });

    // ========================================================================
    // Player Input Handler
    // ========================================================================

    socket.on('player_input', (payload) => {
      const { sessionId, playerId, input } = payload;

      const session = sessionManager.getSession(sessionId);
      if (!session) return;

      // Buffer the input
      const playerInputs = session.inputBuffer.get(playerId);
      if (playerInputs) {
        playerInputs.push(input);
        // Keep only last 10 inputs to prevent memory issues
        if (playerInputs.length > 10) {
          playerInputs.shift();
        }
      }

      session.lastActivity = Date.now();
    });

    // ========================================================================
    // Player Ready Handler
    // ========================================================================

    socket.on('player_ready', (payload) => {
      const { sessionId, playerId } = payload;

      console.log(`[Socket.io] Player ${playerId} ready in session ${sessionId}`);

      const session = sessionManager.getSession(sessionId);
      if (!session) return;

      const player = session.players.get(playerId);
      if (player) {
        // Mark player as ready (could add a ready flag to PlayerInfo)
        session.lastActivity = Date.now();
      }
    });

    // ========================================================================
    // Ping Handler (for latency measurement)
    // ========================================================================

    socket.on('ping', (clientTime, callback) => {
      callback(Date.now());
    });

    // ========================================================================
    // Chat Message Handler
    // ========================================================================

    socket.on('chat_message', (payload) => {
      const { sessionId, playerId, message } = payload;

      const session = sessionManager.getSession(sessionId);
      if (!session) return;

      const player = session.players.get(playerId);
      if (!player) return;

      // Broadcast to all players in session
      if (io) {
        io.to(sessionId).emit('chat_received', {
          playerId,
          playerName: player.name,
          message: message.substring(0, 200), // Limit message length
        });
      }
    });

    // ========================================================================
    // Disconnect Handler
    // ========================================================================

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}, reason: ${reason}`);

      if (socket.data.playerId && socket.data.sessionId) {
        handlePlayerLeave(socket, socket.data.playerId, 'disconnect');
      }
    });
  });

  // Periodic cleanup
  setInterval(() => {
    sessionManager.cleanupInactiveSessions();
  }, 60000); // Every minute

  console.log('[Socket.io] Server initialized');

  return io;
}

// ============================================================================
// Helper Functions
// ============================================================================

function handlePlayerLeave(
  socket: NeonTankSocket,
  playerId: string,
  reason: 'disconnect' | 'quit' | 'timeout'
): void {
  const session = sessionManager.removePlayerFromSession(playerId);

  if (session && io) {
    // Leave socket room
    socket.leave(session.id);

    // Notify remaining players
    io.to(session.id).emit('player_left', {
      sessionId: session.id,
      playerId,
      reason,
    });

    // If game was in progress, end it
    if (session.gameState === 'playing' || session.gameState === 'countdown') {
      // Find remaining player and declare them winner
      const remainingPlayer = Array.from(session.players.values())[0];
      if (remainingPlayer) {
        io.to(session.id).emit('game_over', {
          sessionId: session.id,
          winner: remainingPlayer.tankId,
          finalScores: session.scores,
          stats: {
            totalRounds: session.roundNumber,
            gameDuration: Date.now() - session.createdAt,
          },
        });
      }
    }
  }
}

function startGameCountdown(sessionId: string): void {
  const session = sessionManager.getSession(sessionId);
  if (!session || !io) return;

  session.gameState = 'countdown';
  session.roundNumber = 1;

  let countdown = 3;

  // Notify match found
  const players = Array.from(session.players.values());
  for (const player of players) {
    const opponent = players.find((p) => p.id !== player.id);
    const socketId = session.sockets.get(player.id);

    if (socketId && opponent) {
      io.to(socketId).emit('match_found', {
        sessionId,
        opponent,
        assignedTankId: player.tankId,
      });
    }
  }

  // Countdown timer
  const countdownInterval = setInterval(() => {
    if (!io) {
      clearInterval(countdownInterval);
      return;
    }

    io.to(sessionId).emit('countdown', { sessionId, countdown });
    countdown--;

    if (countdown < 0) {
      clearInterval(countdownInterval);
      startGame(sessionId);
    }
  }, 1000);
}

function startGame(sessionId: string): void {
  const session = sessionManager.getSession(sessionId);
  if (!session || !io) return;

  session.gameState = 'playing';

  io.to(sessionId).emit('round_start', {
    sessionId,
    roundNumber: session.roundNumber,
    countdown: 0,
  });

  // Start game tick loop
  session.tickInterval = setInterval(() => {
    processGameTick(sessionId);
  }, 1000 / session.tickRate);
}

function processGameTick(sessionId: string): void {
  const session = sessionManager.getSession(sessionId);
  if (!session || !io) return;

  session.currentTick++;

  // Process inputs and update game state
  // This is a placeholder - actual game logic will be integrated later
  const lastProcessedInput: { [playerId: string]: number } = {};

  for (const [playerId, inputs] of session.inputBuffer) {
    if (inputs.length > 0) {
      const lastInput = inputs[inputs.length - 1];
      lastProcessedInput[playerId] = lastInput.sequenceNumber;
      // Clear processed inputs
      inputs.length = 0;
    }
  }

  // Create state snapshot
  // This is a placeholder - actual state will come from game engine
  const stateSnapshot: GameStateSnapshot = {
    tick: session.currentTick,
    timestamp: Date.now(),
    lastProcessedInput,
    tanks: createPlaceholderTanks(session),
    bullets: [],
    powerups: [],
    walls: [],
    hazards: [],
    scores: session.scores,
    gameTime: (Date.now() - session.createdAt) / 1000,
    suddenDeath: false,
    suddenDeathInset: 0,
    roundNumber: session.roundNumber,
    roundActive: true,
  };

  session.stateSnapshot = stateSnapshot;

  // Broadcast state to all players
  io.to(sessionId).emit('game_state', {
    sessionId,
    state: stateSnapshot,
  });
}

function createPlaceholderTanks(session: GameSession): SerializedTank[] {
  const tanks: SerializedTank[] = [];

  for (const player of session.players.values()) {
    tanks.push({
      id: player.tankId,
      x: player.tankId === 1 ? 100 : 700,
      y: 300,
      angle: player.tankId === 1 ? 0 : Math.PI,
      health: 100,
      maxHealth: 100,
      ammo: 5,
      maxAmmo: 5,
      isReloading: false,
      reloadProgress: 0,
      chargeLevel: 0,
      isCharging: false,
      currentWeapon: 'NORMAL',
      speedTimer: 0,
      shieldTimer: 0,
      weaponTimer: 0,
      dead: false,
      color: player.tankId === 1 ? '#00ff88' : '#ff0088',
    });
  }

  return tanks;
}

// ============================================================================
// Exports
// ============================================================================

export function getSocketServer(): NeonTankServer | null {
  return io;
}

export function getSessionManager(): SessionManager {
  return sessionManager;
}

export { sessionManager };
