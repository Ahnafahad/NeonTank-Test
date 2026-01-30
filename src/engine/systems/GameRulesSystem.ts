// Game rules and win condition system
import { Constants } from '../utils/Constants';
import type { GameSettings } from '../core/Game';

export interface GameScores {
  p1: number;
  p2: number;
}

export interface SuddenDeathState {
  active: boolean;
  inset: number;
}

export class GameRulesSystem {
  private gameStartTime: number = 0;
  private suddenDeathState: SuddenDeathState = {
    active: false,
    inset: 0
  };

  constructor(startTime: number) {
    this.gameStartTime = startTime;
  }

  /**
   * Check if time limit has been reached and determine winner
   * Returns null if time limit not reached, or winner ID if game should end
   */
  public checkTimeLimit(
    settings: GameSettings,
    scores: GameScores,
    p1Health: number,
    p2Health: number
  ): number | null {
    if (!settings.timeLimitEnabled) {
      return null;
    }

    const elapsed = Date.now() - this.gameStartTime;
    const timeLimit = settings.timeLimitSeconds * 1000;

    if (elapsed < timeLimit) {
      return null;
    }

    // Time expired - determine winner
    if (scores.p1 > scores.p2) {
      return 1;
    } else if (scores.p2 > scores.p1) {
      return 2;
    } else {
      // Tied score - use health tiebreaker
      if (p1Health > p2Health) {
        return 1;
      } else if (p2Health > p1Health) {
        return 2;
      } else {
        // Perfect tie - random winner
        return Math.random() < 0.5 ? 1 : 2;
      }
    }
  }

  /**
   * Update sudden death state (activate and progress)
   * Returns updated sudden death state
   */
  public updateSuddenDeath(
    settings: GameSettings,
    deltaMultiplier: number = 1.0
  ): SuddenDeathState {
    if (!settings.suddenDeath) {
      return this.suddenDeathState;
    }

    const elapsed = Date.now() - this.gameStartTime;

    // Activate sudden death if time reached
    if (elapsed > Constants.SUDDEN_DEATH_TIME && !this.suddenDeathState.active) {
      this.suddenDeathState.active = true;
    }

    // Progress sudden death inset
    if (this.suddenDeathState.active) {
      this.suddenDeathState.inset += Constants.SUDDEN_DEATH_INSET_SPEED * deltaMultiplier;
    }

    return this.suddenDeathState;
  }

  /**
   * Check if score limit has been reached
   */
  public checkScoreLimit(settings: GameSettings, scores: GameScores): number | null {
    if (!settings.scoreLimitEnabled) {
      return null;
    }

    if (scores.p1 >= settings.scoreLimitValue) {
      return 1;
    } else if (scores.p2 >= settings.scoreLimitValue) {
      return 2;
    }

    return null;
  }

  /**
   * Get current game time in milliseconds
   */
  public getGameTime(): number {
    return Date.now() - this.gameStartTime;
  }

  /**
   * Get sudden death state
   */
  public getSuddenDeathState(): SuddenDeathState {
    return this.suddenDeathState;
  }

  /**
   * Reset sudden death state (for new round)
   */
  public reset(newStartTime: number): void {
    this.gameStartTime = newStartTime;
    this.suddenDeathState = {
      active: false,
      inset: 0
    };
  }
}
