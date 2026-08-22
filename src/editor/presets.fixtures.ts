const fixtureAdjustments = {
  contrast: 18,
  exposure: 0.75,
  fade: 12,
  grainAmount: 24,
  grainSize: 36,
  saturation: -14,
  temperature: 22,
  tint: -3,
  toneCurve: [
    { x: 0, y: 0.02 },
    { x: 0.42, y: 0.48 },
    { x: 1, y: 0.98 },
  ],
  vignetteAmount: 20,
  vignetteSoftness: 62,
};

export const validPresetFixture = JSON.stringify({
  adjustments: fixtureAdjustments,
  description: 'A small fixture for a reusable OpenFilm Look.',
  formatVersion: '1.1',
  title: 'Fixture Look',
});

export const previousMinorPresetFixture = JSON.stringify({
  adjustments: fixtureAdjustments,
  description: 'A preset written by the previous minor format.',
  formatVersion: '1.0',
  title: 'Previous Minor Look',
});

export const invalidPresetFixtures = {
  invalidNumber: JSON.stringify({
    adjustments: { ...fixtureAdjustments, exposure: 'bright' },
    formatVersion: '1.1',
    title: 'Invalid number',
  }),
  missingField: JSON.stringify({
    adjustments: { ...fixtureAdjustments, grainSize: undefined },
    formatVersion: '1.1',
    title: 'Missing field',
  }),
  unsupportedAdjustment: JSON.stringify({
    adjustments: { ...fixtureAdjustments, clarity: 20 },
    formatVersion: '1.1',
    title: 'Unsupported adjustment',
  }),
  unknownMajor: JSON.stringify({
    adjustments: fixtureAdjustments,
    formatVersion: '2.0',
    title: 'Unknown major',
  }),
  wrongRange: JSON.stringify({
    adjustments: { ...fixtureAdjustments, exposure: 8 },
    formatVersion: '1.1',
    title: 'Wrong range',
  }),
} as const;
