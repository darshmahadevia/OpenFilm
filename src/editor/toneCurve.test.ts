import {
  addToneCurvePoint,
  createToneCurveLookup,
  deserializeToneCurve,
  interpolateToneCurve,
  isValidToneCurve,
  moveToneCurvePoint,
  neutralToneCurve,
  removeToneCurvePoint,
  serializeToneCurve,
  TONE_CURVE_MAX_POINTS,
} from './toneCurve';

describe('RGB tone curve', () => {
  it('starts neutral and interpolates ordered points linearly', () => {
    expect(interpolateToneCurve(neutralToneCurve, 0)).toBe(0);
    expect(interpolateToneCurve(neutralToneCurve, 0.35)).toBe(0.35);
    expect(interpolateToneCurve(neutralToneCurve, 1)).toBe(1);
    expect(
      interpolateToneCurve(
        [
          { x: 0, y: 0 },
          { x: 0.25, y: 0.75 },
          { x: 1, y: 1 },
        ],
        0.125,
      ),
    ).toBe(0.375);
  });

  it('accepts a bounded ordered curve and rejects duplicate or out-of-order inputs', () => {
    expect(isValidToneCurve(neutralToneCurve)).toBe(true);
    expect(
      isValidToneCurve([
        { x: 0, y: 0 },
        { x: 0.5, y: 0.4 },
        { x: 1, y: 1 },
      ]),
    ).toBe(true);
    expect(
      isValidToneCurve([
        { x: 0, y: 0 },
        { x: 0.5, y: 0.4 },
        { x: 0.5, y: 0.8 },
        { x: 1, y: 1 },
      ]),
    ).toBe(false);
    expect(
      isValidToneCurve([
        { x: 0, y: 0 },
        { x: 0.8, y: 0.4 },
        { x: 0.5, y: 0.8 },
        { x: 1, y: 1 },
      ]),
    ).toBe(false);
  });

  it('adds, moves, and removes only valid non-endpoint points', () => {
    const added = addToneCurvePoint(neutralToneCurve, { x: 0.5, y: 0.7 });

    expect(added).toEqual([
      { x: 0, y: 0 },
      { x: 0.5, y: 0.7 },
      { x: 1, y: 1 },
    ]);
    expect(addToneCurvePoint(added ?? neutralToneCurve, { x: 0.5, y: 0.2 })).toBeNull();
    expect(moveToneCurvePoint(added ?? neutralToneCurve, 1, { x: 0.8, y: 0.2 })).toEqual([
      { x: 0, y: 0 },
      { x: 0.8, y: 0.2 },
      { x: 1, y: 1 },
    ]);
    expect(moveToneCurvePoint(added ?? neutralToneCurve, 1, { x: 1, y: 0.2 })).toBeNull();
    expect(moveToneCurvePoint(added ?? neutralToneCurve, 0, { x: 0.4, y: 0.2 })).toEqual([
      { x: 0, y: 0.2 },
      { x: 0.5, y: 0.7 },
      { x: 1, y: 1 },
    ]);
    expect(removeToneCurvePoint(added ?? neutralToneCurve, 1)).toEqual(neutralToneCurve);
    expect(removeToneCurvePoint(added ?? neutralToneCurve, 0)).toBeNull();
    expect(removeToneCurvePoint(added ?? neutralToneCurve, 2)).toBeNull();
  });

  it('enforces the maximum point count and creates a neutral lookup', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.2 },
      { x: 0.3, y: 0.3 },
      { x: 0.4, y: 0.4 },
      { x: 0.5, y: 0.5 },
      { x: 0.75, y: 0.75 },
      { x: 1, y: 1 },
    ];

    expect(points).toHaveLength(TONE_CURVE_MAX_POINTS);
    expect(addToneCurvePoint(points)).toBeNull();
    expect(Array.from(createToneCurveLookup(neutralToneCurve, 3))).toEqual([
      0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255,
    ]);
  });

  it('round trips the ordered points through JSON serialization', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.35, y: 0.62 },
      { x: 1, y: 1 },
    ];

    expect(deserializeToneCurve(serializeToneCurve(points))).toEqual(points);
    expect(() => deserializeToneCurve('[{"x":0.5,"y":0.5},{"x":0,"y":0}]')).toThrow(
      'could not read',
    );
  });
});
