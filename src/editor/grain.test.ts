import {
  DEFAULT_GRAIN_SEED,
  createGrainSeed,
  deserializeGrainSeed,
  GRAIN_SEED_MAX,
  grainSeedToUniform,
  isValidGrainSeed,
  normalizeGrainSeed,
  serializeGrainSeed,
} from './grain';

describe('Edit-specific grain seed', () => {
  it('accepts bounded integer seeds and normalizes invalid recovery values', () => {
    expect(isValidGrainSeed(0)).toBe(true);
    expect(isValidGrainSeed(GRAIN_SEED_MAX)).toBe(true);
    expect(isValidGrainSeed(1.5)).toBe(false);
    expect(isValidGrainSeed(GRAIN_SEED_MAX + 1)).toBe(false);
    expect(normalizeGrainSeed('not a seed')).toBe(DEFAULT_GRAIN_SEED);
  });

  it('creates a bounded stable seed from the Edit initialization source', () => {
    expect(createGrainSeed(() => 0.25)).toBe(536_870_912);
    expect(createGrainSeed(() => Number.NaN)).toBe(DEFAULT_GRAIN_SEED);
    expect(isValidGrainSeed(createGrainSeed(() => 0.75))).toBe(true);
  });

  it('round trips a seed through the recoverable Edit representation', () => {
    const serialized = serializeGrainSeed(123456789);

    expect(deserializeGrainSeed(serialized)).toBe(123456789);
    expect(grainSeedToUniform(0)).toBe(0);
    expect(grainSeedToUniform(GRAIN_SEED_MAX)).toBe(1);
  });

  it('rejects malformed or out-of-bounds recovered seeds', () => {
    expect(() => deserializeGrainSeed('not json')).toThrow('recover the grain seed');
    expect(() => deserializeGrainSeed('{"grainSeed": 1.25}')).toThrow('recover the grain seed');
    expect(() => deserializeGrainSeed(`{"grainSeed": ${GRAIN_SEED_MAX + 1}}`)).toThrow(
      'recover the grain seed',
    );
  });
});
