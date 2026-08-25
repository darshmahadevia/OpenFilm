import type { JsonValue } from './libraryFile';
import {
  cloneOpenFilmLibraryDocument,
  type LibraryPhotographRecord,
  type OpenFilmLibraryDocument,
} from './libraryModel';
import type { ReviewGroupProposal } from './libraryReviewGroups';

export const ANALYSIS_METHOD_VERSION = 'luma-ahash8-laplacian3-v1';
export const SIMILARITY_CAPTURE_NEIGHBORHOOD_MS = 30_000;
export const SIMILARITY_HASH_DISTANCE = 8;

export interface PhotographAnalysisSignal {
  methodVersion: string;
  perceptualHash: string;
  sharpness: number;
}

function sampleLuminance(
  source: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const sourceX = Math.min(width - 1, Math.floor((x / 8) * width));
  const sourceY = Math.min(height - 1, Math.floor((y / 8) * height));
  return source[sourceY * width + sourceX] ?? 0;
}

export function analyzeLuminanceDerivative(
  luminance: Uint8Array,
  width: number,
  height: number,
): PhotographAnalysisSignal {
  if (width < 1 || height < 1 || luminance.length < width * height) {
    throw new Error('Analysis needs a complete orientation-normalized luminance derivative.');
  }
  const samples = Array.from({ length: 64 }, (_, index) =>
    sampleLuminance(luminance, width, height, index % 8, Math.floor(index / 8)),
  );
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  let bits = '';
  for (const value of samples) bits += value >= average ? '1' : '0';
  let perceptualHash = '';
  for (let index = 0; index < bits.length; index += 4) {
    perceptualHash += Number.parseInt(bits.slice(index, index + 4), 2).toString(16);
  }

  const responses: number[] = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const center = luminance[y * width + x];
      responses.push(
        luminance[(y - 1) * width + x] +
          luminance[(y + 1) * width + x] +
          luminance[y * width + x - 1] +
          luminance[y * width + x + 1] -
          center * 4,
      );
    }
  }
  const mean = responses.length
    ? responses.reduce((sum, value) => sum + value, 0) / responses.length
    : 0;
  const sharpness = responses.length
    ? responses.reduce((sum, value) => sum + (value - mean) ** 2, 0) / responses.length
    : 0;
  return { methodVersion: ANALYSIS_METHOD_VERSION, perceptualHash, sharpness };
}

function hashDistance(first: string, second: string): number {
  if (first.length !== second.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let index = 0; index < first.length; index += 1) {
    let value = Number.parseInt(first[index], 16) ^ Number.parseInt(second[index], 16);
    while (value > 0) {
      distance += value & 1;
      value >>= 1;
    }
  }
  return distance;
}

export function proposeSimilarityGroups(
  photographs: readonly LibraryPhotographRecord[],
  signals: ReadonlyMap<string, PhotographAnalysisSignal>,
): ReviewGroupProposal[] {
  const proposals: ReviewGroupProposal[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length > 1) {
      proposals.push({
        id: `similarity:${current.join(':')}`,
        kind: 'similarity',
        photographIds: [...current],
      });
    }
    current = [];
  };

  for (let index = 0; index < photographs.length; index += 1) {
    const photograph = photographs[index];
    const next = photographs[index + 1];
    const signal = signals.get(photograph.id);
    const nextSignal = next ? signals.get(next.id) : undefined;
    const time = photograph.captureTime ? Date.parse(photograph.captureTime) : Number.NaN;
    const nextTime = next?.captureTime ? Date.parse(next.captureTime) : Number.NaN;
    const similar = Boolean(
      signal &&
      nextSignal &&
      signal.methodVersion === ANALYSIS_METHOD_VERSION &&
      nextSignal.methodVersion === ANALYSIS_METHOD_VERSION &&
      Number.isFinite(time) &&
      Number.isFinite(nextTime) &&
      nextTime - time >= 0 &&
      nextTime - time <= SIMILARITY_CAPTURE_NEIGHBORHOOD_MS &&
      hashDistance(signal.perceptualHash, nextSignal.perceptualHash) <= SIMILARITY_HASH_DISTANCE,
    );
    if (similar) {
      if (current.length === 0) current.push(photograph.id);
      current.push(next.id);
    } else if (current.length > 0 && current.at(-1) === photograph.id) {
      flush();
    }
  }
  flush();
  return proposals;
}

export function invalidateAnalysisCache(
  document: OpenFilmLibraryDocument,
  methodVersion: string,
): OpenFilmLibraryDocument {
  const cache = document.analysisCache as { version?: unknown } | undefined;
  if (cache?.version === methodVersion) return document;
  const next = cloneOpenFilmLibraryDocument(document);
  next.analysisCache = { entries: {}, version: methodVersion } as JsonValue;
  return next;
}
