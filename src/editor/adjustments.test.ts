import {
  adjustmentDefinitions,
  adjustmentReducer,
  clampAdjustment,
  createAdjustmentHistory,
  deserializeAdjustments,
  neutralAdjustments,
  serializeAdjustments,
} from './adjustments';

describe('shared adjustment values', () => {
  it('documents the supported ranges and neutral defaults', () => {
    expect(adjustmentDefinitions.exposure).toMatchObject({ min: -4, max: 4, neutral: 0 });
    expect(adjustmentDefinitions.contrast).toMatchObject({ min: -100, max: 100, neutral: 0 });
    expect(adjustmentDefinitions.temperature).toMatchObject({ min: -100, max: 100, neutral: 0 });
    expect(adjustmentDefinitions.tint).toMatchObject({ min: -100, max: 100, neutral: 0 });
    expect(adjustmentDefinitions.saturation).toMatchObject({ min: -100, max: 100, neutral: 0 });
    expect(adjustmentDefinitions.fade).toMatchObject({ min: 0, max: 100, neutral: 0 });
    expect(adjustmentDefinitions.vignetteAmount).toMatchObject({ min: 0, max: 100, neutral: 0 });
    expect(adjustmentDefinitions.vignetteSoftness).toMatchObject({
      min: 0,
      max: 100,
      neutral: 50,
    });
    expect(adjustmentDefinitions.grainAmount).toMatchObject({ min: 0, max: 100, neutral: 0 });
    expect(adjustmentDefinitions.grainSize).toMatchObject({ min: 1, max: 100, neutral: 50 });
    expect(createAdjustmentHistory().present).toEqual(neutralAdjustments);
  });

  it('clamps values to their documented ranges and uses neutral for non-finite input', () => {
    expect(clampAdjustment('exposure', 9)).toBe(4);
    expect(clampAdjustment('contrast', -101)).toBe(-100);
    expect(clampAdjustment('fade', -1)).toBe(0);
    expect(clampAdjustment('vignetteSoftness', 101)).toBe(100);
    expect(clampAdjustment('grainSize', 0)).toBe(1);
    expect(clampAdjustment('temperature', Number.NaN)).toBe(0);
  });

  it('round trips adjustment values through stable JSON', () => {
    const values = {
      ...neutralAdjustments,
      exposure: 1.25,
      grainAmount: 35,
      grainSize: 72,
      saturation: -40,
      temperature: 18,
      toneCurve: [
        { x: 0, y: 0 },
        { x: 0.35, y: 0.62 },
        { x: 1, y: 1 },
      ],
      vignetteAmount: 48,
      vignetteSoftness: 65,
    };

    expect(deserializeAdjustments(serializeAdjustments(values))).toEqual(values);
    expect(serializeAdjustments({ ...values, grainAmount: 80 })).not.toContain('grainSeed');
    expect(deserializeAdjustments(JSON.stringify({ ...values, grainSeed: 123456 }))).toEqual(
      values,
    );
    expect(deserializeAdjustments('{"exposure": 99, "fade": -10}')).toEqual({
      contrast: 0,
      exposure: 4,
      fade: 0,
      grainAmount: 0,
      grainSize: 50,
      saturation: 0,
      temperature: 0,
      tint: 0,
      toneCurve: neutralAdjustments.toneCurve,
      vignetteAmount: 0,
      vignetteSoftness: 50,
    });
    expect(() => deserializeAdjustments('not json')).toThrow('could not read');
    expect(() =>
      deserializeAdjustments(
        '{"toneCurve":[{"x":0,"y":0},{"x":0.5,"y":0.5},{"x":0.5,"y":0.8},{"x":1,"y":1}]}',
      ),
    ).toThrow('tone curve');
  });
});

describe('adjustment history reducer', () => {
  it('updates a single adjustment and clears redo history after a new edit', () => {
    let state = createAdjustmentHistory();

    state = adjustmentReducer(state, { type: 'set', key: 'temperature', value: 25 });
    state = adjustmentReducer(state, { type: 'undo' });
    state = adjustmentReducer(state, { type: 'redo' });
    state = adjustmentReducer(state, { type: 'set', key: 'tint', value: -12 });

    expect(state.present).toMatchObject({ temperature: 25, tint: -12 });
    expect(state.future).toHaveLength(0);
  });

  it('makes an individual reset undoable', () => {
    let state = createAdjustmentHistory({ saturation: 55 });

    state = adjustmentReducer(state, { type: 'reset-one', key: 'saturation' });
    expect(state.present.saturation).toBe(0);

    state = adjustmentReducer(state, { type: 'undo' });
    expect(state.present.saturation).toBe(55);
  });

  it('makes the all-adjustments reset undoable', () => {
    let state = createAdjustmentHistory({ contrast: 30, fade: 20, exposure: -1 });

    state = adjustmentReducer(state, { type: 'reset-all' });
    expect(state.present).toEqual(neutralAdjustments);

    state = adjustmentReducer(state, { type: 'undo' });
    expect(state.present).toMatchObject({ contrast: 30, fade: 20, exposure: -1 });
  });

  it('resets vignette and grain groups as one undoable adjustment', () => {
    let state = createAdjustmentHistory({
      grainAmount: 35,
      grainSize: 20,
      vignetteAmount: 60,
      vignetteSoftness: 80,
    });

    state = adjustmentReducer(state, { type: 'reset-group', group: 'vignette' });
    expect(state.present).toMatchObject({ vignetteAmount: 0, vignetteSoftness: 50 });

    state = adjustmentReducer(state, { type: 'undo' });
    expect(state.present).toMatchObject({ vignetteAmount: 60, vignetteSoftness: 80 });

    state = adjustmentReducer(state, { type: 'reset-group', group: 'grain' });
    expect(state.present).toMatchObject({ grainAmount: 0, grainSize: 50 });

    state = adjustmentReducer(state, { type: 'undo' });
    expect(state.present).toMatchObject({ grainAmount: 35, grainSize: 20 });
  });

  it('clears edit history when a new source photograph replaces the current one', () => {
    let state = createAdjustmentHistory({ exposure: 1 });
    state = adjustmentReducer(state, { type: 'replace-source' });

    expect(state).toEqual({ future: [], past: [], present: neutralAdjustments });
  });

  it('records tone curve edits and resets them through history', () => {
    let state = createAdjustmentHistory();
    const points = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.72 },
      { x: 1, y: 1 },
    ];

    state = adjustmentReducer(state, { type: 'set-tone-curve', points });
    expect(state.present.toneCurve).toEqual(points);

    state = adjustmentReducer(state, { type: 'reset-tone-curve' });
    expect(state.present.toneCurve).toEqual(neutralAdjustments.toneCurve);

    state = adjustmentReducer(state, { type: 'undo' });
    expect(state.present.toneCurve).toEqual(points);
  });
});
