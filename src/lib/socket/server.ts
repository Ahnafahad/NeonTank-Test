// Socket.io Server Configuration for Neon Tank Duel

import { Logger } from '@/lib/logging/Logger';
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
  SerializedBullet,
  SerializedPowerUp,
  SerializedWall,
  SerializedHazard,
} from './events';
import { Tank, TankControls } from '@/engine/entities/Tank';
import { Bullet } from '@/engine/entities/Bullet';
import { PowerUp, PowerUpType } from '@/engine/entities/PowerUp';
import { Wall } from '@/engine/entities/Wall';
import { Hazard } from '@/engine/entities/Hazard';
import { Constants } from '@/engine/utils/Constants';
import { SpatialGrid } from '@/engine/utils/SpatialGrid';

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
// Lag Compensation
// ============================================================================

interface HistoricalState {
  timestamp: number;
  tick: number;
  tankPositions: Map<number, { x: number; y: number; angle: number }>;
}

interface BulletMetadata {
  shootTimestamp: number;
  shooterLatency: number;
}

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
  // Game entities
  tanks: Map<number, Tank>; // tankId -> Tank
  bullets: Bullet[];
  bulletMetadata: Map<Bullet, BulletMetadata>; // Track lag compensation data per bullet
  powerups: PowerUp[];
  walls: Wall[];
  crates: Wall[];
  hazards: Hazard[];
  // Game state
  gameStartTime: number;
  lastPowerUpTime: number;
  suddenDeathActive: boolean;
  suddenDeathInset: number;
  // Game settings
  settings?: {
    scoreLimitValue: number;
    timeLimitEnabled: boolean;
    timeLimitSeconds: number;
  };
  // Delta compression
  lastBroadcastState: GameStateSnapshot | null;
  // Spatial partitioning
  spatialGrid: SpatialGrid<Tank | Bullet>;
  // Lag compensation - state history for rewinding
  stateHistory: HistoricalState[];
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
      tickRate: 60, // 60 Hz server tick rate for Valorant-level responsiveness
      tickInterval: null,
      currentTick: 0,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      roundNumber: 0,
      scores: { p1: 0, p2: 0 },
      // Game entities
      tanks: new Map(),
      bullets: [],
      bulletMetadata: new Map(),
      powerups: [],
      walls: [],
      crates: [],
      hazards: [],
      // Game state
      gameStartTime: Date.now(),
      lastPowerUpTime: Date.now(),
      suddenDeathActive: false,
      suddenDeathInset: 0,
      // Delta compression
      lastBroadcastState: null,
      // Spatial partitioning
      spatialGrid: new SpatialGrid(Constants.GAME_WIDTH, Constants.GAME_HEIGHT, 100),
      // Lag compensation
      stateHistory: [],
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
    Logger.debug('[Socket.io] Server already initialized');
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
    Logger.debug(`[Socket.io] Client connected: ${socket.id}`);

    // Initialize socket data
    socket.data.lastActivity = Date.now();
    socket.data.sessionId = null;
    socket.data.tankId = null;

    // ========================================================================
    // Join Game Handler
    // ========================================================================

    socket.on('join_game', (payload, callback) => {
      const { sessionId, playerId, playerName, gameSettings } = payload;

      Logger.debug(`[Socket.io] Player ${playerId} (${playerName}) joining session ${sessionId}`);

      // Get or create session
      let session = sessionManager.getSession(sessionId);
      if (!session) {
        session = sessionManager.createSession(sessionId);
      }

      // Store game settings (first player to join sets the settings)
      if (!session.settings && gameSettings) {
        session.settings = {
          scoreLimitValue: gameSettings.scoreLimitValue || 5,
          timeLimitEnabled: gameSettings.timeLimitEnabled || false,
          timeLimitSeconds: gameSettings.timeLimitSeconds || 120,
        };
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

      Logger.debug(`[Socket.io] Player ${playerId} leaving session ${sessionId}: ${reason}`);

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

      Logger.debug(`[Socket.io] Player ${playerId} ready in session ${sessionId}`);

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
      Logger.debug(`[Socket.io] Client disconnected: ${socket.id}, reason: ${reason}`);

      if (socket.data.playerId && socket.data.sessionId) {
        handlePlayerLeave(socket, socket.data.playerId, 'disconnect');
      }
    });
  });

  // Periodic cleanup
  setInterval(() => {
    sessionManager.cleanupInactiveSessions();
  }, 60000); // Every minute

  Logger.debug('[Socket.io] Server initialized');

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

// ============================================================================
// Game State Management
// ============================================================================

function initializeGameEntities(session: GameSession): void {
  // Clear existing entities
  session.tanks.clear();
  session.bullets = [];
  session.powerups = [];
  session.walls = [];
  session.crates = [];
  session.hazards = [];

  // Create tanks for each player
  const players = Array.from(session.players.values());
  for (const player of players) {
    const controls: TankControls = {
      up: 'KeyW',
      down: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      shoot: 'Space',
    };

    const x = player.tankId === 1 ? 100 : 900;
    const y = 350;
    const color = player.tankId === 1 ? Constants.PLAYER1_COLOR : Constants.PLAYER2_COLOR;

    const tank = new Tank(player.tankId, x, y, color, controls);
    session.tanks.set(player.tankId, tank);
  }

  // Create map - Static Walls
  session.walls.push(new Wall(450, 300, 100, 100)); // Center

  session.walls.push(new Wall(150, 100, 50, 150));
  session.walls.push(new Wall(800, 100, 50, 150));
  session.walls.push(new Wall(150, 450, 50, 150));
  session.walls.push(new Wall(800, 450, 50, 150));

  // Hazard Zones
  session.hazards.push(new Hazard(425, 50, 150, 100, 'RADIATION'));
  session.hazards.push(new Hazard(425, 550, 150, 100, 'RADIATION'));

  // Destructible Crates
  session.crates.push(new Wall(250, 200, 40, 40, true));
  session.crates.push(new Wall(250, 460, 40, 40, true));
  session.crates.push(new Wall(710, 200, 40, 40, true));
  session.crates.push(new Wall(710, 460, 40, 40, true));
  session.crates.push(new Wall(450, 200, 100, 40, true));
  session.crates.push(new Wall(450, 460, 100, 40, true));

  // Log crate IDs for debugging flickering
  console.log('[Server] Created crates with IDs:', session.crates.map(c => c.id).join(', '));

  // Reset game state
  session.gameStartTime = Date.now();
  session.lastPowerUpTime = Date.now();
  session.suddenDeathActive = false;
  session.suddenDeathInset = 0;
}

function spawnPowerUp(session: GameSession): void {
  if (session.powerups.length >= Constants.POWERUP_MAX_COUNT) return;

  // Find empty spot
  const x = Math.random() * (Constants.GAME_WIDTH - 100) + 50;
  const y = Math.random() * (Constants.GAME_HEIGHT - 100) + 50;

  // Check collision with walls/crates
  const allWalls = [...session.walls, ...session.crates];
  for (const w of allWalls) {
    if (
      w.active &&
      x > w.x - 20 &&
      x < w.x + w.w + 20 &&
      y > w.y - 20 &&
      y < w.y + w.h + 20
    )
      return;
  }

  const types: PowerUpType[] = ['HEALTH', 'SPEED', 'SHOTGUN', 'LASER', 'SHIELD'];
  const type = types[Math.floor(Math.random() * types.length)];
  session.powerups.push(new PowerUp(x, y, type));
}

function serializeTank(tank: Tank): SerializedTank {
  return {
    id: tank.id,
    x: tank.pos.x,
    y: tank.pos.y,
    angle: tank.angle,
    health: tank.health,
    maxHealth: tank.maxHealth,
    ammo: tank.ammo,
    maxAmmo: tank.maxAmmo,
    isReloading: tank.isReloading,
    reloadProgress: tank.isReloading ? (tank.reloadTimer / tank.reloadDuration) : 0,
    chargeLevel: tank.chargeLevel,
    isCharging: tank.isCharging,
    currentWeapon: tank.currentWeapon,
    speedTimer: tank.speedTimer,
    shieldTimer: tank.shieldTimer,
    weaponTimer: tank.weaponTimer,
    dead: tank.dead,
    color: tank.color,
  };
}

function serializeBullet(bullet: Bullet): SerializedBullet {
  return {
    id: bullet.id,
    x: bullet.pos.x,
    y: bullet.pos.y,
    velX: bullet.vel.x,
    velY: bullet.vel.y,
    radius: bullet.radius,
    color: bullet.color,
    ownerId: bullet.ownerId,
    type: bullet.type,
    bounces: bullet.bounces,
  };
}

function serializePowerUp(powerup: PowerUp): SerializedPowerUp {
  return {
    id: powerup.id, // Use entity's actual ID instead of generating new one
    x: powerup.pos.x,
    y: powerup.pos.y,
    type: powerup.type,
    active: powerup.active,
  };
}

function serializeWall(wall: Wall, index: number): SerializedWall {
  return {
    id: wall.id, // Use entity's actual ID instead of generating new one
    x: wall.x,
    y: wall.y,
    w: wall.w,
    h: wall.h,
    active: wall.active,
    health: wall.destructible ? wall.health : undefined,
    maxHealth: wall.destructible ? Constants.WALL_HEALTH : undefined,
    destructible: wall.destructible,
  };
}

function serializeHazard(hazard: Hazard, index: number): SerializedHazard {
  return {
    id: `hazard-${index}`,
    x: hazard.x,
    y: hazard.y,
    radius: Math.sqrt(hazard.w * hazard.h) / 2,
    type: hazard.type,
  };
}

function startGameCountdown(sessionId: string): void {
  const session = sessionManager.getSession(sessionId);
  if (!session || !io) return;

  session.gameState = 'countdown';
  session.roundNumber = 1;

  // Initialize game entities
  initializeGameEntities(session);

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
  session.gameStartTime = Date.now(); // Initialize timer

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

// ============================================================================
// Input Processing Helpers
// ============================================================================

function deduplicateInputs(inputs: PlayerInput[]): PlayerInput[] {
  const seen = new Set<number>();
  const unique: PlayerInput[] = [];

  for (const input of inputs) {
    if (!seen.has(input.sequenceNumber)) {
      seen.add(input.sequenceNumber);
      unique.push(input);
    }
  }

  // Sort by sequence number for correct replay order
  return unique.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
}

function batchIdenticalInputs(inputs: PlayerInput[]): PlayerInput[] {
  if (inputs.length === 0) return inputs;

  const batched: PlayerInput[] = [];
  let lastInput: PlayerInput | null = null;

  for (const input of inputs) {
    if (!lastInput || !inputsEqual(input, lastInput)) {
      // Input changed, keep it
      batched.push(input);
      lastInput = input;
    }
    // If inputs are identical, skip (batch them together)
  }

  return batched;
}

function inputsEqual(a: PlayerInput, b: PlayerInput): boolean {
  return (
    a.movement.x === b.movement.x &&
    a.movement.y === b.movement.y &&
    a.shoot === b.shoot &&
    a.chargeLevel === b.chargeLevel
  );
}

// ============================================================================
// Delta Compression Helpers
// ============================================================================

function computeStateDelta(
  currentState: GameStateSnapshot,
  lastState: GameStateSnapshot | null,
  isSlowTick: boolean
): GameStateSnapshot {
  if (!lastState) {
    // First state - send full snapshot
    return currentState;
  }

  // Create delta state
  const delta: GameStateSnapshot = {
    ...currentState,
    isDelta: true,
    tanks: [],
    bullets: [],
    powerups: [],
    walls: [],
    hazards: [],
    removedBullets: [],
  };

  // 1. Tanks - include only if changed (position, angle, health, ammo)
  for (const tank of currentState.tanks) {
    const lastTank = lastState.tanks.find((t) => t.id === tank.id);
    if (!lastTank || tankHasChanged(tank, lastTank)) {
      delta.tanks.push(tank);
    }
  }

  // 2. Bullets - include new bullets and bullets that moved significantly
  const lastBulletIds = new Set(lastState.bullets.map((b) => b.id));
  const currentBulletIds = new Set(currentState.bullets.map((b) => b.id));

  for (const bullet of currentState.bullets) {
    const isNew = !lastBulletIds.has(bullet.id);
    if (isNew) {
      delta.bullets.push(bullet);
    } else {
      const lastBullet = lastState.bullets.find((b) => b.id === bullet.id);
      if (lastBullet && bulletHasMoved(bullet, lastBullet)) {
        delta.bullets.push(bullet);
      }
    }
  }

  // Track removed bullets
  for (const lastBullet of lastState.bullets) {
    if (!currentBulletIds.has(lastBullet.id)) {
      delta.removedBullets!.push(lastBullet.id);
    }
  }

  // 3. Powerups - Send ALL powerups on slow ticks to prevent empty array bug
  // (Typically 0-3 powerups, small bandwidth cost)
  if (isSlowTick) {
    delta.powerups = currentState.powerups; // Always send full powerup list
  } else {
    // On fast ticks, keep last powerup state
    delta.powerups = lastState.powerups;
  }

  // 4. Walls - Send ALL walls on slow ticks to prevent empty array bug
  // (Only 11 walls total, small bandwidth cost)
  if (isSlowTick) {
    delta.walls = currentState.walls; // Always send full wall list
  } else {
    // On fast ticks, keep last wall state
    delta.walls = lastState.walls;
  }

  // 5. Hazards - LOW PRIORITY: static, never send in delta after first state
  delta.hazards = [];

  // 6. Scores - always include (small size)
  // Already included in delta via spread

  return delta;
}

function tankHasChanged(tank: SerializedTank, lastTank: SerializedTank): boolean {
  const posChanged = Math.abs(tank.x - lastTank.x) > 0.1 || Math.abs(tank.y - lastTank.y) > 0.1;
  const angleChanged = Math.abs(tank.angle - lastTank.angle) > 0.01;
  const healthChanged = tank.health !== lastTank.health;
  const ammoChanged = tank.ammo !== lastTank.ammo;
  const stateChanged =
    tank.isReloading !== lastTank.isReloading ||
    tank.isCharging !== lastTank.isCharging ||
    tank.dead !== lastTank.dead;
  const powerupChanged =
    tank.speedTimer !== lastTank.speedTimer ||
    tank.shieldTimer !== lastTank.shieldTimer ||
    tank.weaponTimer !== lastTank.weaponTimer ||
    tank.currentWeapon !== lastTank.currentWeapon;

  return posChanged || angleChanged || healthChanged || ammoChanged || stateChanged || powerupChanged;
}

function bulletHasMoved(bullet: SerializedBullet, lastBullet: SerializedBullet): boolean {
  const distMoved = Math.sqrt(
    Math.pow(bullet.x - lastBullet.x, 2) + Math.pow(bullet.y - lastBullet.y, 2)
  );
  return distMoved > 0.5; // Only send if moved more than 0.5 pixels
}

/**
 * Get historical tank position for lag compensation
 * Rewinds to (shootTimestamp - latency/2) to compensate for network delay
 */
function getHistoricalTankPosition(
  session: GameSession,
  tankId: number,
  shootTimestamp: number,
  shooterLatency: number
): { x: number; y: number; angle: number } | null {
  // Calculate the target time to rewind to
  const rewindTime = shootTimestamp - (shooterLatency / 2);

  // Find the closest historical state
  let closestState: HistoricalState | null = null;
  let minTimeDiff = Infinity;

  for (const state of session.stateHistory) {
    const timeDiff = Math.abs(state.timestamp - rewindTime);
    if (timeDiff < minTimeDiff) {
      minTimeDiff = timeDiff;
      closestState = state;
    }
  }

  if (!closestState) return null;

  // Get tank position from historical state
  return closestState.tankPositions.get(tankId) || null;
}

function processGameTick(sessionId: string): void {
  const session = sessionManager.getSession(sessionId);
  if (!session || !io) return;

  session.currentTick++;

  // Check timer win condition
  if (session.settings?.timeLimitEnabled) {
    const elapsed = Date.now() - session.gameStartTime;
    const timeLimit = session.settings.timeLimitSeconds * 1000;

    if (elapsed >= timeLimit) {
      // Time expired - determine winner by score then health
      let winnerId: number;

      if (session.scores.p1 > session.scores.p2) {
        winnerId = 1;
      } else if (session.scores.p2 > session.scores.p1) {
        winnerId = 2;
      } else {
        // Tied score - use health tiebreaker
        const p1Tank = session.tanks.get(1);
        const p2Tank = session.tanks.get(2);

        if (p1Tank && p2Tank) {
          if (p1Tank.health > p2Tank.health) {
            winnerId = 1;
          } else if (p2Tank.health > p1Tank.health) {
            winnerId = 2;
          } else {
            // Perfect tie - random winner
            winnerId = Math.random() < 0.5 ? 1 : 2;
          }
        } else {
          // Fallback if tanks don't exist
          winnerId = 1;
        }
      }

      endRound(sessionId, winnerId);
      return; // Stop processing this tick
    }
  }

  // Process player inputs and update tanks
  const lastProcessedInput: { [playerId: string]: number } = {};
  const gameSettings = {
    ammoSystem: true,
    charging: true,
    recoil: true,
  };

  for (const [playerId, inputs] of session.inputBuffer) {
    if (inputs.length > 0) {
      // Deduplicate inputs by sequence number (keep only unique)
      const uniqueInputs = deduplicateInputs(inputs);

      // Batch consecutive identical inputs
      const batchedInputs = batchIdenticalInputs(uniqueInputs);

      // Process batched inputs
      for (const input of batchedInputs) {
        lastProcessedInput[playerId] = input.sequenceNumber;

        // Find the player's tank
        const player = session.players.get(playerId);
        if (player) {
          const tank = session.tanks.get(player.tankId);
          if (tank && !tank.dead) {
          // Convert PlayerInput to key state
          const keys: { [key: string]: boolean } = {};

          // Map movement to keys
          if (input.movement.y < -0.1) keys['KeyW'] = true;
          if (input.movement.y > 0.1) keys['KeyS'] = true;
          if (input.movement.x < -0.1) keys['KeyA'] = true;
          if (input.movement.x > 0.1) keys['KeyD'] = true;

          // Map shooting
          if (input.shoot) keys['Space'] = true;

          // Set charge level
          if (input.chargeLevel > 0) {
            tank.chargeLevel = input.chargeLevel;
          }

          // Get the other tank for collision detection
          const otherTankId = player.tankId === 1 ? 2 : 1;
          const otherTank = session.tanks.get(otherTankId);

          if (otherTank) {
            // Update tank and get new bullets
            const newBullets = tank.update(
              keys,
              session.walls,
              session.crates,
              session.hazards,
              otherTank,
              session.suddenDeathActive,
              session.suddenDeathInset,
              gameSettings,
              1.0 // deltaMultiplier
            );

            // Store lag compensation metadata for new bullets
            if (newBullets.length > 0 && input.shootTimestamp) {
              for (const bullet of newBullets) {
                session.bulletMetadata.set(bullet, {
                  shootTimestamp: input.shootTimestamp,
                  shooterLatency: player.latency
                });
              }
            }

            session.bullets.push(...newBullets);
          }
          }
        }
      }

      // Clear processed inputs
      inputs.length = 0;
    }
  }

  // Rebuild spatial grid for collision detection
  session.spatialGrid.clear();

  // Insert tanks into grid
  for (const tank of session.tanks.values()) {
    if (!tank.dead) {
      session.spatialGrid.insert(tank);
    }
  }

  // Insert bullets into grid
  for (const bullet of session.bullets) {
    if (bullet.active) {
      session.spatialGrid.insert(bullet);
    }
  }

  // Update bullets with spatial collision detection
  for (let i = session.bullets.length - 1; i >= 0; i--) {
    const bullet = session.bullets[i];
    bullet.update(session.walls, session.crates);

    if (!bullet.active) {
      session.bulletMetadata.delete(bullet); // Clean up metadata
      session.bullets.splice(i, 1);
      continue;
    }

    // Bullet-tank collision detection using spatial grid
    const nearbyTanks = session.spatialGrid.query(bullet.pos.x, bullet.pos.y, 50);

    for (const entity of nearbyTanks) {
      // Check if entity is a Tank (has id property that's a number)
      if ('id' in entity && typeof entity.id === 'number' && 'hit' in entity) {
        const tank = entity as Tank;
        if (tank.dead) continue;
        if (bullet.ownerId === tank.id) continue; // No friendly fire

        // Lag compensation: check against historical position if available
        const metadata = session.bulletMetadata.get(bullet);
        let hitDetected = false;

        if (metadata && session.stateHistory.length > 0) {
          // Use lag-compensated historical position
          const historicalPos = getHistoricalTankPosition(
            session,
            tank.id,
            metadata.shootTimestamp,
            metadata.shooterLatency
          );

          if (historicalPos) {
            // Check collision against historical position
            hitDetected = (
              bullet.pos.x > historicalPos.x - 18 &&
              bullet.pos.x < historicalPos.x + 18 &&
              bullet.pos.y > historicalPos.y - 18 &&
              bullet.pos.y < historicalPos.y + 18
            );
          }
        }

        // Fallback to current position if no lag compensation data
        if (!hitDetected && !metadata) {
          hitDetected = (
            bullet.pos.x > tank.pos.x - 18 &&
            bullet.pos.x < tank.pos.x + 18 &&
            bullet.pos.y > tank.pos.y - 18 &&
            bullet.pos.y < tank.pos.y + 18
          );
        }

        if (hitDetected) {
          tank.hit();
          bullet.active = false;

          // Clean up metadata
          session.bulletMetadata.delete(bullet);

          // Check if tank died
          if (tank.dead) {
            // Update scores
            const winnerId = tank.id === 1 ? 2 : 1;
            if (winnerId === 1) {
              session.scores.p1++;
            } else {
              session.scores.p2++;
            }

            // End round
            endRound(sessionId, winnerId);
          }
          break;
        }
      }
    }

    if (!bullet.active) {
      session.bulletMetadata.delete(bullet); // Clean up metadata
      session.bullets.splice(i, 1);
    }
  }

  // Update power-ups
  for (const powerup of session.powerups) {
    powerup.update();
  }

  // Power-up collection
  for (let i = session.powerups.length - 1; i >= 0; i--) {
    const powerup = session.powerups[i];

    for (const [tankId, tank] of session.tanks) {
      if (tank.dead) continue;

      if (powerup.isCollidingWith(tank.pos, 25)) {
        tank.applyPowerUp(powerup.type);
        session.powerups.splice(i, 1);
        break;
      }
    }
  }

  // Power-up spawning
  const elapsed = Date.now() - session.lastPowerUpTime;
  if (elapsed > Constants.POWERUP_SPAWN_INTERVAL) {
    spawnPowerUp(session);
    session.lastPowerUpTime = Date.now();
  }

  // Sudden death logic
  const gameTime = Date.now() - session.gameStartTime;
  if (gameTime > Constants.SUDDEN_DEATH_TIME) {
    if (!session.suddenDeathActive) {
      session.suddenDeathActive = true;
    }
    session.suddenDeathInset += Constants.SUDDEN_DEATH_INSET_SPEED;
  }

  // Check timer win condition
  if (session.settings?.timeLimitEnabled) {
    const timeLimit = session.settings.timeLimitSeconds * 1000; // Convert to milliseconds
    if (gameTime >= timeLimit) {
      // Time expired - determine winner by score, then health
      let winnerId: number;

      if (session.scores.p1 > session.scores.p2) {
        winnerId = 1;
      } else if (session.scores.p2 > session.scores.p1) {
        winnerId = 2;
      } else {
        // Tied score - use health as tiebreaker
        const p1Tank = session.tanks.get(1);
        const p2Tank = session.tanks.get(2);

        if (p1Tank && p2Tank) {
          if (p1Tank.health > p2Tank.health) {
            winnerId = 1;
          } else if (p2Tank.health > p1Tank.health) {
            winnerId = 2;
          } else {
            // Perfect tie - random winner
            winnerId = Math.random() < 0.5 ? 1 : 2;
          }
        } else {
          winnerId = 1; // Fallback
        }
      }

      endRound(sessionId, winnerId);
      return; // Stop processing this tick
    }
  }

  // Check if any tanks died (from sudden death, hazards, or other non-bullet causes)
  const p1Tank = session.tanks.get(1);
  const p2Tank = session.tanks.get(2);

  if (p1Tank && p2Tank) {
    const p1Dead = p1Tank.dead;
    const p2Dead = p2Tank.dead;

    // If both dead (simultaneous death), determine winner by who had more health before dying
    if (p1Dead && p2Dead) {
      // Use scores as tiebreaker, then random if tied
      let winnerId: number;
      if (session.scores.p1 > session.scores.p2) {
        winnerId = 1;
      } else if (session.scores.p2 > session.scores.p1) {
        winnerId = 2;
      } else {
        // Truly tied - random winner
        winnerId = Math.random() < 0.5 ? 1 : 2;
      }
      endRound(sessionId, winnerId);
      return; // Stop processing this tick
    }
    // If only one dead, they lose
    else if (p1Dead) {
      endRound(sessionId, 2);
      return;
    }
    else if (p2Dead) {
      endRound(sessionId, 1);
      return;
    }
  }

  // Determine if this is a slow tick (for priority-based updates)
  const isSlowTick = session.currentTick % 4 === 0; // Every 4th tick at 30Hz = 7.5Hz for low priority

  // Create full state snapshot from actual game entities
  const fullStateSnapshot: GameStateSnapshot = {
    tick: session.currentTick,
    timestamp: Date.now(),
    lastProcessedInput,
    tanks: Array.from(session.tanks.values()).map(serializeTank),
    bullets: session.bullets.map(serializeBullet),
    powerups: session.powerups.map(serializePowerUp),
    walls: [...session.walls, ...session.crates].map(serializeWall),
    hazards: session.hazards.map(serializeHazard),
    scores: session.scores,
    gameTime: gameTime / 1000,
    suddenDeath: session.suddenDeathActive,
    suddenDeathInset: session.suddenDeathInset,
    roundNumber: session.roundNumber,
    roundActive: session.gameState === 'playing',
    tickRate: session.tickRate,
  };

  // Debug: Log wall IDs every 60 ticks (once per second at 60Hz) to verify stability
  if (session.currentTick % 60 === 0) {
    const crateIds = session.crates.map(c => c.id).join(', ');
    console.log(`[Server] Tick ${session.currentTick}: Crate IDs = ${crateIds}`);
  }

  // Store state in history for lag compensation (keep last 60 states = 1 second at 60Hz)
  const historicalState: HistoricalState = {
    timestamp: fullStateSnapshot.timestamp,
    tick: fullStateSnapshot.tick,
    tankPositions: new Map(
      Array.from(session.tanks.entries()).map(([id, tank]) => [
        id,
        { x: tank.pos.x, y: tank.pos.y, angle: tank.angle }
      ])
    )
  };

  session.stateHistory.push(historicalState);

  // Keep only last 60 states (1 second of history at 60Hz)
  const MAX_HISTORY_SIZE = 60;
  if (session.stateHistory.length > MAX_HISTORY_SIZE) {
    session.stateHistory.shift();
  }

  // Compute delta against last broadcast state
  const deltaState = computeStateDelta(fullStateSnapshot, session.lastBroadcastState, isSlowTick);

  // Update last broadcast state
  session.lastBroadcastState = fullStateSnapshot;
  session.stateSnapshot = fullStateSnapshot;

  // Broadcast delta state to all players
  io.to(sessionId).emit('game_state', {
    sessionId,
    state: deltaState,
  });
}

function endRound(sessionId: string, winnerId: number): void {
  const session = sessionManager.getSession(sessionId);
  if (!session || !io) return;

  // Stop game tick
  if (session.tickInterval) {
    clearInterval(session.tickInterval);
    session.tickInterval = null;
  }

  session.gameState = 'round_over';

  // Notify clients
  io.to(sessionId).emit('round_over', {
    sessionId,
    roundNumber: session.roundNumber,
    winner: winnerId,
    scores: session.scores,
  });

  // Check if game should end based on score limit
  const scoreLimit = session.settings?.scoreLimitValue || 2; // Default to 2 if not set
  if (session.scores.p1 >= scoreLimit || session.scores.p2 >= scoreLimit) {
    endGame(sessionId, session.scores.p1 >= scoreLimit ? 1 : 2);
  } else {
    // Start next round after delay
    setTimeout(() => {
      startNextRound(sessionId);
    }, 3000);
  }
}

function startNextRound(sessionId: string): void {
  const session = sessionManager.getSession(sessionId);
  if (!session || !io) return;

  session.roundNumber++;
  initializeGameEntities(session);

  session.gameState = 'playing';
  session.gameStartTime = Date.now(); // Initialize timer for new round

  io.to(sessionId).emit('round_start', {
    sessionId,
    roundNumber: session.roundNumber,
    countdown: 0,
  });

  // Restart game tick
  session.tickInterval = setInterval(() => {
    processGameTick(sessionId);
  }, 1000 / session.tickRate);
}

function endGame(sessionId: string, winnerId: number): void {
  const session = sessionManager.getSession(sessionId);
  if (!session || !io) return;

  session.gameState = 'game_over';

  io.to(sessionId).emit('game_over', {
    sessionId,
    winner: winnerId,
    finalScores: session.scores,
    stats: {
      totalRounds: session.roundNumber,
      gameDuration: Date.now() - session.createdAt,
    },
  });
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
