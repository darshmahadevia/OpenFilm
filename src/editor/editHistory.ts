import {
  adjustmentGroups,
  adjustmentKeys,
  clampAdjustment,
  hasNonNeutralAdjustments,
  neutralAdjustments,
  normalizeAdjustments,
  type AdjustmentGroup,
  type AdjustmentKey,
  type AdjustmentValues,
} from './adjustments';
import {
  hasNonNeutralGeometry,
  neutralGeometry,
  normalizeCrop,
  normalizeGeometry,
  type GeometryRotation,
  type GeometryValues,
  type NormalizedCrop,
} from './geometry';
import { isValidToneCurve, type ToneCurvePoint } from './toneCurve';

export const EDIT_HISTORY_LIMIT = 50;

export interface EditSnapshot {
  adjustments: AdjustmentValues;
  geometry: GeometryValues;
}

interface EditGesture {
  id: string;
  start: EditSnapshot;
}

export interface EditHistoryState {
  future: EditSnapshot[];
  past: EditSnapshot[];
  present: EditSnapshot;
  gesture: EditGesture | null;
}

export interface PersistedEditHistory {
  future: EditSnapshot[];
  past: EditSnapshot[];
  present: EditSnapshot;
}

export interface InitialEditValues {
  adjustments?: Partial<AdjustmentValues>;
  geometry?: Partial<GeometryValues>;
}

export type EditHistoryAction =
  | { type: 'set-adjustment'; key: AdjustmentKey; value: number; gestureId?: string }
  | { type: 'set-tone-curve'; points: ToneCurvePoint[]; gestureId?: string }
  | { type: 'reset-one'; key: AdjustmentKey }
  | { type: 'reset-group'; group: AdjustmentGroup }
  | { type: 'reset-tone-curve' }
  | { type: 'reset-adjustments' }
  | { type: 'apply-look'; adjustments: AdjustmentValues }
  | { type: 'set-crop'; crop: Partial<NormalizedCrop> }
  | { type: 'set-geometry'; geometry: GeometryValues }
  | { type: 'set-rotation'; rotation: GeometryRotation }
  | { type: 'toggle-flip-horizontal' }
  | { type: 'toggle-flip-vertical' }
  | { type: 'reset-geometry' }
  | { type: 'begin-gesture'; id: string }
  | { type: 'end-gesture'; id: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'replace-source' }
  | { type: 'restore'; history: PersistedEditHistory };

function cloneSnapshot(snapshot: EditSnapshot): EditSnapshot {
  return {
    adjustments: normalizeAdjustments(snapshot.adjustments),
    geometry: normalizeGeometry(snapshot.geometry),
  };
}

function createSnapshot(values: InitialEditValues = {}): EditSnapshot {
  return cloneSnapshot({
    adjustments: normalizeAdjustments(values.adjustments ?? {}),
    geometry: normalizeGeometry(values.geometry ?? neutralGeometry),
  });
}

function snapshotsEqual(first: EditSnapshot, second: EditSnapshot): boolean {
  const firstAdjustments = first.adjustments;
  const secondAdjustments = second.adjustments;

  return (
    adjustmentKeys.every((key) => firstAdjustments[key] === secondAdjustments[key]) &&
    firstAdjustments.toneCurve.length === secondAdjustments.toneCurve.length &&
    firstAdjustments.toneCurve.every(
      (point, index) =>
        point.x === secondAdjustments.toneCurve[index].x &&
        point.y === secondAdjustments.toneCurve[index].y,
    ) &&
    first.geometry.crop.x === second.geometry.crop.x &&
    first.geometry.crop.y === second.geometry.crop.y &&
    first.geometry.crop.width === second.geometry.crop.width &&
    first.geometry.crop.height === second.geometry.crop.height &&
    first.geometry.rotation === second.geometry.rotation &&
    first.geometry.flipHorizontal === second.geometry.flipHorizontal &&
    first.geometry.flipVertical === second.geometry.flipVertical
  );
}

function appendPast(past: EditSnapshot[], snapshot: EditSnapshot): EditSnapshot[] {
  return [...past, cloneSnapshot(snapshot)].slice(-EDIT_HISTORY_LIMIT);
}

function commitGesture(state: EditHistoryState): EditHistoryState {
  if (!state.gesture) {
    return state;
  }

  if (snapshotsEqual(state.gesture.start, state.present)) {
    return { ...state, gesture: null };
  }

  return {
    future: [],
    gesture: null,
    past: appendPast(state.past, state.gesture.start),
    present: cloneSnapshot(state.present),
  };
}

function recordSnapshot(
  state: EditHistoryState,
  snapshot: EditSnapshot,
  gestureId?: string,
): EditHistoryState {
  const normalized = cloneSnapshot(snapshot);

  if (snapshotsEqual(state.present, normalized)) {
    return state;
  }

  if (gestureId && state.gesture?.id === gestureId) {
    return { ...state, present: normalized };
  }

  const committed = commitGesture(state);

  return {
    future: [],
    gesture: null,
    past: appendPast(committed.past, committed.present),
    present: normalized,
  };
}

export function createEditHistory(values: InitialEditValues = {}): EditHistoryState {
  return {
    future: [],
    gesture: null,
    past: [],
    present: createSnapshot(values),
  };
}

export function restoreEditHistory(history: PersistedEditHistory): EditHistoryState {
  return {
    future: history.future.map(cloneSnapshot).slice(0, EDIT_HISTORY_LIMIT),
    gesture: null,
    past: history.past.map(cloneSnapshot).slice(-EDIT_HISTORY_LIMIT),
    present: cloneSnapshot(history.present),
  };
}

export function hasNonNeutralEdit(snapshot: EditSnapshot): boolean {
  return hasNonNeutralAdjustments(snapshot.adjustments) || hasNonNeutralGeometry(snapshot.geometry);
}

export function editHistoryReducer(
  state: EditHistoryState,
  action: EditHistoryAction,
): EditHistoryState {
  switch (action.type) {
    case 'set-adjustment':
      return recordSnapshot(
        state,
        {
          ...state.present,
          adjustments: {
            ...state.present.adjustments,
            [action.key]: clampAdjustment(action.key, action.value),
          },
        },
        action.gestureId,
      );
    case 'set-tone-curve':
      if (!isValidToneCurve(action.points)) {
        return state;
      }

      return recordSnapshot(
        state,
        {
          ...state.present,
          adjustments: {
            ...state.present.adjustments,
            toneCurve: action.points.map((point) => ({ ...point })),
          },
        },
        action.gestureId,
      );
    case 'reset-one':
      return recordSnapshot(state, {
        ...state.present,
        adjustments: {
          ...state.present.adjustments,
          [action.key]: neutralAdjustments[action.key],
        },
      });
    case 'reset-group':
      return recordSnapshot(state, {
        ...state.present,
        adjustments: adjustmentGroups[action.group].reduce(
          (values, key) => ({ ...values, [key]: neutralAdjustments[key] }),
          { ...state.present.adjustments },
        ),
      });
    case 'reset-tone-curve':
      return recordSnapshot(state, {
        ...state.present,
        adjustments: normalizeAdjustments({
          ...state.present.adjustments,
          toneCurve: neutralAdjustments.toneCurve,
        }),
      });
    case 'reset-adjustments':
      return recordSnapshot(state, {
        ...state.present,
        adjustments: normalizeAdjustments({}),
      });
    case 'apply-look':
      return recordSnapshot(state, {
        ...state.present,
        adjustments: normalizeAdjustments(action.adjustments),
      });
    case 'set-crop':
      return recordSnapshot(state, {
        ...state.present,
        geometry: {
          ...state.present.geometry,
          crop: normalizeCrop({ ...state.present.geometry.crop, ...action.crop }),
        },
      });
    case 'set-geometry':
      return recordSnapshot(state, {
        ...state.present,
        geometry: action.geometry,
      });
    case 'set-rotation':
      return recordSnapshot(state, {
        ...state.present,
        geometry: { ...state.present.geometry, rotation: action.rotation },
      });
    case 'toggle-flip-horizontal':
      return recordSnapshot(state, {
        ...state.present,
        geometry: {
          ...state.present.geometry,
          flipHorizontal: !state.present.geometry.flipHorizontal,
        },
      });
    case 'toggle-flip-vertical':
      return recordSnapshot(state, {
        ...state.present,
        geometry: {
          ...state.present.geometry,
          flipVertical: !state.present.geometry.flipVertical,
        },
      });
    case 'reset-geometry':
      return recordSnapshot(state, {
        ...state.present,
        geometry: neutralGeometry,
      });
    case 'begin-gesture': {
      const committed = commitGesture(state);

      return {
        ...committed,
        gesture: { id: action.id, start: cloneSnapshot(committed.present) },
      };
    }
    case 'end-gesture':
      return state.gesture?.id === action.id ? commitGesture(state) : state;
    case 'undo': {
      const committed = commitGesture(state);
      const previous = committed.past.at(-1);

      if (!previous) {
        return committed;
      }

      return {
        future: [cloneSnapshot(committed.present), ...committed.future],
        gesture: null,
        past: committed.past.slice(0, -1),
        present: cloneSnapshot(previous),
      };
    }
    case 'redo': {
      const committed = commitGesture(state);
      const next = committed.future[0];

      if (!next) {
        return committed;
      }

      return {
        future: committed.future.slice(1),
        gesture: null,
        past: appendPast(committed.past, committed.present),
        present: cloneSnapshot(next),
      };
    }
    case 'replace-source':
      return createEditHistory();
    case 'restore':
      return restoreEditHistory(action.history);
    default:
      return state;
  }
}
