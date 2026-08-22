export interface ToneCurvePoint {
  x: number;
  y: number;
}

export const TONE_CURVE_MIN_POINTS = 2;
export const TONE_CURVE_MAX_POINTS = 8;
export const TONE_CURVE_STEP = 0.01;

export const neutralToneCurve: readonly ToneCurvePoint[] = Object.freeze([
  Object.freeze({ x: 0, y: 0 }),
  Object.freeze({ x: 1, y: 1 }),
]);

function clonePoint(point: ToneCurvePoint): ToneCurvePoint {
  return { x: point.x, y: point.y };
}

function isToneCurvePoint(value: unknown): value is ToneCurvePoint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const point = value as Record<string, unknown>;
  return (
    typeof point.x === 'number' &&
    Number.isFinite(point.x) &&
    typeof point.y === 'number' &&
    Number.isFinite(point.y)
  );
}

function isUnitInterval(value: number): boolean {
  return value >= 0 && value <= 1;
}

export function isValidToneCurve(points: unknown): points is readonly ToneCurvePoint[] {
  if (!Array.isArray(points) || points.length < TONE_CURVE_MIN_POINTS) {
    return false;
  }

  if (points.length > TONE_CURVE_MAX_POINTS || !points.every(isToneCurvePoint)) {
    return false;
  }

  if (
    !isUnitInterval(points[0].x) ||
    points[0].x !== 0 ||
    !isUnitInterval(points[points.length - 1].x) ||
    points[points.length - 1].x !== 1
  ) {
    return false;
  }

  return points.every((point, index) => {
    if (!isUnitInterval(point.x) || !isUnitInterval(point.y)) {
      return false;
    }

    return index === 0 || point.x > points[index - 1].x;
  });
}

export function cloneToneCurve(
  points: readonly ToneCurvePoint[] = neutralToneCurve,
): ToneCurvePoint[] {
  return points.map(clonePoint);
}

export function normalizeToneCurve(
  points: readonly ToneCurvePoint[] | undefined,
): ToneCurvePoint[] {
  return points && isValidToneCurve(points) ? cloneToneCurve(points) : cloneToneCurve();
}

export function toneCurvesEqual(
  first: readonly ToneCurvePoint[],
  second: readonly ToneCurvePoint[],
): boolean {
  return (
    first.length === second.length &&
    first.every((point, index) => point.x === second[index].x && point.y === second[index].y)
  );
}

export function isNeutralToneCurve(points: readonly ToneCurvePoint[]): boolean {
  return toneCurvesEqual(points, neutralToneCurve);
}

export function interpolateToneCurve(points: readonly ToneCurvePoint[], input: number): number {
  if (!isValidToneCurve(points)) {
    throw new Error('OpenFilm could not interpolate an invalid tone curve.');
  }

  const clampedInput = Math.min(1, Math.max(0, Number.isFinite(input) ? input : 0));

  if (clampedInput <= points[0].x) {
    return points[0].y;
  }

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];

    if (clampedInput <= current.x) {
      const progress = (clampedInput - previous.x) / (current.x - previous.x);
      return previous.y + (current.y - previous.y) * progress;
    }
  }

  return points[points.length - 1].y;
}

export function getSuggestedToneCurvePoint(
  points: readonly ToneCurvePoint[],
): ToneCurvePoint | null {
  if (!isValidToneCurve(points) || points.length >= TONE_CURVE_MAX_POINTS) {
    return null;
  }

  let largestGapIndex = 1;
  let largestGap = points[1].x - points[0].x;

  for (let index = 2; index < points.length; index += 1) {
    const gap = points[index].x - points[index - 1].x;

    if (gap > largestGap) {
      largestGap = gap;
      largestGapIndex = index;
    }
  }

  const previous = points[largestGapIndex - 1];
  const current = points[largestGapIndex];
  const x = (previous.x + current.x) / 2;

  return { x, y: interpolateToneCurve(points, x) };
}

export function addToneCurvePoint(
  points: readonly ToneCurvePoint[],
  point: ToneCurvePoint = getSuggestedToneCurvePoint(points) ?? { x: 0, y: 0 },
): ToneCurvePoint[] | null {
  if (!isValidToneCurve(points) || points.length >= TONE_CURVE_MAX_POINTS) {
    return null;
  }

  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    point.x <= 0 ||
    point.x >= 1 ||
    !isUnitInterval(point.y) ||
    points.some((existingPoint) => existingPoint.x === point.x)
  ) {
    return null;
  }

  const next = [...cloneToneCurve(points), clonePoint(point)].sort(
    (first, second) => first.x - second.x,
  );
  return isValidToneCurve(next) ? next : null;
}

export function moveToneCurvePoint(
  points: readonly ToneCurvePoint[],
  index: number,
  position: Partial<ToneCurvePoint>,
): ToneCurvePoint[] | null {
  if (!isValidToneCurve(points) || !Number.isInteger(index) || !points[index]) {
    return null;
  }

  const current = points[index];
  const isEndpoint = index === 0 || index === points.length - 1;
  const x = isEndpoint ? current.x : (position.x ?? current.x);
  const y = position.y ?? current.y;

  if (!Number.isFinite(x) || !Number.isFinite(y) || !isUnitInterval(y)) {
    return null;
  }

  if (
    (!isEndpoint && (x <= points[index - 1].x || x >= points[index + 1].x || !isUnitInterval(x))) ||
    (isEndpoint && (index === 0 ? x !== 0 : x !== 1))
  ) {
    return null;
  }

  const next = cloneToneCurve(points);
  next[index] = { x, y };
  return isValidToneCurve(next) ? next : null;
}

export function removeToneCurvePoint(
  points: readonly ToneCurvePoint[],
  index: number,
): ToneCurvePoint[] | null {
  if (
    !isValidToneCurve(points) ||
    !Number.isInteger(index) ||
    index <= 0 ||
    index >= points.length - 1
  ) {
    return null;
  }

  const next = cloneToneCurve(points);
  next.splice(index, 1);
  return isValidToneCurve(next) ? next : null;
}

export function createToneCurveLookup(
  points: readonly ToneCurvePoint[],
  size = 256,
): Uint8Array<ArrayBuffer> {
  if (!isValidToneCurve(points)) {
    throw new Error('OpenFilm could not create a lookup for an invalid tone curve.');
  }

  if (!Number.isInteger(size) || size < 2) {
    throw new Error('OpenFilm could not create a tone curve lookup of that size.');
  }

  const lookup = new Uint8Array(new ArrayBuffer(size * 4)) as Uint8Array<ArrayBuffer>;

  for (let index = 0; index < size; index += 1) {
    const value = Math.round(interpolateToneCurve(points, index / (size - 1)) * 255);
    const offset = index * 4;
    lookup[offset] = value;
    lookup[offset + 1] = value;
    lookup[offset + 2] = value;
    lookup[offset + 3] = 255;
  }

  return lookup;
}

export function serializeToneCurve(points: readonly ToneCurvePoint[]): string {
  if (!isValidToneCurve(points)) {
    throw new Error('OpenFilm could not serialize an invalid tone curve.');
  }

  return JSON.stringify(cloneToneCurve(points));
}

export function deserializeToneCurve(serialized: string): ToneCurvePoint[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('OpenFilm could not read the tone curve.');
  }

  if (!isValidToneCurve(parsed)) {
    throw new Error('OpenFilm could not read the tone curve.');
  }

  return cloneToneCurve(parsed);
}
