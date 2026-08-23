import { neutralAdjustments } from './adjustments';
import {
  deserializePreset,
  isValidPreset,
  PRESET_MAX_FILE_SIZE,
  PRESET_FORMAT_VERSION,
  serializePreset,
} from './presets';
import {
  invalidPresetFixtures,
  previousMinorPresetFixture,
  validPresetFixture,
} from './presets.fixtures';

describe('OpenFilm preset format', () => {
  it('reads a valid current-version preset with all supported adjustments', () => {
    const preset = deserializePreset(validPresetFixture);

    expect(preset).toMatchObject({
      description: 'A small fixture for a reusable OpenFilm Look.',
      formatVersion: PRESET_FORMAT_VERSION,
      title: 'Fixture Look',
    });
    expect(preset.adjustments).toMatchObject({
      contrast: 18,
      exposure: 0.75,
      grainAmount: 24,
      grainSize: 36,
      vignetteAmount: 20,
    });
    expect(preset.adjustments.toneCurve).toEqual([
      { x: 0, y: 0.02 },
      { x: 0.42, y: 0.48 },
      { x: 1, y: 0.98 },
    ]);
    expect(isValidPreset(preset)).toBe(true);
  });

  it('accepts a previous minor version without changing its supported values', () => {
    const preset = deserializePreset(previousMinorPresetFixture);

    expect(preset.formatVersion).toBe('1.0');
    expect(preset.adjustments.exposure).toBe(0.75);
    expect(preset.adjustments.toneCurve[1]).toEqual({ x: 0.42, y: 0.48 });
  });

  it('serializes a readable preset and round trips the Look values', () => {
    const preset = deserializePreset(validPresetFixture);
    const serialized = serializePreset(preset);

    expect(serialized).toContain('\n  "formatVersion"');
    expect(serialized).not.toContain('geometry');
    expect(serialized).not.toContain('source');
    expect(serialized).not.toContain('history');
    expect(serialized).not.toContain('grainSeed');
    expect(deserializePreset(serialized)).toEqual(preset);
  });

  it.each([
    ['malformed JSON', 'not JSON'],
    ['an unknown major version', invalidPresetFixtures.unknownMajor],
    ['a missing adjustment field', invalidPresetFixtures.missingField],
    ['an invalid number', invalidPresetFixtures.invalidNumber],
    ['a wrong-range adjustment', invalidPresetFixtures.wrongRange],
    ['an unsupported adjustment', invalidPresetFixtures.unsupportedAdjustment],
  ])('rejects %s', (_reason, serialized) => {
    expect(() => deserializePreset(serialized)).toThrow(/could not read this preset/i);
  });

  it('rejects missing metadata, oversized text, and Edit-specific fields', () => {
    const valid = JSON.parse(validPresetFixture) as Record<string, unknown>;

    expect(() => deserializePreset(JSON.stringify({ ...valid, title: '' }))).toThrow();
    expect(() => deserializePreset(JSON.stringify({ ...valid, title: 'x'.repeat(81) }))).toThrow();
    expect(() =>
      deserializePreset(JSON.stringify({ ...valid, description: 'x'.repeat(241) })),
    ).toThrow();
    expect(() =>
      deserializePreset(JSON.stringify({ ...valid, geometry: neutralAdjustments })),
    ).toThrow();
    expect(() => deserializePreset('x'.repeat(PRESET_MAX_FILE_SIZE + 1))).toThrow(/too large/i);
  });

  it('measures the preset limit in UTF-8 bytes rather than JavaScript characters', () => {
    const oversizedUtf8 = 'é'.repeat(Math.floor(PRESET_MAX_FILE_SIZE / 2) + 1);

    expect(new TextEncoder().encode(oversizedUtf8).byteLength).toBeGreaterThan(
      PRESET_MAX_FILE_SIZE,
    );
    expect(() => deserializePreset(oversizedUtf8)).toThrow(/too large/i);
  });
});
