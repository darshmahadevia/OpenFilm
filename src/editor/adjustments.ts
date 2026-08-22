import {
  cloneToneCurve,
  isValidToneCurve,
  isNeutralToneCurve,
  neutralToneCurve,
  normalizeToneCurve,
  toneCurvesEqual,
  type ToneCurvePoint,
} from './toneCurve';

export const adjustmentKeys = [
  'exposure',
  'contrast',
  'temperature',
  'tint',
  'saturation',
  'fade',
] as const;

export type AdjustmentKey = (typeof adjustmentKeys)[number];

export interface AdjustmentValues {
  contrast: number;
  exposure: number;
  fade: number;
  saturation: number;
  temperature: number;
  tint: number;
  toneCurve: ToneCurvePoint[];
}

interface AdjustmentDefinition {
  readonly description: string;
  readonly label: string;
  readonly max: number;
  readonly min: number;
  readonly neutral: number;
  readonly rangeHint: string;
  readonly step: number;
}

export const adjustmentDefinitions = {
  exposure: {
    description: 'Brighten or darken the whole photograph.',
    label: 'Exposure',
    max: 4,
    min: -4,
    neutral: 0,
    rangeHint: 'Range -4 to +4 stops; neutral 0.',
    step: 0.01,
  },
  contrast: {
    description: 'Separate or soften the light and dark tones.',
    label: 'Contrast',
    max: 100,
    min: -100,
    neutral: 0,
    rangeHint: 'Range -100 to +100; neutral 0.',
    step: 1,
  },
  temperature: {
    description: 'Shift the photograph toward cool blue or warm amber.',
    label: 'Temperature',
    max: 100,
    min: -100,
    neutral: 0,
    rangeHint: 'Range -100 to +100; neutral 0.',
    step: 1,
  },
  tint: {
    description: 'Shift the photograph toward green or magenta.',
    label: 'Tint',
    max: 100,
    min: -100,
    neutral: 0,
    rangeHint: 'Range -100 to +100; neutral 0.',
    step: 1,
  },
  saturation: {
    description: 'Reduce or increase color intensity.',
    label: 'Saturation',
    max: 100,
    min: -100,
    neutral: 0,
    rangeHint: 'Range -100 to +100; neutral 0.',
    step: 1,
  },
  fade: {
    description: 'Lift contrast toward a softer, faded print.',
    label: 'Fade',
    max: 100,
    min: 0,
    neutral: 0,
    rangeHint: 'Range 0 to 100; neutral 0.',
    step: 1,
  },
} as const satisfies Record<AdjustmentKey, AdjustmentDefinition>;

export const neutralAdjustments: AdjustmentValues = {
  contrast: 0,
  exposure: 0,
  fade: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  toneCurve: cloneToneCurve(neutralToneCurve),
};

export interface AdjustmentHistoryState {
  future: AdjustmentValues[];
  past: AdjustmentValues[];
  present: AdjustmentValues;
}

export type AdjustmentAction =
  | { type: 'set'; key: AdjustmentKey; value: number }
  | { type: 'set-tone-curve'; points: ToneCurvePoint[] }
  | { type: 'reset-one'; key: AdjustmentKey }
  | { type: 'reset-tone-curve' }
  | { type: 'reset-all' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'replace-source' };

export function clampAdjustment(key: AdjustmentKey, value: number): number {
  const definition = adjustmentDefinitions[key];

  if (!Number.isFinite(value)) {
    return definition.neutral;
  }

  return Math.min(definition.max, Math.max(definition.min, value));
}

export function normalizeAdjustments(values: Partial<AdjustmentValues>): AdjustmentValues {
  const normalized = adjustmentKeys.reduce((result, key) => {
    result[key] = clampAdjustment(key, values[key] ?? neutralAdjustments[key]);
    return result;
  }, {} as AdjustmentValues);

  return {
    ...normalized,
    toneCurve: normalizeToneCurve(values.toneCurve),
  };
}

export function createAdjustmentHistory(
  initialValues: Partial<AdjustmentValues> = {},
): AdjustmentHistoryState {
  return {
    future: [],
    past: [],
    present: normalizeAdjustments(initialValues),
  };
}

function adjustmentsEqual(first: AdjustmentValues, second: AdjustmentValues): boolean {
  return (
    adjustmentKeys.every((key) => first[key] === second[key]) &&
    toneCurvesEqual(first.toneCurve, second.toneCurve)
  );
}

function recordAdjustment(
  state: AdjustmentHistoryState,
  present: AdjustmentValues,
): AdjustmentHistoryState {
  if (adjustmentsEqual(state.present, present)) {
    return state;
  }

  return {
    future: [],
    past: [...state.past, state.present],
    present,
  };
}

export function adjustmentReducer(
  state: AdjustmentHistoryState,
  action: AdjustmentAction,
): AdjustmentHistoryState {
  switch (action.type) {
    case 'set':
      return recordAdjustment(state, {
        ...state.present,
        [action.key]: clampAdjustment(action.key, action.value),
      });
    case 'set-tone-curve':
      if (!isValidToneCurve(action.points)) {
        return state;
      }

      return recordAdjustment(state, {
        ...state.present,
        toneCurve: cloneToneCurve(action.points),
      });
    case 'reset-one':
      return recordAdjustment(state, {
        ...state.present,
        [action.key]: neutralAdjustments[action.key],
      });
    case 'reset-tone-curve':
      return recordAdjustment(state, {
        ...state.present,
        toneCurve: cloneToneCurve(neutralToneCurve),
      });
    case 'reset-all':
      return recordAdjustment(state, { ...neutralAdjustments });
    case 'undo': {
      const previous = state.past.at(-1);

      if (!previous) {
        return state;
      }

      return {
        future: [state.present, ...state.future],
        past: state.past.slice(0, -1),
        present: previous,
      };
    }
    case 'redo': {
      const next = state.future[0];

      if (!next) {
        return state;
      }

      return {
        future: state.future.slice(1),
        past: [...state.past, state.present],
        present: next,
      };
    }
    case 'replace-source':
      return createAdjustmentHistory();
    default:
      return state;
  }
}

export function hasNonNeutralAdjustments(values: AdjustmentValues): boolean {
  return (
    adjustmentKeys.some((key) => values[key] !== neutralAdjustments[key]) ||
    !isNeutralToneCurve(values.toneCurve)
  );
}

export function serializeAdjustments(values: AdjustmentValues): string {
  return JSON.stringify(normalizeAdjustments(values));
}

export function deserializeAdjustments(serialized: string): AdjustmentValues {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('OpenFilm could not read the adjustment values.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('OpenFilm could not read the adjustment values.');
  }

  const parsedRecord = parsed as Record<string, unknown>;

  if ('toneCurve' in parsedRecord && !isValidToneCurve(parsedRecord.toneCurve)) {
    throw new Error('OpenFilm could not read the tone curve.');
  }

  return normalizeAdjustments(parsed as Partial<AdjustmentValues>);
}

export function formatAdjustmentValue(key: AdjustmentKey, value: number): string {
  return key === 'exposure' ? value.toFixed(2) : Math.round(value).toString();
}

export type { AdjustmentDefinition };
