import { normalizeAdjustments, type AdjustmentValues } from './adjustments';
import type { ToneCurvePoint } from './toneCurve';

export const LOOK_TITLE_MAX_LENGTH = 80;
export const LOOK_DESCRIPTION_MAX_LENGTH = 240;

export interface Look {
  adjustments: AdjustmentValues;
  description: string;
  title: string;
}

export interface BundledLook extends Look {
  readonly id: string;
}

function curve(points: ToneCurvePoint[]): ToneCurvePoint[] {
  return points;
}

function createBundledLook(
  id: string,
  title: string,
  description: string,
  adjustments: Partial<AdjustmentValues>,
): BundledLook {
  return {
    adjustments: normalizeAdjustments(adjustments),
    description,
    id,
    title,
  };
}

export const bundledLooks: readonly BundledLook[] = [
  createBundledLook(
    'quiet-morning',
    'Quiet Morning',
    'A soft, lightly faded balance for open shade and early light.',
    {
      contrast: -10,
      exposure: 0.35,
      fade: 10,
      grainAmount: 8,
      grainSize: 42,
      saturation: -8,
      temperature: 8,
      tint: 2,
      toneCurve: curve([
        { x: 0, y: 0 },
        { x: 0.28, y: 0.25 },
        { x: 0.72, y: 0.76 },
        { x: 1, y: 1 },
      ]),
      vignetteAmount: 10,
      vignetteSoftness: 65,
    },
  ),
  createBundledLook(
    'warm-negative',
    'Warm Negative',
    'Amber highlights, gentle color, and a little texture for everyday frames.',
    {
      contrast: 12,
      exposure: 0.15,
      fade: 8,
      grainAmount: 18,
      grainSize: 30,
      saturation: 8,
      temperature: 28,
      tint: 8,
      toneCurve: curve([
        { x: 0, y: 0.03 },
        { x: 0.35, y: 0.31 },
        { x: 0.68, y: 0.7 },
        { x: 1, y: 0.97 },
      ]),
      vignetteAmount: 18,
      vignetteSoftness: 55,
    },
  ),
  createBundledLook(
    'faded-print',
    'Faded Print',
    'Lifted blacks and quiet color with the feel of a well-kept print.',
    {
      contrast: -18,
      exposure: 0.2,
      fade: 35,
      grainAmount: 10,
      grainSize: 58,
      saturation: -20,
      temperature: 10,
      tint: -4,
      toneCurve: curve([
        { x: 0, y: 0.06 },
        { x: 0.3, y: 0.32 },
        { x: 0.7, y: 0.7 },
        { x: 1, y: 0.94 },
      ]),
      vignetteAmount: 6,
      vignetteSoftness: 75,
    },
  ),
  createBundledLook(
    'blue-hour',
    'Blue Hour',
    'A cooler, denser frame for the last minutes before the light goes.',
    {
      contrast: 18,
      exposure: -0.35,
      fade: 4,
      grainAmount: 12,
      grainSize: 34,
      saturation: -5,
      temperature: -30,
      tint: -5,
      toneCurve: curve([
        { x: 0, y: 0.01 },
        { x: 0.3, y: 0.23 },
        { x: 0.65, y: 0.7 },
        { x: 1, y: 1 },
      ]),
      vignetteAmount: 22,
      vignetteSoftness: 50,
    },
  ),
  createBundledLook(
    'soft-portrait',
    'Soft Portrait',
    'Low contrast and a warm touch that keeps skin and quiet light gentle.',
    {
      contrast: -12,
      exposure: 0.25,
      fade: 12,
      grainAmount: 6,
      grainSize: 64,
      saturation: -6,
      temperature: 12,
      tint: 4,
      toneCurve: curve([
        { x: 0, y: 0.02 },
        { x: 0.32, y: 0.3 },
        { x: 0.72, y: 0.75 },
        { x: 1, y: 0.98 },
      ]),
      vignetteAmount: 8,
      vignetteSoftness: 85,
    },
  ),
  createBundledLook(
    'greenroom',
    'Greenroom',
    'A muted, leafy shift for rooms, streets, and overcast afternoons.',
    {
      contrast: 10,
      exposure: -0.1,
      fade: 18,
      grainAmount: 15,
      grainSize: 40,
      saturation: -12,
      temperature: -8,
      tint: -22,
      toneCurve: curve([
        { x: 0, y: 0.04 },
        { x: 0.3, y: 0.28 },
        { x: 0.7, y: 0.73 },
        { x: 1, y: 0.98 },
      ]),
      vignetteAmount: 14,
      vignetteSoftness: 60,
    },
  ),
  createBundledLook(
    'street-dust',
    'Street Dust',
    'Crisp contrast, a little color, and visible grain for candid city light.',
    {
      contrast: 25,
      exposure: 0.4,
      fade: 3,
      grainAmount: 25,
      grainSize: 24,
      saturation: 18,
      temperature: 4,
      tint: 1,
      toneCurve: curve([
        { x: 0, y: 0 },
        { x: 0.25, y: 0.2 },
        { x: 0.68, y: 0.76 },
        { x: 1, y: 1 },
      ]),
      vignetteAmount: 30,
      vignetteSoftness: 45,
    },
  ),
];

export function cloneLookAdjustments(adjustments: AdjustmentValues): AdjustmentValues {
  return normalizeAdjustments(adjustments);
}

export function normalizeLookTitle(value: string): string {
  return value.trim().slice(0, LOOK_TITLE_MAX_LENGTH);
}

export function normalizeLookDescription(value: string): string {
  return value.trim().slice(0, LOOK_DESCRIPTION_MAX_LENGTH);
}
