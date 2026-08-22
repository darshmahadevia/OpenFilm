import {
  createEditHistory,
  EDIT_HISTORY_LIMIT,
  editHistoryReducer,
  hasNonNeutralEdit,
} from './editHistory';
import { neutralAdjustments } from './adjustments';
import { neutralGeometry } from './geometry';

describe('shared Edit history', () => {
  it('undoes and redoes Adjustments, curve changes, and geometry together', () => {
    let state = createEditHistory();

    state = editHistoryReducer(state, {
      type: 'set-adjustment',
      key: 'exposure',
      value: 1,
      gestureId: 'adjustment-exposure',
    });
    state = editHistoryReducer(state, {
      type: 'set-tone-curve',
      points: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.7 },
        { x: 1, y: 1 },
      ],
    });
    state = editHistoryReducer(state, { type: 'set-adjustment', key: 'grainAmount', value: 35 });
    state = editHistoryReducer(state, { type: 'set-rotation', rotation: 90 });

    state = editHistoryReducer(state, { type: 'undo' });
    expect(state.present.geometry).toEqual(neutralGeometry);
    expect(state.present.adjustments.grainAmount).toBe(35);

    state = editHistoryReducer(state, { type: 'undo' });
    expect(state.present.adjustments.grainAmount).toBe(0);
    expect(state.present.adjustments.toneCurve).toEqual([
      { x: 0, y: 0 },
      { x: 0.5, y: 0.7 },
      { x: 1, y: 1 },
    ]);

    state = editHistoryReducer(state, { type: 'redo' });
    expect(state.present.adjustments.grainAmount).toBe(35);
    expect(state.present.geometry).toEqual(neutralGeometry);
  });

  it('records one entry for a continuous gesture and branches redo history', () => {
    let state = createEditHistory();

    state = editHistoryReducer(state, { type: 'begin-gesture', id: 'adjustment-exposure' });
    for (const value of [0.1, 0.2, 0.3, 0.4]) {
      state = editHistoryReducer(state, {
        type: 'set-adjustment',
        key: 'exposure',
        value,
        gestureId: 'adjustment-exposure',
      });
    }
    state = editHistoryReducer(state, { type: 'end-gesture', id: 'adjustment-exposure' });

    expect(state.past).toHaveLength(1);
    expect(state.present.adjustments.exposure).toBe(0.4);

    state = editHistoryReducer(state, { type: 'undo' });
    expect(state.present.adjustments).toEqual(neutralAdjustments);
    expect(state.future).toHaveLength(1);

    state = editHistoryReducer(state, { type: 'set-adjustment', key: 'tint', value: 20 });
    expect(state.future).toHaveLength(0);
    expect(state.present.adjustments.tint).toBe(20);
  });

  it('coalesces tone curve drag updates into one entry', () => {
    let state = createEditHistory();
    const curve = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ];

    state = editHistoryReducer(state, { type: 'begin-gesture', id: 'tone-curve-drag' });
    state = editHistoryReducer(state, {
      type: 'set-tone-curve',
      gestureId: 'tone-curve-drag',
      points: curve.map((point, index) => (index === 1 ? { ...point, y: point.y + 0.05 } : point)),
    });
    state = editHistoryReducer(state, {
      type: 'set-tone-curve',
      gestureId: 'tone-curve-drag',
      points: curve.map((point, index) => (index === 1 ? { ...point, y: point.y + 0.1 } : point)),
    });
    state = editHistoryReducer(state, { type: 'end-gesture', id: 'tone-curve-drag' });

    expect(state.past).toHaveLength(1);
    state = editHistoryReducer(state, { type: 'undo' });
    expect(state.present.adjustments.toneCurve).toEqual(neutralAdjustments.toneCurve);
  });

  it('keeps the documented history limit and makes resets undoable', () => {
    let state = createEditHistory();

    for (let index = 1; index <= EDIT_HISTORY_LIMIT + 5; index += 1) {
      state = editHistoryReducer(state, {
        type: 'set-adjustment',
        key: 'exposure',
        value: index / 100,
      });
    }

    expect(state.past).toHaveLength(EDIT_HISTORY_LIMIT);
    expect(state.present.adjustments.exposure).toBe(0.55);

    for (let index = 0; index < EDIT_HISTORY_LIMIT; index += 1) {
      state = editHistoryReducer(state, { type: 'undo' });
    }

    expect(state.present.adjustments.exposure).toBe(0.05);
    expect(state.past).toHaveLength(0);

    state = createEditHistory();
    state = editHistoryReducer(state, {
      type: 'set-crop',
      crop: { height: 0.8, width: 0.8, x: 0.1, y: 0.1 },
    });
    state = editHistoryReducer(state, { type: 'reset-geometry' });
    expect(hasNonNeutralEdit(state.present)).toBe(false);

    state = editHistoryReducer(state, { type: 'undo' });
    expect(hasNonNeutralEdit(state.present)).toBe(true);
    expect(state.present.geometry.crop.width).toBe(0.8);
  });

  it('clears all edit history when a source photograph is replaced', () => {
    let state = createEditHistory({ adjustments: { saturation: 40 } });

    state = editHistoryReducer(state, { type: 'set-rotation', rotation: 180 });
    state = editHistoryReducer(state, { type: 'replace-source' });

    expect(state).toEqual(createEditHistory());
  });

  it('applies a Look in one history entry and restores a recoverable history', () => {
    let state = createEditHistory();
    const look = {
      ...neutralAdjustments,
      exposure: 1.25,
      grainAmount: 30,
    };

    state = editHistoryReducer(state, { type: 'apply-look', adjustments: look });
    expect(state.present.adjustments.exposure).toBe(1.25);
    expect(state.present.adjustments.grainAmount).toBe(30);
    expect(state.past).toHaveLength(1);

    const restored = editHistoryReducer(state, {
      type: 'restore',
      history: {
        future: state.future,
        past: state.past,
        present: state.present,
      },
    });

    expect(restored).toEqual({ ...state, gesture: null });
    expect(restored.present).not.toBe(state.present);
  });
});
