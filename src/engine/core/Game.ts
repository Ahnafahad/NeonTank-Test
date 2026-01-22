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

export type GameMode = 'local' | 'ai' | 'online';
export type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

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

  // Gameplay modification features
  friendlyFire: boolean;
  gameSpeed: number;
  unlimitedAmmo: boolean;
  lowGravity: boolean;
  maxBounces: number;
  startingHealth: number;
  powerupSpawnRate: number;

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

  // Animation frame
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;

  constructor(canvas: HTMLCanvasElement, mode: GameMode = 'local', settings?: Partial<GameSettings>) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;

    this.mode = mode;
    this.inputManager = new InputManager();

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
      soundEffects: false, // Disabled for now
      friendlyFire: false,
      gameSpeed: 1.0,
      unlimitedAmmo: false,
      lowGravity: false,
      maxBounces: Constants.BULLET_MAX_BOUNCES,
      startingHealth: Constants.TANK_MAX_HEALTH,
      powerupSpawnRate: Constants.POWERUP_SPAWN_INTERVAL / 1000, // Convert ms to seconds
      aiDifficulty: 'medium',
      ...settings,
    };

    // Initialize AI if in AI mode
    if (this.mode === 'ai') {
      this.tankAI = new TankAI(this.settings.aiDifficulty);
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
    const p1Controls: TankControls = {
      up: 'KeyW',
      down: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      shoot: 'Space',
    };

    const p2Controls: TankControls = {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      shoot: 'Enter',
    };

    this.p1 = new Tank(1, 100, 350, Constants.PLAYER1_COLOR, p1Controls);
    this.p2 = new Tank(2, 900, 350, Constants.PLAYER2_COLOR, p2Controls);

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

  private update(deltaMultiplier: number = 1.0): void {
    if (this.state !== 'playing') return;

    const keys = this.inputManager.getKeyboardState();

    // In online mode, only process controls for the local player
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
        this.suddenDeathActive,
        this.suddenDeathInset
      );
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
}
