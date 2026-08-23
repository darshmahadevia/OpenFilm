import {
  adjustmentDefinitions,
  adjustmentKeys,
  normalizeAdjustments,
  type AdjustmentValues,
} from './adjustments';
import {
  LOOK_DESCRIPTION_MAX_LENGTH,
  LOOK_TITLE_MAX_LENGTH,
  normalizeLookDescription,
  normalizeLookTitle,
} from './looks';
import { isValidToneCurve, type ToneCurvePoint } from './toneCurve';

export const PRESET_FORMAT_VERSION = '1.1' as const;
export const PRESET_FORMAT_MAJOR_VERSION = 1;
export const PRESET_FORMAT_MINOR_VERSION = 1;
export const PRESET_MAX_FILE_SIZE = 64 * 1024;
export const PRESET_FILE_EXTENSION = 'json';

const PRESET_MIN_SUPPORTED_MINOR_VERSION = 0;
const presetAdjustmentKeys = [...adjustmentKeys, 'toneCurve'] as const;

export interface PresetInput {
  adjustments: AdjustmentValues;
  description?: string;
  title: string;
}

export interface Preset {
  adjustments: AdjustmentValues;
  description?: string;
  formatVersion: string;
  title: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(record);
  return actualKeys.length === keys.length && keys.every((key) => actualKeys.includes(key));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSupportedFormatVersion(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const match = /^(\d+)\.(\d+)$/.exec(value);

  if (!match) {
    return false;
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);

  return (
    `${major}.${minor}` === value &&
    major === PRESET_FORMAT_MAJOR_VERSION &&
    minor >= PRESET_MIN_SUPPORTED_MINOR_VERSION &&
    minor <= PRESET_FORMAT_MINOR_VERSION
  );
}

function isValidText(value: unknown, maximumLength: number, required: boolean): value is string {
  return (
    typeof value === 'string' &&
    value.length <= maximumLength &&
    (!required || normalizeLookTitle(value).length > 0)
  );
}

function isStrictToneCurve(points: unknown): points is ToneCurvePoint[] {
  return (
    isValidToneCurve(points) &&
    points.every((point) => hasExactKeys(point as unknown as Record<string, unknown>, ['x', 'y']))
  );
}

function isValidPresetAdjustments(value: unknown): value is AdjustmentValues {
  if (!isRecord(value) || !hasExactKeys(value, presetAdjustmentKeys)) {
    return false;
  }

  if (!isStrictToneCurve(value.toneCurve)) {
    return false;
  }

  return adjustmentKeys.every((key) => {
    const adjustment = value[key];
    const definition = adjustmentDefinitions[key];

    return (
      isFiniteNumber(adjustment) && adjustment >= definition.min && adjustment <= definition.max
    );
  });
}

function normalizePreset(value: unknown): Preset | null {
  if (!isRecord(value)) {
    return null;
  }

  const allowedKeys =
    value.description === undefined
      ? ['formatVersion', 'title', 'adjustments']
      : ['formatVersion', 'title', 'description', 'adjustments'];

  if (!hasExactKeys(value, allowedKeys)) {
    return null;
  }

  if (!isSupportedFormatVersion(value.formatVersion)) {
    return null;
  }

  if (!isValidText(value.title, LOOK_TITLE_MAX_LENGTH, true)) {
    return null;
  }

  if (
    value.description !== undefined &&
    !isValidText(value.description, LOOK_DESCRIPTION_MAX_LENGTH, false)
  ) {
    return null;
  }

  if (!isValidPresetAdjustments(value.adjustments)) {
    return null;
  }

  const description =
    value.description === undefined ? undefined : normalizeLookDescription(value.description);

  return {
    adjustments: normalizeAdjustments(value.adjustments),
    ...(description === undefined ? {} : { description }),
    formatVersion: value.formatVersion,
    title: normalizeLookTitle(value.title),
  };
}

function throwInvalidPreset(reason = 'The file is malformed or unsupported.'): never {
  throw new Error(`OpenFilm could not read this preset. ${reason}`);
}

export function createPreset(input: PresetInput): Preset {
  const preset = normalizePreset({
    adjustments: input.adjustments,
    ...(input.description === undefined ? {} : { description: input.description }),
    formatVersion: PRESET_FORMAT_VERSION,
    title: input.title,
  });

  if (!preset) {
    throwInvalidPreset('Check the Look name, description, and adjustment values.');
  }

  return preset;
}

export function isValidPreset(value: unknown): value is Preset {
  return normalizePreset(value) !== null;
}

export function serializePreset(preset: Preset): string {
  const normalized = normalizePreset(preset);

  if (!normalized) {
    throwInvalidPreset('The Look contains unsupported values.');
  }

  return `${JSON.stringify(normalized, null, 2)}\n`;
}

function getUtf8ByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).byteLength;
  }

  let byteLength = 0;

  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;

    byteLength += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }

  return byteLength;
}

export function deserializePreset(serialized: string): Preset {
  if (typeof serialized !== 'string' || getUtf8ByteLength(serialized) > PRESET_MAX_FILE_SIZE) {
    throwInvalidPreset('The file is too large.');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    throwInvalidPreset('Use a readable JSON file.');
  }

  const preset = normalizePreset(parsed);

  if (!preset) {
    throwInvalidPreset(
      'The format version, Look metadata, or adjustment values are missing, invalid, or unsupported.',
    );
  }

  return preset;
}

export async function readPresetFile(file: File): Promise<Preset> {
  if (file.size > PRESET_MAX_FILE_SIZE) {
    throwInvalidPreset('The file is too large.');
  }

  return deserializePreset(await file.text());
}

export function getPresetFileName(title: string): string {
  const safeTitle = normalizeLookTitle(title)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return `openfilm-${safeTitle || 'look'}.${PRESET_FILE_EXTENSION}`;
}
