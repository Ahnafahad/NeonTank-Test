// Main Game orchestrator (extracted from HTML game loop)
import { Constants } from '../utils/Constants';
import { Tank, TankControls } from '../entities/Tank';
import { Bullet } from '../entities/Bullet';
import { PowerUp, PowerUpType } from '../entities/PowerUp';
import { Wall } from '../entities/Wall';
import { Hazard } from '../entities/Hazard';
import { Particle } from '../entities/Particle';
import { InputManager } from './InputManager';
import { TankAI, AIDifficulty } from '../ai';
import { NetworkManager } from '../multiplayer/NetworkManager';
import type { GameStateSnapshot, SerializedTank } from '@/lib/socket/events';

export type GameMode = 'local' | 'ai' | 'online' | 'lan';
export type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

// Client-side prediction state
interface PredictedState {
  timestamp: number;
  sequenceNumber: number;
  position: { x: number; y: number };
  angle: number;
  velocity: { x: number; y: number };
  health: number;
  ammo: number;
  chargeLevel: number;
}

// Remote player interpolation state
interface RemotePlayerState {
  fromState: SerializedTank;
  toState: SerializedTank;
  startTime: number;
  duration: number;
}

// Server state buffer for interpolation
interface BufferedServerState {
  state: GameStateSnapshot;
  receivedTime: number;
}

export interface GameSettings {
  // Existing features
  charging: boolean;
  ammoSystem: boolean;
  powerUps: boolean;
  destructibleCrates: boolean;
  hazards: boolean;
  suddenDeath: boolean;
  bulletRicochet: boolean;
  recoil: boolean;
  particleEffects: boolean;
  soundEffects: boolean;

  // Visual effects
  bulletTrails: boolean;
  bulletTrailLength: number;
  screenShake: boolean;
  screenShakeIntensity: number;
  weather: string;
  particleDensity: number;
  damageNumbers: boolean;

  // Gameplay modification features
  friendlyFire: boolean;
  gameSpeed: number;
  unlimitedAmmo: boolean;
  lowGravity: boolean;
  maxBounces: number;
  startingHealth: number;
  powerupSpawnRate: number;
  mapVariant: string;

  // Game rules
  timeLimitEnabled: boolean;
  timeLimitSeconds: number;
  scoreLimitEnabled: boolean;
  scoreLimitValue: number;

  // UI features
  minimap: boolean;
  killcam: boolean;

  // Audio
  musicEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;

  // Accessibility
  colorblindMode: string;

  // AI settings
  aiDifficulty: AIDifficulty;

  // Online multiplayer settings
  localPlayerControls?: 'wasd' | 'arrows'; // For online mode: which controls this client uses
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private inputManager: InputManager;
  private tankAI: TankAI | null = null;
  private networkManager: NetworkManager | null = null;
  private assignedTankId: number | null = null;

  // Game state
  public state: GameState = 'playing';
  private mode: GameMode;
  private settings: GameSettings;

  // Entities
  private p1!: Tank;
  private p2!: Tank;
  private bullets: Bullet[] = [];
  private powerups: PowerUp[] = [];
  private walls: Wall[] = [];
  private crates: Wall[] = [];
  private hazards: Hazard[] = [];
  private particles: Particle[] = [];

  // Scores
  private scores = { p1: 0, p2: 0 };

  // Timing
  private gameStartTime: number = 0;
  private lastPowerUpTime: number = 0;
  private suddenDeathActive: boolean = false;
  private suddenDeathInset: number = 0;
  private roundWinner: number | null = null;

  // Animation frame
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;

  // Client-side prediction & reconciliation
  private predictionHistory: PredictedState[] = [];
  private readonly MAX_PREDICTION_HISTORY = 60; // Keep last 60 states (1 second at 60fps)
  private remotePlayerState: RemotePlayerState | null = null;
  private serverStateBuffer: BufferedServerState[] = [];
  private readonly MIN_INTERPOLATION_DELAY = 50; // Minimum buffer (ms) - adjusted for 30Hz
  private readonly MAX_INTERPOLATION_DELAY = 150; // Maximum buffer (ms) - adjusted for 30Hz
  private interpolationDelay = 66; // Dynamic interpolation delay (starts at ~2 ticks at 30Hz), 0 for LAN
  private jitterSamples: number[] = []; // Track jitter over time
  private readonly MAX_JITTER_SAMPLES = 60; // 1 second at 60fps
  private lastStateReceivedTime = 0; // Track when states arrive
  private readonly MAX_BUFFER_SIZE = 10; // Keep last 10 server states
  private lastServerState: GameStateSnapshot | null = null;
  private readonly RECONCILIATION_THRESHOLD_SMOOTH = 15; // Smooth correction for small errors (pixels)
  private readonly RECONCILIATION_THRESHOLD_SNAP = 100; // Instant snap for large errors (pixels)
  // Dead reckoning
  private remotePlayerVelocity = { x: 0, y: 0 }; // Track remote player velocity
  private readonly MAX_EXTRAPOLATION_TIME = 100; // Max time to extrapolate (ms)

  constructor(
    canvas: HTMLCanvasElement,
    mode: GameMode = 'local',
    settings?: Partial<GameSettings>,
    networkManager?: NetworkManager
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;

    this.mode = mode;
    this.inputManager = new InputManager();

    // Set interpolation delay based on mode
    if (this.mode === 'lan') {
      this.interpolationDelay = 0; // Zero interpolation for LAN (instant state application)
    }

    // Default settings (all features enabled)
    this.settings = {
      charging: true,
      ammoSystem: true,
      powerUps: true,
      destructibleCrates: true,
      hazards: true,
      suddenDeath: true,
      bulletRicochet: true,
      recoil: true,
      particleEffects: true,
      soundEffects: false,
      bulletTrails: true,
      bulletTrailLength: 10,
      screenShake: true,
      screenShakeIntensity: 1.0,
      weather: 'none',
      particleDensity: 100,
      damageNumbers: true,
      friendlyFire: false,
      gameSpeed: 1.0,
      unlimitedAmmo: false,
      lowGravity: false,
      maxBounces: Constants.BULLET_MAX_BOUNCES,
      startingHealth: Constants.TANK_MAX_HEALTH,
      powerupSpawnRate: Constants.POWERUP_SPAWN_INTERVAL / 1000,
      mapVariant: 'classic',
      timeLimitEnabled: false,
      timeLimitSeconds: 120,
      scoreLimitEnabled: false,
      scoreLimitValue: 5,
      minimap: false,
      killcam: false,
      musicEnabled: false,
      musicVolume: 70,
      sfxVolume: 70,
      colorblindMode: 'none',
      aiDifficulty: 'medium',
      ...settings,
    };

    // Initialize AI if in AI mode
    if (this.mode === 'ai') {
      this.tankAI = new TankAI(this.settings.aiDifficulty);
    }

    // Setup network manager for online mode
    if (this.mode === 'online' && networkManager) {
      this.networkManager = networkManager;
      this.assignedTankId = networkManager.getAssignedTankId();
      this.setupNetworkCallbacks();
    }

    this.initGame();
  }

  private initGame(): void {
    // Set canvas size
    this.canvas.width = Constants.GAME_WIDTH;
    this.canvas.height = Constants.GAME_HEIGHT;

    // Create map
    this.createMap();

    // Create players
    // Define control schemes
    const wasdControls: TankControls = {
      up: 'KeyW',
      down: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      shoot: 'Space',
    };

    const arrowControls: TankControls = {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      shoot: 'Enter',
    };

    // Assign controls based on mode and settings
    let p1Controls: TankControls;
    let p2Controls: TankControls;

    if (this.mode === 'online' && this.assignedTankId && this.settings.localPlayerControls) {
      // Online mode: assign based on user choice and tank assignment
      const localControls = this.settings.localPlayerControls === 'wasd' ? wasdControls : arrowControls;
      const remoteControls = this.settings.localPlayerControls === 'wasd' ? arrowControls : wasdControls;

      if (this.assignedTankId === 1) {
        p1Controls = localControls;  // Local player is red tank
        p2Controls = remoteControls; // Remote player is blue tank
      } else {
        p1Controls = remoteControls; // Remote player is red tank
        p2Controls = localControls;  // Local player is blue tank
      }
    } else {
      // Local/AI mode: default assignment
      p1Controls = wasdControls;
      p2Controls = arrowControls;
    }

    this.p1 = new Tank(1, 100, 350, Constants.PLAYER1_COLOR, p1Controls);
    this.p2 = new Tank(2, 900, 350, Constants.PLAYER2_COLOR, p2Controls);

    // Mark P2 as AI-controlled if in AI mode
    if (this.mode === 'ai') {
      this.p2.isAIControlled = true;
    }

    this.gameStartTime = Date.now();
    this.suddenDeathActive = false;
    this.suddenDeathInset = 0;
  }

  private createMap(): void {
    this.walls = [];
    this.crates = [];
    this.hazards = [];

    // Static Walls
    this.walls.push(new Wall(450, 300, 100, 100)); // Center

    this.walls.push(new Wall(150, 100, 50, 150));
    this.walls.push(new Wall(800, 100, 50, 150));
    this.walls.push(new Wall(150, 450, 50, 150));
    this.walls.push(new Wall(800, 450, 50, 150));

    // Hazard Zones (if enabled)
    if (this.settings.hazards) {
      this.hazards.push(new Hazard(425, 50, 150, 100, 'RADIATION'));
      this.hazards.push(new Hazard(425, 550, 150, 100, 'RADIATION'));
    }

    // Destructible Crates (if enabled)
    if (this.settings.destructibleCrates) {
      this.crates.push(new Wall(250, 200, 40, 40, true));
      this.crates.push(new Wall(250, 460, 40, 40, true));
      this.crates.push(new Wall(710, 200, 40, 40, true));
      this.crates.push(new Wall(710, 460, 40, 40, true));
      this.crates.push(new Wall(450, 200, 100, 40, true));
      this.crates.push(new Wall(450, 460, 100, 40, true));
    }
  }

  private spawnPowerUp(): void {
    if (!this.settings.powerUps || this.powerups.length >= Constants.POWERUP_MAX_COUNT) return;

    // Find empty spot
    const x = Math.random() * (Constants.GAME_WIDTH - 100) + 50;
    const y = Math.random() * (Constants.GAME_HEIGHT - 100) + 50;

    // Check collision with walls/crates
    const allWalls = [...this.walls, ...this.crates];
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
    this.powerups.push(new PowerUp(x, y, type));
  }

  private createExplosion(x: number, y: number, color: string, count: number): void {
    if (!this.settings.particleEffects) return;

    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, color));
    }
  }

  private setupNetworkCallbacks(): void {
    if (!this.networkManager) return;

    this.networkManager.setCallbacks({
      onGameState: (state: GameStateSnapshot) => {
        this.applyServerState(state);
      },
      onRoundOver: (round, winner, scores) => {
        this.roundWinner = winner;
        this.scores = scores;
      },
      onRoundStart: (roundNumber) => {
        this.roundWinner = null;
      },
    });
  }

  private applyServerState(state: GameStateSnapshot): void {
    const now = Date.now();

    // Track jitter for adaptive buffer
    if (this.lastStateReceivedTime > 0) {
      const timeSinceLastState = now - this.lastStateReceivedTime;
      this.jitterSamples.push(timeSinceLastState);

      // Keep only recent samples
      if (this.jitterSamples.length > this.MAX_JITTER_SAMPLES) {
        this.jitterSamples.shift();
      }

      // Update adaptive interpolation delay
      this.updateInterpolationDelay();
    }
    this.lastStateReceivedTime = now;

    // Buffer the server state for interpolation
    this.serverStateBuffer.push({
      state: state,
      receivedTime: now,
    });

    // Keep buffer size manageable
    if (this.serverStateBuffer.length > this.MAX_BUFFER_SIZE) {
      this.serverStateBuffer.shift();
    }

    this.lastServerState = state;

    // Apply non-player game state first (bullets, powerups, walls, etc.)
    this.applyNonPlayerGameState(state);

    // Reconcile local player prediction with server state
    if (this.mode === 'online' && this.assignedTankId) {
      this.reconcileWithServer(state);
    }

    // Update remote player with interpolation
    this.updateRemotePlayerInterpolation(state);
  }

  private applyNonPlayerGameState(state: GameStateSnapshot): void {
    // Merge delta state with last full state
    const mergedState = this.mergeDeltaState(state, this.lastServerState);

    // VFX: Detect removed bullets from server state to trigger explosions
    if (state.removedBullets && state.removedBullets.length > 0) {
      for (const bulletId of state.removedBullets) {
        const bullet = this.bullets.find(b => b.id === bulletId);
        if (bullet) {
          this.createExplosion(bullet.pos.x, bullet.pos.y, bullet.color, 5);
        }
      }
    } else if (this.lastServerState) {
      // Fallback: compare full states if no removedBullets provided
      const currentBulletIds = new Set(mergedState.bullets.map(b => b.id));
      for (const prevBullet of this.lastServerState.bullets) {
        if (!currentBulletIds.has(prevBullet.id)) {
          this.createExplosion(prevBullet.x, prevBullet.y, prevBullet.color, 5);
        }
      }
    }

    // Apply bullet states - reuse existing instances to preserve trails
    const existingBullets = new Map<string, Bullet>();
    this.bullets.forEach(b => existingBullets.set(b.id, b));

    this.bullets = mergedState.bullets.map((bulletData) => {
      let bullet = existingBullets.get(bulletData.id);

      if (bullet) {
        // Update existing bullet
        bullet.pos.x = bulletData.x;
        bullet.pos.y = bulletData.y;
        bullet.vel.x = bulletData.velX;
        bullet.vel.y = bulletData.velY;
        bullet.bounces = bulletData.bounces;
        bullet.active = true; // Ensure active
      } else {
        // Create new bullet
        const angle = Math.atan2(bulletData.velY, bulletData.velX);
        bullet = new Bullet(
          bulletData.x,
          bulletData.y,
          angle,
          bulletData.color,
          bulletData.ownerId,
          bulletData.type
        );
        // Important: Sync ID and Velocity exactly
        bullet.id = bulletData.id;
        bullet.vel.x = bulletData.velX;
        bullet.vel.y = bulletData.velY;
        bullet.bounces = bulletData.bounces;
      }
      return bullet;
    });

    // Apply powerup states
    this.powerups = mergedState.powerups
      .filter((p) => p.active)
      .map((powerupData) => {
        const powerup = new PowerUp(powerupData.x, powerupData.y, powerupData.type);
        return powerup;
      });

    // Apply wall states (crates can be destroyed)
    const updatedCrates: Wall[] = [];
    for (const wallData of mergedState.walls) {
      if (wallData.destructible && wallData.active) {
        const crate = new Wall(wallData.x, wallData.y, wallData.w, wallData.h, true);
        if (wallData.health !== undefined) {
          crate.health = wallData.health;
        }
        updatedCrates.push(crate);
      }
    }
    this.crates = updatedCrates;

    // Apply scores
    this.scores = mergedState.scores;

    // Apply sudden death state
    this.suddenDeathActive = mergedState.suddenDeath;
    this.suddenDeathInset = mergedState.suddenDeathInset;

    // Update game start time to match server game time (server sends in seconds, convert to ms)
    this.gameStartTime = Date.now() - (mergedState.gameTime * 1000);
  }

  private mergeDeltaState(
    deltaState: GameStateSnapshot,
    lastFullState: GameStateSnapshot | null
  ): GameStateSnapshot {
    // If not a delta or no previous state, return as-is
    if (!deltaState.isDelta || !lastFullState) {
      return deltaState;
    }

    // Merge delta with last full state
    const merged: GameStateSnapshot = {
      ...deltaState,
      tanks: [...lastFullState.tanks],
      bullets: [...lastFullState.bullets],
      powerups: [...lastFullState.powerups],
      walls: [...lastFullState.walls],
      hazards: [...lastFullState.hazards],
    };

    // Update tanks with delta changes
    for (const deltaTank of deltaState.tanks) {
      const index = merged.tanks.findIndex((t) => t.id === deltaTank.id);
      if (index >= 0) {
        merged.tanks[index] = deltaTank;
      } else {
        merged.tanks.push(deltaTank);
      }
    }

    // Update bullets with delta changes
    // First, remove bullets marked as removed
    if (deltaState.removedBullets && deltaState.removedBullets.length > 0) {
      const removedSet = new Set(deltaState.removedBullets);
      merged.bullets = merged.bullets.filter((b) => !removedSet.has(b.id));
    }

    // Then, add/update bullets from delta
    for (const deltaBullet of deltaState.bullets) {
      const index = merged.bullets.findIndex((b) => b.id === deltaBullet.id);
      if (index >= 0) {
        merged.bullets[index] = deltaBullet;
      } else {
        merged.bullets.push(deltaBullet);
      }
    }

    // Update powerups with delta changes
    for (const deltaPowerup of deltaState.powerups) {
      const index = merged.powerups.findIndex((p) => p.id === deltaPowerup.id);
      if (index >= 0) {
        merged.powerups[index] = deltaPowerup;
      } else {
        merged.powerups.push(deltaPowerup);
      }
    }

    // Update walls with delta changes
    for (const deltaWall of deltaState.walls) {
      const index = merged.walls.findIndex((w) => w.id === deltaWall.id);
      if (index >= 0) {
        merged.walls[index] = deltaWall;
      } else {
        merged.walls.push(deltaWall);
      }
    }

    return merged;
  }

  private reconcileWithServer(serverState: GameStateSnapshot): void {
    if (!this.assignedTankId || !this.networkManager) return;

    const localTank = this.assignedTankId === 1 ? this.p1 : this.p2;
    const serverTank = serverState.tanks.find((t) => t.id === this.assignedTankId);

    if (!serverTank) return;

    // Get the last processed input sequence from server
    const playerId = this.networkManager.getPlayerId();
    const lastProcessedSeq = serverState.lastProcessedInput[playerId] || 0;

    // Remove processed predictions from history
    this.predictionHistory = this.predictionHistory.filter(
      (p) => p.sequenceNumber > lastProcessedSeq
    );

    // Check for prediction error (mismatch between client and server)
    const positionError = Math.sqrt(
      Math.pow(localTank.pos.x - serverTank.x, 2) + Math.pow(localTank.pos.y - serverTank.y, 2)
    );

    // Hybrid reconciliation based on error magnitude
    if (positionError > this.RECONCILIATION_THRESHOLD_SNAP) {
      // Large error - instant snap + replay to prevent major desync
      console.log(`[Reconciliation] SNAP: error=${positionError.toFixed(2)}px`);

      // Reset to server state
      localTank.pos.x = serverTank.x;
      localTank.pos.y = serverTank.y;
      localTank.angle = serverTank.angle;
      localTank.health = serverTank.health;
      localTank.ammo = serverTank.ammo;
      localTank.chargeLevel = serverTank.chargeLevel;
      localTank.isCharging = serverTank.isCharging;
      localTank.currentWeapon = serverTank.currentWeapon;
      localTank.speedTimer = serverTank.speedTimer;
      localTank.shieldTimer = serverTank.shieldTimer;
      localTank.weaponTimer = serverTank.weaponTimer;
      localTank.isReloading = serverTank.isReloading;
      if (serverTank.isReloading && serverTank.reloadProgress !== undefined) {
        localTank.reloadTimer = localTank.reloadDuration * (1 - serverTank.reloadProgress);
      }
      localTank.dead = serverTank.dead;

      // Replay unprocessed inputs on top of server state
      this.replayPredictions();
    } else if (positionError > this.RECONCILIATION_THRESHOLD_SMOOTH) {
      // Small error - smooth correction without replay
      console.log(`[Reconciliation] SMOOTH: error=${positionError.toFixed(2)}px`);

      const alpha = 0.8; // 80% correction per update (very fast convergence for real-time feel)
      localTank.pos.x += (serverTank.x - localTank.pos.x) * alpha;
      localTank.pos.y += (serverTank.y - localTank.pos.y) * alpha;

      // Smooth angle correction
      const angleDiff = serverTank.angle - localTank.angle;
      const normalizedDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      localTank.angle += normalizedDiff * alpha;

      // Update non-predicted properties
      localTank.health = serverTank.health;
      localTank.ammo = serverTank.ammo;
      localTank.currentWeapon = serverTank.currentWeapon;
      localTank.speedTimer = serverTank.speedTimer;
      localTank.shieldTimer = serverTank.shieldTimer;
      localTank.weaponTimer = serverTank.weaponTimer;
      localTank.isReloading = serverTank.isReloading;
      if (serverTank.isReloading && serverTank.reloadProgress !== undefined) {
        localTank.reloadTimer = localTank.reloadDuration * (1 - serverTank.reloadProgress);
      }
      localTank.dead = serverTank.dead;

      // Don't replay predictions for small corrections
    } else {
      // Error < 10px - no position correction needed
      // Just update non-predicted properties
      localTank.health = serverTank.health;
      localTank.ammo = serverTank.ammo;
      localTank.currentWeapon = serverTank.currentWeapon;
      localTank.speedTimer = serverTank.speedTimer;
      localTank.shieldTimer = serverTank.shieldTimer;
      localTank.weaponTimer = serverTank.weaponTimer;
      localTank.isReloading = serverTank.isReloading;
      if (serverTank.isReloading && serverTank.reloadProgress !== undefined) {
        localTank.reloadTimer = localTank.reloadDuration * (1 - serverTank.reloadProgress);
      }
      localTank.dead = serverTank.dead;
    }
  }

  private replayPredictions(): void {
    if (!this.assignedTankId || !this.networkManager) return;

    const localTank = this.assignedTankId === 1 ? this.p1 : this.p2;
    const remoteTank = this.assignedTankId === 1 ? this.p2 : this.p1;
    const pendingInputs = this.networkManager.getPendingInputs();

    // Replay each pending input to bring local state up to date
    for (const input of pendingInputs) {
      const keys = this.convertInputToKeys(input);

      // Simulate one update step with this input
      localTank.update(
        keys,
        this.walls,
        this.crates,
        this.hazards,
        remoteTank,
        this.suddenDeathActive,
        this.suddenDeathInset,
        this.settings,
        1.0
      );
    }
  }

  private convertInputToKeys(input: any): Record<string, boolean> {
    if (!this.assignedTankId) return {};

    const localTank = this.assignedTankId === 1 ? this.p1 : this.p2;
    const keys: Record<string, boolean> = {};

    // Convert movement vector to key presses
    if (input.movement.y < 0) keys[localTank.controls.up] = true;
    if (input.movement.y > 0) keys[localTank.controls.down] = true;
    if (input.movement.x < 0) keys[localTank.controls.left] = true;
    if (input.movement.x > 0) keys[localTank.controls.right] = true;
    if (input.shoot) keys[localTank.controls.shoot] = true;

    return keys;
  }

  private savePredictedState(sequenceNumber: number): void {
    if (!this.assignedTankId) return;

    const localTank = this.assignedTankId === 1 ? this.p1 : this.p2;

    const state: PredictedState = {
      timestamp: Date.now(),
      sequenceNumber,
      position: { x: localTank.pos.x, y: localTank.pos.y },
      angle: localTank.angle,
      velocity: { x: 0, y: 0 },
      health: localTank.health,
      ammo: localTank.ammo,
      chargeLevel: localTank.chargeLevel,
    };

    this.predictionHistory.push(state);

    // Limit history size
    if (this.predictionHistory.length > this.MAX_PREDICTION_HISTORY) {
      this.predictionHistory.shift();
    }
  }

  private updateInterpolationDelay(): void {
    if (this.jitterSamples.length < 10) return; // Need enough samples

    // Calculate average jitter (time between state updates)
    const avgJitter = this.jitterSamples.reduce((a, b) => a + b, 0) / this.jitterSamples.length;

    // Calculate target delay: 3x average jitter (safe buffer)
    const targetDelay = Math.min(
      this.MAX_INTERPOLATION_DELAY,
      Math.max(this.MIN_INTERPOLATION_DELAY, avgJitter * 3)
    );

    // Smooth adjustment with 10% alpha filter
    const alpha = 0.1;
    this.interpolationDelay = this.interpolationDelay * (1 - alpha) + targetDelay * alpha;
  }

  private updateRemotePlayerInterpolation(serverState: GameStateSnapshot): void {
    if (!this.assignedTankId) return;

    const remoteTankId = this.assignedTankId === 1 ? 2 : 1;
    const serverRemoteTank = serverState.tanks.find((t) => t.id === remoteTankId);

    if (!serverRemoteTank) return;

    // Use adaptive interpolation buffer to smooth out remote player movement
    const renderTime = Date.now() - this.interpolationDelay;

    // Find two states to interpolate between
    let fromState: BufferedServerState | null = null;
    let toState: BufferedServerState | null = null;

    for (let i = 0; i < this.serverStateBuffer.length - 1; i++) {
      const current = this.serverStateBuffer[i];
      const next = this.serverStateBuffer[i + 1];

      if (current.receivedTime <= renderTime && next.receivedTime >= renderTime) {
        fromState = current;
        toState = next;
        break;
      }
    }

    // If we have states to interpolate between, use them
    if (fromState && toState) {
      const fromTank = fromState.state.tanks.find((t) => t.id === remoteTankId);
      const toTank = toState.state.tanks.find((t) => t.id === remoteTankId);

      if (fromTank && toTank) {
        const totalDuration = toState.receivedTime - fromState.receivedTime;
        const elapsed = renderTime - fromState.receivedTime;
        const t = Math.min(1, Math.max(0, elapsed / totalDuration));

        // Interpolate position and angle
        const remoteTank = remoteTankId === 1 ? this.p1 : this.p2;
        remoteTank.pos.x = this.lerp(fromTank.x, toTank.x, t);
        remoteTank.pos.y = this.lerp(fromTank.y, toTank.y, t);
        // Don't interpolate angle - snap it to prevent visual desync with bullets
        remoteTank.angle = toTank.angle;
        remoteTank.health = toTank.health;
        remoteTank.ammo = toTank.ammo;
        remoteTank.chargeLevel = toTank.chargeLevel;
        remoteTank.isCharging = toTank.isCharging;
        remoteTank.currentWeapon = toTank.currentWeapon;
        remoteTank.speedTimer = toTank.speedTimer;
        remoteTank.shieldTimer = toTank.shieldTimer;
        remoteTank.weaponTimer = toTank.weaponTimer;
        remoteTank.isReloading = toTank.isReloading;
        if (toTank.isReloading && toTank.reloadProgress !== undefined) {
          remoteTank.reloadTimer = remoteTank.reloadDuration * (1 - toTank.reloadProgress);
        }
        remoteTank.dead = toTank.dead;

        // Update velocity for dead reckoning
        const deltaTime = toState.receivedTime - fromState.receivedTime;
        if (deltaTime > 0) {
          this.remotePlayerVelocity.x = (toTank.x - fromTank.x) / deltaTime * 1000; // pixels/sec
          this.remotePlayerVelocity.y = (toTank.y - fromTank.y) / deltaTime * 1000;
        }

        return;
      }
    }

    // Fallback: No interpolation buffer available
    // Use dead reckoning if packet loss detected
    const remoteTank = remoteTankId === 1 ? this.p1 : this.p2;
    const timeSinceLastUpdate = Date.now() - this.lastStateReceivedTime;

    if (timeSinceLastUpdate < this.MAX_EXTRAPOLATION_TIME && this.lastServerState) {
      // Extrapolate position using last known velocity
      const lastRemoteTank = this.lastServerState.tanks.find((t) => t.id === remoteTankId);
      if (lastRemoteTank) {
        const dt = timeSinceLastUpdate / 1000; // Convert to seconds
        let extrapolatedX = lastRemoteTank.x + this.remotePlayerVelocity.x * dt;
        let extrapolatedY = lastRemoteTank.y + this.remotePlayerVelocity.y * dt;

        // Clamp to map bounds
        extrapolatedX = Math.max(20, Math.min(Constants.GAME_WIDTH - 20, extrapolatedX));
        extrapolatedY = Math.max(20, Math.min(Constants.GAME_HEIGHT - 20, extrapolatedY));

        remoteTank.pos.x = extrapolatedX;
        remoteTank.pos.y = extrapolatedY;
        // Keep other properties from last known state
        return;
      }
    }

    // Final fallback: use latest server state directly
    remoteTank.pos.x = serverRemoteTank.x;
    remoteTank.pos.y = serverRemoteTank.y;
    remoteTank.angle = serverRemoteTank.angle;
    remoteTank.health = serverRemoteTank.health;
    remoteTank.ammo = serverRemoteTank.ammo;
    remoteTank.chargeLevel = serverRemoteTank.chargeLevel;
    remoteTank.isCharging = serverRemoteTank.isCharging;
    remoteTank.currentWeapon = serverRemoteTank.currentWeapon;
    remoteTank.speedTimer = serverRemoteTank.speedTimer;
    remoteTank.shieldTimer = serverRemoteTank.shieldTimer;
    remoteTank.weaponTimer = serverRemoteTank.weaponTimer;
    remoteTank.isReloading = serverRemoteTank.isReloading;
    if (serverRemoteTank.isReloading && serverRemoteTank.reloadProgress !== undefined) {
      remoteTank.reloadTimer = remoteTank.reloadDuration * (1 - serverRemoteTank.reloadProgress);
    }
    remoteTank.dead = serverRemoteTank.dead;

    // Reset velocity if directly snapping to server state
    this.remotePlayerVelocity.x = 0;
    this.remotePlayerVelocity.y = 0;
  }

  // Linear interpolation helper
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  // Angle interpolation (handles wraparound)
  private lerpAngle(a: number, b: number, t: number): number {
    let diff = b - a;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return a + diff * t;
  }

  private update(deltaMultiplier: number = 1.0): void {
    if (this.state !== 'playing') return;

    const keys = this.inputManager.getKeyboardState();

    // Handle online mode with client-side prediction
    if (this.mode === 'online' && this.networkManager && this.assignedTankId) {
      // Calculate movement vector from keyboard state
      const localTank = this.assignedTankId === 1 ? this.p1 : this.p2;
      const remoteTank = this.assignedTankId === 1 ? this.p2 : this.p1;
      const controls = localTank.controls;

      const movement = {
        x: (keys[controls.right] ? 1 : 0) - (keys[controls.left] ? 1 : 0),
        y: (keys[controls.down] ? 1 : 0) - (keys[controls.up] ? 1 : 0),
      };

      const shoot = keys[controls.shoot] || false;
      const chargeLevel = localTank.chargeLevel || 0;

      // Send input to server
      this.networkManager.sendInput(movement, shoot, chargeLevel);

      // CLIENT-SIDE PREDICTION: Apply local input immediately for instant feedback
      const localKeys: Record<string, boolean> = {};
      if (movement.y < 0) localKeys[controls.up] = true;
      if (movement.y > 0) localKeys[controls.down] = true;
      if (movement.x < 0) localKeys[controls.left] = true;
      if (movement.x > 0) localKeys[controls.right] = true;
      if (shoot) localKeys[controls.shoot] = true;

      // Update local player immediately (prediction)
      const newBullets = localTank.update(
        localKeys,
        this.walls,
        this.crates,
        this.hazards,
        remoteTank,
        this.suddenDeathActive,
        this.suddenDeathInset,
        this.settings,
        deltaMultiplier
      );
      this.bullets.push(...newBullets);

      // Save predicted state for later reconciliation
      const pendingInputs = this.networkManager.getPendingInputs();
      if (pendingInputs.length > 0) {
        const lastInput = pendingInputs[pendingInputs.length - 1];
        this.savePredictedState(lastInput.sequenceNumber);
      }

      // Update particles and bullets locally for smooth visuals
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.update(this.walls, this.crates);

        if (!b.active) {
          this.createExplosion(b.pos.x, b.pos.y, b.color, 5);
          this.bullets.splice(i, 1);
        }
      }

      for (let i = this.particles.length - 1; i >= 0; i--) {
        this.particles[i].update();
        if (this.particles[i].isDead()) {
          this.particles.splice(i, 1);
        }
      }

      // Server will update remote player and game state via callbacks
      return;
    }

    // Local/AI mode - process locally
    let p1Keys = keys;
    let p2Keys = keys;

    if (this.mode === 'online' && this.settings.localPlayerControls) {
      // Filter controls - only allow the chosen control scheme
      const emptyKeys: Record<string, boolean> = {};

      if (this.settings.localPlayerControls === 'wasd') {
        // Local player uses WASD (P1 controls), disable P2 arrow controls
        p2Keys = emptyKeys;
      } else {
        // Local player uses Arrows (P2 controls), disable P1 WASD controls
        p1Keys = emptyKeys;
      }
    }

    // Update tanks with game speed multiplier
    const p1Bullets = this.p1.update(
      p1Keys,
      this.walls,
      this.crates,
      this.hazards,
      this.p2,
      this.suddenDeathActive,
      this.suddenDeathInset,
      this.settings,
      deltaMultiplier
    );
    this.bullets.push(...p1Bullets);

    // Get P2 input (AI or keyboard)
    if (this.mode === 'ai' && this.tankAI) {
      const aiInput = this.tankAI.update(
        this.p2,
        this.p1,
        this.bullets,
        this.walls,
        this.crates,
        this.powerups,
        this.hazards,
        this.suddenDeathActive,
        this.suddenDeathInset
      );

      // Apply AI aiming angle before tank update
      if (aiInput.targetAngle !== undefined) {
        this.p2.angle = aiInput.targetAngle;
      }

      p2Keys = {
        ...keys,
        ...this.tankAI.getVirtualKeyState(aiInput, this.p2.controls),
      };
    }

    const p2Bullets = this.p2.update(
      p2Keys,
      this.walls,
      this.crates,
      this.hazards,
      this.p1,
      this.suddenDeathActive,
      this.suddenDeathInset,
      this.settings,
      deltaMultiplier
    );
    this.bullets.push(...p2Bullets);

    // Timer & Sudden Death
    const elapsed = Date.now() - this.gameStartTime;

    if (this.settings.suddenDeath && elapsed > Constants.SUDDEN_DEATH_TIME) {
      if (!this.suddenDeathActive) {
        this.suddenDeathActive = true;
      }
      this.suddenDeathInset += Constants.SUDDEN_DEATH_INSET_SPEED * deltaMultiplier;
    }

    // Check time limit win condition (local/AI mode only - server handles online mode)
    if (this.settings.timeLimitEnabled && this.mode !== 'online') {
      const timeLimit = this.settings.timeLimitSeconds * 1000;
      if (elapsed >= timeLimit) {
        // Time expired - determine winner
        let winnerId: number;

        if (this.scores.p1 > this.scores.p2) {
          winnerId = 1;
        } else if (this.scores.p2 > this.scores.p1) {
          winnerId = 2;
        } else {
          // Tied score - use health tiebreaker
          if (this.p1.health > this.p2.health) {
            winnerId = 1;
          } else if (this.p2.health > this.p1.health) {
            winnerId = 2;
          } else {
            // Perfect tie - random winner
            winnerId = Math.random() < 0.5 ? 1 : 2;
          }
        }

        this.endGame(winnerId);
      }
    }

    // PowerUp Spawner - use settings.powerupSpawnRate (in seconds)
    const powerupSpawnInterval = this.settings.powerupSpawnRate * 1000;
    if (Date.now() - this.lastPowerUpTime > powerupSpawnInterval) {
      this.spawnPowerUp();
      this.lastPowerUpTime = Date.now();
    }

    // Update power-ups
    for (const p of this.powerups) {
      p.update();
    }

    // PowerUp Collection
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];

      // Check P1 collision
      if (p.isCollidingWith(this.p1.pos, 25)) {
        this.p1.applyPowerUp(p.type);
        this.powerups.splice(i, 1);
        continue;
      }

      // Check P2 collision
      if (p.isCollidingWith(this.p2.pos, 25)) {
        this.p2.applyPowerUp(p.type);
        this.powerups.splice(i, 1);
      }
    }

    // Update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(this.walls, this.crates);

      if (!b.active) {
        this.createExplosion(b.pos.x, b.pos.y, b.color, 5);
        this.bullets.splice(i, 1);
        continue;
      }

      // Hit detection
      const tanks = [this.p1, this.p2];
      for (const tank of tanks) {
        if (tank.dead) continue;

        // Skip self-hit if friendly fire is off
        if (!this.settings.friendlyFire && b.ownerId === tank.id) continue;

        // Collision check
        if (
          b.pos.x > tank.pos.x - 18 &&
          b.pos.x < tank.pos.x + 18 &&
          b.pos.y > tank.pos.y - 18 &&
          b.pos.y < tank.pos.y + 18
        ) {
          const damage = tank.hit();
          b.active = false;
          this.createExplosion(b.pos.x, b.pos.y, b.color, 8);

          if (tank.dead) {
            this.createExplosion(tank.pos.x, tank.pos.y, tank.color, 50);
            this.endGame(tank.id === 1 ? 2 : 1);
          }
          break;
        }
      }

      if (!b.active) {
        this.bullets.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].isDead()) {
        this.particles.splice(i, 1);
      }
    }
  }

  private draw(): void {
    // Background
    this.ctx.fillStyle = Constants.BACKGROUND_COLOR;
    this.ctx.fillRect(0, 0, Constants.GAME_WIDTH, Constants.GAME_HEIGHT);

    // Grid
    this.ctx.strokeStyle = Constants.GRID_COLOR;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (let x = 0; x < Constants.GAME_WIDTH; x += 50) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, Constants.GAME_HEIGHT);
    }
    for (let y = 0; y < Constants.GAME_HEIGHT; y += 50) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(Constants.GAME_WIDTH, y);
    }
    this.ctx.stroke();

    // Draw Hazards
    for (const h of this.hazards) {
      h.draw(this.ctx);
    }

    // Draw Map
    for (const w of this.walls) {
      w.draw(this.ctx);
    }
    for (const c of this.crates) {
      c.draw(this.ctx);
    }

    // Draw PowerUps
    for (const p of this.powerups) {
      p.draw(this.ctx);
    }

    // Draw Tanks
    this.p1.draw(this.ctx);
    this.p2.draw(this.ctx);

    // Draw Bullets
    for (const b of this.bullets) {
      b.draw(this.ctx);
    }

    // Draw Particles
    for (const p of this.particles) {
      p.draw(this.ctx);
    }

    // Draw Sudden Death Walls
    if (this.suddenDeathActive) {
      this.ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
      this.ctx.fillRect(0, 0, Constants.GAME_WIDTH, this.suddenDeathInset);
      this.ctx.fillRect(0, Constants.GAME_HEIGHT - this.suddenDeathInset, Constants.GAME_WIDTH, this.suddenDeathInset);
      this.ctx.fillRect(0, 0, this.suddenDeathInset, Constants.GAME_HEIGHT);
      this.ctx.fillRect(Constants.GAME_WIDTH - this.suddenDeathInset, 0, this.suddenDeathInset, Constants.GAME_HEIGHT);

      this.ctx.strokeStyle = '#ff0000';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(
        this.suddenDeathInset,
        this.suddenDeathInset,
        Constants.GAME_WIDTH - this.suddenDeathInset * 2,
        Constants.GAME_HEIGHT - this.suddenDeathInset * 2
      );
    }

    // Draw Round Winner Overlay
    if (this.roundWinner !== null) {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, Constants.GAME_WIDTH, Constants.GAME_HEIGHT);

      this.ctx.font = 'bold 48px Orbitron, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const text = this.roundWinner === 1 ? 'RED WINS ROUND' : 'BLUE WINS ROUND';
      const color = this.roundWinner === 1 ? Constants.PLAYER1_COLOR : Constants.PLAYER2_COLOR;

      this.ctx.fillStyle = color;
      this.ctx.shadowBlur = 20;
      this.ctx.shadowColor = color;
      this.ctx.fillText(text, Constants.GAME_WIDTH / 2, Constants.GAME_HEIGHT / 2);

      this.ctx.font = '24px Orbitron, sans-serif';
      this.ctx.fillStyle = '#fff';
      this.ctx.shadowBlur = 0;
      this.ctx.fillText(`Round ${this.scores.p1 + this.scores.p2 + 1} starting soon...`, Constants.GAME_WIDTH / 2, Constants.GAME_HEIGHT / 2 + 50);

      this.ctx.restore();
    }
  }

  private gameLoop = (currentTime: number): void => {
    // Calculate delta time (capped at 50ms to avoid huge jumps)
    const rawDelta = this.lastFrameTime ? Math.min(currentTime - this.lastFrameTime, 50) : 16.67;
    this.lastFrameTime = currentTime;

    // Apply game speed multiplier (0.5-2.0 range)
    const deltaMultiplier = this.settings.gameSpeed;

    this.update(deltaMultiplier);
    this.draw();

    if (this.state === 'playing') {
      this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }
  };

  public start(): void {
    this.state = 'playing';
    this.lastPowerUpTime = Date.now();
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  public pause(): void {
    this.state = 'paused';
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  public resume(): void {
    if (this.state === 'paused') {
      this.state = 'playing';
      this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }
  }

  public reset(): void {
    this.bullets = [];
    this.particles = [];
    this.powerups = [];
    this.createMap();

    this.p1 = new Tank(1, 100, 350, Constants.PLAYER1_COLOR, this.p1.controls);
    this.p2 = new Tank(2, 900, 350, Constants.PLAYER2_COLOR, this.p2.controls);

    this.gameStartTime = Date.now();
    this.suddenDeathActive = false;
    this.suddenDeathInset = 0;

    this.start();
  }

  private endGame(winnerId: number): void {
    this.state = 'gameover';

    if (winnerId === 1) this.scores.p1++;
    else this.scores.p2++;

    // Trigger game over callback (will be handled by React component)
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  public getScores() {
    return this.scores;
  }

  public getP1Health(): number {
    return this.p1.health;
  }

  public getP2Health(): number {
    return this.p2.health;
  }

  public getGameTime(): number {
    return Date.now() - this.gameStartTime;
  }

  public isSuddenDeath(): boolean {
    return this.suddenDeathActive;
  }

  public destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.inputManager.destroy();
  }

  // Expose InputManager for mobile controls
  public getInputManager(): InputManager {
    return this.inputManager;
  }

  // LAN connection setup (placeholder for future integration)
  public setLANConnection(isHost: boolean, server: any, client: any): void {
    console.log('[Game] LAN connection set:', { isHost, server, client });
    // TODO: Integrate LAN server/client with game loop
    // This will be implemented when we create LANNetworkManager
  }

  // AI difficulty control
  public setAIDifficulty(difficulty: AIDifficulty): void {
    this.settings.aiDifficulty = difficulty;
    if (this.tankAI) {
      this.tankAI.setDifficulty(difficulty);
    }
  }

  public getAIDifficulty(): AIDifficulty {
    return this.settings.aiDifficulty;
  }

  // Network manager access for online mode
  public getNetworkManager(): NetworkManager | null {
    return this.networkManager;
  }

  public getAssignedTankId(): number | null {
    return this.assignedTankId;
  }
}
