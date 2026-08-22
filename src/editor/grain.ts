export const GRAIN_SEED_MIN = 0;
export const GRAIN_SEED_MAX = 2_147_483_647;
export const DEFAULT_GRAIN_SEED = 1_048_573;

export type GrainSeed = number;

export function isValidGrainSeed(value: unknown): value is GrainSeed {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= GRAIN_SEED_MIN &&
    value <= GRAIN_SEED_MAX
  );
}

export function normalizeGrainSeed(value: unknown): GrainSeed {
  return isValidGrainSeed(value) ? value : DEFAULT_GRAIN_SEED;
}

export function createGrainSeed(randomSource?: () => number): GrainSeed {
  if (!randomSource && typeof globalThis.crypto?.getRandomValues === 'function') {
    try {
      const values = new Uint32Array(1);
      globalThis.crypto.getRandomValues(values);
      return values[0] % (GRAIN_SEED_MAX + 1);
    } catch {
      // Use the non-cryptographic fallback when browser randomness is unavailable.
    }
  }

  const randomValue = randomSource?.() ?? Math.random();

  if (!Number.isFinite(randomValue)) {
    return DEFAULT_GRAIN_SEED;
  }

  const boundedRandomValue = Math.min(0.999999999, Math.max(0, randomValue));
  return Math.floor(boundedRandomValue * (GRAIN_SEED_MAX + 1));
}

export function grainSeedToUniform(seed: GrainSeed): number {
  return normalizeGrainSeed(seed) / GRAIN_SEED_MAX;
}

export function serializeGrainSeed(seed: GrainSeed): string {
  return JSON.stringify({ grainSeed: normalizeGrainSeed(seed) });
}

export function deserializeGrainSeed(serialized: string): GrainSeed {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('OpenFilm could not recover the grain seed.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('OpenFilm could not recover the grain seed.');
  }

  const grainSeed = (parsed as { grainSeed?: unknown }).grainSeed;

  if (!isValidGrainSeed(grainSeed)) {
    throw new Error('OpenFilm could not recover the grain seed.');
  }

  return grainSeed;
}
