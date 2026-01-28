// Spatial Hash Grid for efficient collision detection
// Reduces O(n²) collision checks to O(n) by partitioning space into cells

export interface Positioned {
  pos: { x: number; y: number };
}

export class SpatialGrid<T extends Positioned> {
  private cellSize: number;
  private grid: Map<string, T[]>;
  private width: number;
  private height: number;

  constructor(width: number, height: number, cellSize: number = 100) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  /**
   * Clear all entities from the grid
   */
  clear(): void {
    this.grid.clear();
  }

  /**
   * Insert an entity into the grid
   */
  insert(entity: T): void {
    const cellKey = this.getCellKey(entity.pos.x, entity.pos.y);
    if (!this.grid.has(cellKey)) {
      this.grid.set(cellKey, []);
    }
    this.grid.get(cellKey)!.push(entity);
  }

  /**
   * Query entities within a radius of a position
   */
  query(x: number, y: number, radius: number): T[] {
    const results: T[] = [];
    const cellsToCheck = this.getCellsInRadius(x, y, radius);

    for (const cellKey of cellsToCheck) {
      const entities = this.grid.get(cellKey);
      if (entities) {
        // Filter entities by actual distance
        for (const entity of entities) {
          const dx = entity.pos.x - x;
          const dy = entity.pos.y - y;
          const distSq = dx * dx + dy * dy;
          if (distSq <= radius * radius) {
            results.push(entity);
          }
        }
      }
    }

    return results;
  }

  /**
   * Query entities in a specific cell and neighboring cells
   */
  queryNeighbors(x: number, y: number): T[] {
    const results: T[] = [];
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);

    // Check current cell and 8 neighbors
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const checkX = cellX + dx;
        const checkY = cellY + dy;
        const cellKey = `${checkX},${checkY}`;
        const entities = this.grid.get(cellKey);
        if (entities) {
          results.push(...entities);
        }
      }
    }

    return results;
  }

  /**
   * Get all entities in the grid
   */
  getAll(): T[] {
    const all: T[] = [];
    for (const entities of this.grid.values()) {
      all.push(...entities);
    }
    return all;
  }

  /**
   * Get cell key for a position
   */
  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Get all cell keys within a radius of a position
   */
  private getCellsInRadius(x: number, y: number, radius: number): string[] {
    const cells: string[] = [];
    const centerCellX = Math.floor(x / this.cellSize);
    const centerCellY = Math.floor(y / this.cellSize);

    // Calculate how many cells to check in each direction
    const cellRadius = Math.ceil(radius / this.cellSize);

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const cellX = centerCellX + dx;
        const cellY = centerCellY + dy;
        cells.push(`${cellX},${cellY}`);
      }
    }

    return cells;
  }

  /**
   * Get grid statistics for debugging
   */
  getStats(): { cellCount: number; entityCount: number; avgEntitiesPerCell: number } {
    let totalEntities = 0;
    for (const entities of this.grid.values()) {
      totalEntities += entities.length;
    }

    return {
      cellCount: this.grid.size,
      entityCount: totalEntities,
      avgEntitiesPerCell: this.grid.size > 0 ? totalEntities / this.grid.size : 0,
    };
  }
}
