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
    expect(createAdjustmentHistory().present).toEqual(neutralAdjustments);
  });

  it('clamps values to their documented ranges and uses neutral for non-finite input', () => {
    expect(clampAdjustment('exposure', 9)).toBe(4);
    expect(clampAdjustment('contrast', -101)).toBe(-100);
    expect(clampAdjustment('fade', -1)).toBe(0);
    expect(clampAdjustment('temperature', Number.NaN)).toBe(0);
  });

  it('round trips adjustment values through stable JSON', () => {
    const values = {
      ...neutralAdjustments,
      exposure: 1.25,
      saturation: -40,
      temperature: 18,
      toneCurve: [
        { x: 0, y: 0 },
        { x: 0.35, y: 0.62 },
        { x: 1, y: 1 },
      ],
    };

    expect(deserializeAdjustments(serializeAdjustments(values))).toEqual(values);
    expect(deserializeAdjustments('{"exposure": 99, "fade": -10}')).toEqual({
      contrast: 0,
      exposure: 4,
      fade: 0,
      saturation: 0,
      temperature: 0,
      tint: 0,
      toneCurve: neutralAdjustments.toneCurve,
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
