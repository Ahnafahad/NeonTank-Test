// A* Pathfinding for tank navigation
import { Vector } from '../../utils/Vector';
import { Constants } from '../../utils/Constants';
import { Wall } from '../../entities/Wall';

interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

export class PathFinding {
  private gridSize: number;
  private gridWidth: number;
  private gridHeight: number;
  private grid: boolean[][];

  constructor(gridSize: number = 50) {
    this.gridSize = gridSize;
    this.gridWidth = Math.ceil(Constants.GAME_WIDTH / gridSize);
    this.gridHeight = Math.ceil(Constants.GAME_HEIGHT / gridSize);
    this.grid = [];
    this.initGrid();
  }

  private initGrid(): void {
    this.grid = [];
    for (let y = 0; y < this.gridHeight; y++) {
      this.grid[y] = [];
      for (let x = 0; x < this.gridWidth; x++) {
        this.grid[y][x] = true;
      }
    }
  }

  updateGrid(walls: Wall[], crates: Wall[]): void {
    this.initGrid();
    const allObstacles = [...walls, ...crates.filter(c => c.active)];

    for (const obstacle of allObstacles) {
      const startX = Math.floor(obstacle.x / this.gridSize);
      const startY = Math.floor(obstacle.y / this.gridSize);
      const endX = Math.ceil((obstacle.x + obstacle.w) / this.gridSize);
      const endY = Math.ceil((obstacle.y + obstacle.h) / this.gridSize);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          if (y >= 0 && y < this.gridHeight && x >= 0 && x < this.gridWidth) {
            this.grid[y][x] = false;
          }
        }
      }
    }

    // Boundary padding
    for (let y = 0; y < this.gridHeight; y++) {
      this.grid[y][0] = false;
      this.grid[y][this.gridWidth - 1] = false;
    }
    for (let x = 0; x < this.gridWidth; x++) {
      this.grid[0][x] = false;
      this.grid[this.gridHeight - 1][x] = false;
    }
  }

  updateGridWithHazards(walls: Wall[], crates: Wall[], hazards: any[]): void {
    this.updateGrid(walls, crates);

    // Mark hazards as unwalkable
    for (const hazard of hazards) {
      const startX = Math.floor(hazard.x / this.gridSize);
      const startY = Math.floor(hazard.y / this.gridSize);
      const endX = Math.ceil((hazard.x + hazard.w) / this.gridSize); // Hazard uses w/h like Wall?
      // Hazard definition in entities/Hazard.ts needed.
      // Assuming x, y, w, h
      const endY = Math.ceil((hazard.y + hazard.h) / this.gridSize);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          if (y >= 0 && y < this.gridHeight && x >= 0 && x < this.gridWidth) {
            this.grid[y][x] = false;
          }
        }
      }
    }
  }

  worldToGrid(pos: Vector): { x: number; y: number } {
    return {
      x: Math.floor(pos.x / this.gridSize),
      y: Math.floor(pos.y / this.gridSize),
    };
  }

  gridToWorld(gridX: number, gridY: number): Vector {
    return new Vector(
      gridX * this.gridSize + this.gridSize / 2,
      gridY * this.gridSize + this.gridSize / 2
    );
  }

  isWalkable(gridX: number, gridY: number): boolean {
    if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
      return false;
    }
    return this.grid[gridY][gridX];
  }

  findPath(start: Vector, goal: Vector): Vector[] {
    const startGrid = this.worldToGrid(start);
    const goalGrid = this.worldToGrid(goal);

    if (!this.isWalkable(startGrid.x, startGrid.y) || !this.isWalkable(goalGrid.x, goalGrid.y)) {
      return [];
    }

    if (startGrid.x === goalGrid.x && startGrid.y === goalGrid.y) {
      return [goal];
    }

    const openSet: PathNode[] = [];
    const closedSet: Set<string> = new Set();

    const startNode: PathNode = {
      x: startGrid.x,
      y: startGrid.y,
      g: 0,
      h: this.heuristic(startGrid.x, startGrid.y, goalGrid.x, goalGrid.y),
      f: 0,
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);

    const directions = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
      { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 },
    ];

    let iterations = 0;
    while (openSet.length > 0 && iterations < 500) {
      iterations++;
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;
      const currentKey = `${current.x},${current.y}`;

      if (current.x === goalGrid.x && current.y === goalGrid.y) {
        return this.reconstructPath(current);
      }

      closedSet.add(currentKey);

      for (const dir of directions) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;
        const neighborKey = `${nx},${ny}`;

        if (!this.isWalkable(nx, ny) || closedSet.has(neighborKey)) continue;

        if (dir.dx !== 0 && dir.dy !== 0) {
          if (!this.isWalkable(current.x + dir.dx, current.y) ||
            !this.isWalkable(current.x, current.y + dir.dy)) continue;
        }

        const moveCost = dir.dx !== 0 && dir.dy !== 0 ? 1.414 : 1;
        const g = current.g + moveCost;
        const h = this.heuristic(nx, ny, goalGrid.x, goalGrid.y);

        const existingIndex = openSet.findIndex(n => n.x === nx && n.y === ny);
        if (existingIndex !== -1) {
          if (g < openSet[existingIndex].g) {
            openSet[existingIndex].g = g;
            openSet[existingIndex].f = g + h;
            openSet[existingIndex].parent = current;
          }
          continue;
        }

        openSet.push({ x: nx, y: ny, g, h, f: g + h, parent: current });
      }
    }

    return [];
  }

  private heuristic(x1: number, y1: number, x2: number, y2: number): number {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  }

  private reconstructPath(endNode: PathNode): Vector[] {
    const path: Vector[] = [];
    let current: PathNode | null = endNode;
    while (current !== null) {
      path.unshift(this.gridToWorld(current.x, current.y));
      current = current.parent;
    }
    return path;
  }

  getRandomWalkablePosition(): Vector | null {
    for (let i = 0; i < 100; i++) {
      const gridX = Math.floor(Math.random() * this.gridWidth);
      const gridY = Math.floor(Math.random() * this.gridHeight);
      if (this.isWalkable(gridX, gridY)) {
        return this.gridToWorld(gridX, gridY);
      }
    }
    return null;
  }
}
