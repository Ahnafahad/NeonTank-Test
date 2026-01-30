// Rendering system for game canvas
import { Constants } from '../utils/Constants';
import type { Tank } from '../entities/Tank';
import type { Bullet } from '../entities/Bullet';
import type { PowerUp } from '../entities/PowerUp';
import type { Wall } from '../entities/Wall';
import type { Hazard } from '../entities/Hazard';
import type { Particle } from '../entities/Particle';

export interface RenderableEntities {
  tanks: [Tank, Tank];
  bullets: Bullet[];
  powerups: PowerUp[];
  walls: Wall[];
  crates: Wall[];
  hazards: Hazard[];
  particles: Particle[];
}

export interface SuddenDeathRenderState {
  active: boolean;
  inset: number;
}

export interface GameScores {
  p1: number;
  p2: number;
}

export class RenderSystem {
  /**
   * Main render method - draws all game elements to canvas
   */
  public render(
    ctx: CanvasRenderingContext2D,
    entities: RenderableEntities,
    suddenDeath: SuddenDeathRenderState,
    roundWinner: number | null,
    scores: GameScores
  ): void {
    // Background
    ctx.fillStyle = Constants.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, Constants.GAME_WIDTH, Constants.GAME_HEIGHT);

    // Grid
    this.drawGrid(ctx);

    // Draw Hazards
    for (const h of entities.hazards) {
      h.draw(ctx);
    }

    // Draw Map
    for (const w of entities.walls) {
      w.draw(ctx);
    }
    for (const c of entities.crates) {
      c.draw(ctx);
    }

    // Draw PowerUps
    for (const p of entities.powerups) {
      p.draw(ctx);
    }

    // Draw Tanks
    entities.tanks[0].draw(ctx);
    entities.tanks[1].draw(ctx);

    // Draw Bullets
    for (const b of entities.bullets) {
      b.draw(ctx);
    }

    // Draw Particles
    for (const p of entities.particles) {
      p.draw(ctx);
    }

    // Draw Sudden Death Walls
    if (suddenDeath.active) {
      this.drawSuddenDeathWalls(ctx, suddenDeath.inset);
    }

    // Draw Round Winner Overlay
    if (roundWinner !== null) {
      this.drawRoundWinnerOverlay(ctx, roundWinner, scores);
    }
  }

  /**
   * Draw background grid
   */
  private drawGrid(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = Constants.GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = 0; x < Constants.GAME_WIDTH; x += 50) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, Constants.GAME_HEIGHT);
    }

    for (let y = 0; y < Constants.GAME_HEIGHT; y += 50) {
      ctx.moveTo(0, y);
      ctx.lineTo(Constants.GAME_WIDTH, y);
    }

    ctx.stroke();
  }

  /**
   * Draw sudden death walls (shrinking safe zone)
   */
  private drawSuddenDeathWalls(ctx: CanvasRenderingContext2D, inset: number): void {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';

    // Top wall
    ctx.fillRect(0, 0, Constants.GAME_WIDTH, inset);

    // Bottom wall
    ctx.fillRect(0, Constants.GAME_HEIGHT - inset, Constants.GAME_WIDTH, inset);

    // Left wall
    ctx.fillRect(0, 0, inset, Constants.GAME_HEIGHT);

    // Right wall
    ctx.fillRect(Constants.GAME_WIDTH - inset, 0, inset, Constants.GAME_HEIGHT);

    // Draw border
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      inset,
      inset,
      Constants.GAME_WIDTH - inset * 2,
      Constants.GAME_HEIGHT - inset * 2
    );
  }

  /**
   * Draw round winner overlay
   */
  private drawRoundWinnerOverlay(
    ctx: CanvasRenderingContext2D,
    roundWinner: number,
    scores: GameScores
  ): void {
    ctx.save();

    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, Constants.GAME_WIDTH, Constants.GAME_HEIGHT);

    // Winner text
    ctx.font = 'bold 48px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = roundWinner === 1 ? 'RED WINS ROUND' : 'BLUE WINS ROUND';
    const color = roundWinner === 1 ? Constants.PLAYER1_COLOR : Constants.PLAYER2_COLOR;

    ctx.fillStyle = color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;
    ctx.fillText(text, Constants.GAME_WIDTH / 2, Constants.GAME_HEIGHT / 2);

    // Next round text
    ctx.font = '24px Orbitron, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    ctx.fillText(
      `Round ${scores.p1 + scores.p2 + 1} starting soon...`,
      Constants.GAME_WIDTH / 2,
      Constants.GAME_HEIGHT / 2 + 50
    );

    ctx.restore();
  }
}
