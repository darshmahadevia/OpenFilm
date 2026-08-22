export const GEOMETRY_ROTATIONS = [0, 90, 180, 270] as const;

export type GeometryRotation = (typeof GEOMETRY_ROTATIONS)[number];

export const CROP_MIN_SIZE = 0.01;

export const cropAspectRatioOptions = [
  { label: 'Free', value: 'free' },
  { label: 'Original', value: 'original' },
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:2', value: '3:2' },
  { label: '16:9', value: '16:9' },
] as const;

export type CropAspectRatio = (typeof cropAspectRatioOptions)[number]['value'];

export interface NormalizedCrop {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface GeometryValues {
  crop: NormalizedCrop;
  flipHorizontal: boolean;
  flipVertical: boolean;
  rotation: GeometryRotation;
}

export interface GeometryDimensions {
  height: number;
  width: number;
}

export type CropHandle = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

export const neutralCrop: NormalizedCrop = {
  height: 1,
  width: 1,
  x: 0,
  y: 0,
};

export const neutralGeometry: GeometryValues = {
  crop: { ...neutralCrop },
  flipHorizontal: false,
  flipVertical: false,
  rotation: 0,
};

export interface GeometryHistoryState {
  future: GeometryValues[];
  past: GeometryValues[];
  present: GeometryValues;
}

export type GeometryAction =
  | { type: 'set-crop'; crop: Partial<NormalizedCrop> }
  | { type: 'set-rotation'; rotation: GeometryRotation }
  | { type: 'toggle-flip-horizontal' }
  | { type: 'toggle-flip-vertical' }
  | { type: 'reset' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'replace-source' };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isGeometryRotation(value: unknown): value is GeometryRotation {
  return GEOMETRY_ROTATIONS.includes(value as GeometryRotation);
}

function cloneGeometry(values: GeometryValues): GeometryValues {
  return {
    crop: { ...values.crop },
    flipHorizontal: values.flipHorizontal,
    flipVertical: values.flipVertical,
    rotation: values.rotation,
  };
}

function cropFromEdges(left: number, top: number, right: number, bottom: number): NormalizedCrop {
  return normalizeCrop({
    height: bottom - top,
    width: right - left,
    x: left,
    y: top,
  });
}

export function normalizeCrop(crop: Partial<NormalizedCrop> = {}): NormalizedCrop {
  let width = clamp(finiteOrDefault(crop.width, neutralCrop.width), CROP_MIN_SIZE, 1);
  let height = clamp(finiteOrDefault(crop.height, neutralCrop.height), CROP_MIN_SIZE, 1);
  let x = clamp(finiteOrDefault(crop.x, neutralCrop.x), 0, 1);
  let y = clamp(finiteOrDefault(crop.y, neutralCrop.y), 0, 1);

  if (x + width > 1) {
    width = 1 - x;
  }

  if (y + height > 1) {
    height = 1 - y;
  }

  if (width < CROP_MIN_SIZE) {
    width = CROP_MIN_SIZE;
    x = 1 - width;
  }

  if (height < CROP_MIN_SIZE) {
    height = CROP_MIN_SIZE;
    y = 1 - height;
  }

  return { height, width, x, y };
}

export function normalizeGeometry(values: Partial<GeometryValues> = {}): GeometryValues {
  return {
    crop: normalizeCrop(values.crop),
    flipHorizontal: values.flipHorizontal === true,
    flipVertical: values.flipVertical === true,
    rotation: isGeometryRotation(values.rotation) ? values.rotation : 0,
  };
}

export function isValidGeometry(value: unknown): value is GeometryValues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const crop = record.crop;

  if (!crop || typeof crop !== 'object' || Array.isArray(crop)) {
    return false;
  }

  const cropRecord = crop as Record<string, unknown>;
  const cropValues = [cropRecord.x, cropRecord.y, cropRecord.width, cropRecord.height];

  if (
    !isGeometryRotation(record.rotation) ||
    typeof record.flipHorizontal !== 'boolean' ||
    typeof record.flipVertical !== 'boolean' ||
    !cropValues.every((item) => typeof item === 'number' && Number.isFinite(item))
  ) {
    return false;
  }

  const [x, y, width, height] = cropValues as number[];

  return (
    x >= 0 &&
    y >= 0 &&
    width >= CROP_MIN_SIZE &&
    height >= CROP_MIN_SIZE &&
    x + width <= 1 &&
    y + height <= 1
  );
}

export function hasNonNeutralGeometry(values: GeometryValues): boolean {
  const geometry = normalizeGeometry(values);

  return (
    geometry.crop.x !== neutralCrop.x ||
    geometry.crop.y !== neutralCrop.y ||
    geometry.crop.width !== neutralCrop.width ||
    geometry.crop.height !== neutralCrop.height ||
    geometry.rotation !== 0 ||
    geometry.flipHorizontal ||
    geometry.flipVertical
  );
}

function geometryEqual(first: GeometryValues, second: GeometryValues): boolean {
  return (
    first.crop.x === second.crop.x &&
    first.crop.y === second.crop.y &&
    first.crop.width === second.crop.width &&
    first.crop.height === second.crop.height &&
    first.rotation === second.rotation &&
    first.flipHorizontal === second.flipHorizontal &&
    first.flipVertical === second.flipVertical
  );
}

function recordGeometry(
  state: GeometryHistoryState,
  present: GeometryValues,
): GeometryHistoryState {
  const normalized = normalizeGeometry(present);

  if (geometryEqual(state.present, normalized)) {
    return state;
  }

  return {
    future: [],
    past: [...state.past, cloneGeometry(state.present)],
    present: normalized,
  };
}

export function createGeometryHistory(
  initialValues: Partial<GeometryValues> = {},
): GeometryHistoryState {
  return {
    future: [],
    past: [],
    present: normalizeGeometry(initialValues),
  };
}

export function geometryReducer(
  state: GeometryHistoryState,
  action: GeometryAction,
): GeometryHistoryState {
  switch (action.type) {
    case 'set-crop':
      return recordGeometry(state, {
        ...state.present,
        crop: normalizeCrop({ ...state.present.crop, ...action.crop }),
      });
    case 'set-rotation':
      return recordGeometry(state, { ...state.present, rotation: action.rotation });
    case 'toggle-flip-horizontal':
      return recordGeometry(state, {
        ...state.present,
        flipHorizontal: !state.present.flipHorizontal,
      });
    case 'toggle-flip-vertical':
      return recordGeometry(state, {
        ...state.present,
        flipVertical: !state.present.flipVertical,
      });
    case 'reset':
      return recordGeometry(state, neutralGeometry);
    case 'undo': {
      const previous = state.past.at(-1);

      if (!previous) {
        return state;
      }

      return {
        future: [cloneGeometry(state.present), ...state.future],
        past: state.past.slice(0, -1),
        present: cloneGeometry(previous),
      };
    }
    case 'redo': {
      const next = state.future[0];

      if (!next) {
        return state;
      }

      return {
        future: state.future.slice(1),
        past: [...state.past, cloneGeometry(state.present)],
        present: cloneGeometry(next),
      };
    }
    case 'replace-source':
      return createGeometryHistory();
    default:
      return state;
  }
}

export function moveCrop(crop: NormalizedCrop, deltaX: number, deltaY: number): NormalizedCrop {
  const normalized = normalizeCrop(crop);

  return {
    ...normalized,
    x: clamp(normalized.x + finiteOrDefault(deltaX, 0), 0, 1 - normalized.width),
    y: clamp(normalized.y + finiteOrDefault(deltaY, 0), 0, 1 - normalized.height),
  };
}

export function resizeCrop(
  crop: NormalizedCrop,
  handle: CropHandle,
  deltaX: number,
  deltaY: number,
): NormalizedCrop {
  const normalized = normalizeCrop(crop);
  const right = normalized.x + normalized.width;
  const bottom = normalized.y + normalized.height;
  const x = finiteOrDefault(deltaX, 0);
  const y = finiteOrDefault(deltaY, 0);

  switch (handle) {
    case 'top-left':
      return cropFromEdges(
        clamp(normalized.x + x, 0, right - CROP_MIN_SIZE),
        clamp(normalized.y + y, 0, bottom - CROP_MIN_SIZE),
        right,
        bottom,
      );
    case 'top-right':
      return cropFromEdges(
        normalized.x,
        clamp(normalized.y + y, 0, bottom - CROP_MIN_SIZE),
        clamp(right + x, normalized.x + CROP_MIN_SIZE, 1),
        bottom,
      );
    case 'bottom-left':
      return cropFromEdges(
        clamp(normalized.x + x, 0, right - CROP_MIN_SIZE),
        normalized.y,
        right,
        clamp(bottom + y, normalized.y + CROP_MIN_SIZE, 1),
      );
    case 'bottom-right':
      return cropFromEdges(
        normalized.x,
        normalized.y,
        clamp(right + x, normalized.x + CROP_MIN_SIZE, 1),
        clamp(bottom + y, normalized.y + CROP_MIN_SIZE, 1),
      );
  }
}

function getAspectRatioValue(
  aspectRatio: CropAspectRatio,
  sourceWidth: number,
  sourceHeight: number,
): number | null {
  if (aspectRatio === 'free') {
    return null;
  }

  if (aspectRatio === 'original') {
    return sourceWidth > 0 && sourceHeight > 0 ? sourceWidth / sourceHeight : null;
  }

  const [width, height] = aspectRatio.split(':').map(Number);

  return width > 0 && height > 0 ? width / height : null;
}

export function cropForAspectRatio(
  crop: NormalizedCrop,
  aspectRatio: CropAspectRatio,
  sourceWidth: number,
  sourceHeight: number,
): NormalizedCrop {
  const normalized = normalizeCrop(crop);
  const target = getAspectRatioValue(aspectRatio, sourceWidth, sourceHeight);

  if (
    !target ||
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    return normalized;
  }

  const sourceAspect = sourceWidth / sourceHeight;
  const normalizedTarget = target / sourceAspect;
  let width = normalized.width;
  let height = normalized.height;

  if (width / height > normalizedTarget) {
    width = height * normalizedTarget;
  } else {
    height = width / normalizedTarget;
  }

  return normalizeCrop({
    height,
    width,
    x: normalized.x + (normalized.width - width) / 2,
    y: normalized.y + (normalized.height - height) / 2,
  });
}

export function getGeometryOutputDimensions(
  source: GeometryDimensions,
  values: GeometryValues,
): GeometryDimensions {
  const geometry = normalizeGeometry(values);
  const width = Math.max(1, Math.round(Math.max(1, source.width) * geometry.crop.width));
  const height = Math.max(1, Math.round(Math.max(1, source.height) * geometry.crop.height));

  return geometry.rotation === 90 || geometry.rotation === 270
    ? { height: width, width: height }
    : { height, width };
}

export function mapOutputUvToSourceUv(
  outputUv: { x: number; y: number },
  values: GeometryValues,
): { x: number; y: number } {
  const geometry = normalizeGeometry(values);
  let x = clamp(outputUv.x, 0, 1);
  let y = clamp(outputUv.y, 0, 1);

  if (geometry.flipHorizontal) {
    x = 1 - x;
  }

  if (geometry.flipVertical) {
    y = 1 - y;
  }

  const rotated =
    geometry.rotation === 90
      ? { x: y, y: 1 - x }
      : geometry.rotation === 180
        ? { x: 1 - x, y: 1 - y }
        : geometry.rotation === 270
          ? { x: 1 - y, y: x }
          : { x, y };

  return {
    x: geometry.crop.x + rotated.x * geometry.crop.width,
    y: geometry.crop.y + rotated.y * geometry.crop.height,
  };
}

export function serializeGeometry(values: GeometryValues): string {
  return JSON.stringify(normalizeGeometry(values));
}

export function deserializeGeometry(serialized: string): GeometryValues {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('OpenFilm could not recover the geometry state.');
  }

  if (!isValidGeometry(parsed)) {
    throw new Error('OpenFilm could not recover the geometry state.');
  }

  return normalizeGeometry(parsed);
}
