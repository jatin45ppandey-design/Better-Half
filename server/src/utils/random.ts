/**
 * Seeded Pseudo-Random Number Generator (PRNG) Utility
 * Provides deterministic, reproducible randomness initialized with a seed string.
 * Based on Mulberry32 PRNG algorithm.
 */

export class SeededRandom {
  private state: number;

  constructor(seedString: string) {
    this.state = SeededRandom.hashSeed(seedString);
  }

  /**
   * Hashes an arbitrary seed string into a 32-bit unsigned integer.
   */
  private static hashSeed(seed: string): number {
    let hash = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
      hash = Math.imul(hash ^ seed.charCodeAt(i), 3432918353);
      hash = (hash << 13) | (hash >>> 19);
    }
    return hash >>> 0;
  }

  /**
   * Returns a pseudo-random float in [0, 1).
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a pseudo-random integer in [min, max] (inclusive).
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Returns a random element from an array.
   */
  choice<T>(items: T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot select choice from empty array');
    }
    const idx = Math.floor(this.next() * items.length);
    return items[idx];
  }

  /**
   * Shuffles an array deterministically in place using Fisher-Yates.
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

/**
 * Helper to create a SeededRandom instance or fallback to Math.random wrapper
 */
export function createRng(seed?: string): SeededRandom {
  return new SeededRandom(seed || `${Date.now()}-${Math.random()}`);
}

