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
  // Game entities
  tanks: Map<number, Tank>; // tankId -> Tank
  bullets: Bullet[];
  powerups: PowerUp[];
  walls: Wall[];
  crates: Wall[];
  hazards: Hazard[];
  // Game state
  gameStartTime: number;
  lastPowerUpTime: number;
  suddenDeathActive: boolean;
  suddenDeathInset: number;
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
      // Game entities
      tanks: new Map(),
      bullets: [],
      powerups: [],
      walls: [],
      crates: [],
      hazards: [],
      // Game state
      gameStartTime: Date.now(),
      lastPowerUpTime: Date.now(),
      suddenDeathActive: false,
      suddenDeathInset: 0,
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
    id: `powerup-${powerup.pos.x}-${powerup.pos.y}`,
    x: powerup.pos.x,
    y: powerup.pos.y,
    type: powerup.type,
    active: powerup.active,
  };
}

function serializeWall(wall: Wall, index: number): SerializedWall {
  return {
    id: `wall-${index}`,
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

  // Process player inputs and update tanks
  const lastProcessedInput: { [playerId: string]: number } = {};
  const gameSettings = {
    ammoSystem: true,
    charging: true,
    recoil: true,
  };

  for (const [playerId, inputs] of session.inputBuffer) {
    if (inputs.length > 0) {
      // Process the most recent input
      const input = inputs[inputs.length - 1];
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
            session.bullets.push(...newBullets);
          }
        }
      }

      // Clear processed inputs
      inputs.length = 0;
    }
  }

  // Update bullets
  for (let i = session.bullets.length - 1; i >= 0; i--) {
    const bullet = session.bullets[i];
    bullet.update(session.walls, session.crates);

    if (!bullet.active) {
      session.bullets.splice(i, 1);
      continue;
    }

    // Bullet-tank collision detection
    for (const [tankId, tank] of session.tanks) {
      if (tank.dead) continue;
      if (bullet.ownerId === tankId) continue; // No friendly fire

      // Simple AABB collision
      if (
        bullet.pos.x > tank.pos.x - 18 &&
        bullet.pos.x < tank.pos.x + 18 &&
        bullet.pos.y > tank.pos.y - 18 &&
        bullet.pos.y < tank.pos.y + 18
      ) {
        tank.hit();
        bullet.active = false;

        // Check if tank died
        if (tank.dead) {
          // Update scores
          const winnerId = tankId === 1 ? 2 : 1;
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

    if (!bullet.active) {
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

  // Create state snapshot from actual game entities
  const stateSnapshot: GameStateSnapshot = {
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
  };

  session.stateSnapshot = stateSnapshot;

  // Broadcast state to all players
  io.to(sessionId).emit('game_state', {
    sessionId,
    state: stateSnapshot,
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

  // Check if game should end (best of 3, first to 2 wins)
  if (session.scores.p1 >= 2 || session.scores.p2 >= 2) {
    endGame(sessionId, session.scores.p1 >= 2 ? 1 : 2);
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
