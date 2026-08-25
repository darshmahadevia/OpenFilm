import { createEmptyLibraryDocument, type LibraryPhotographRecord } from './libraryModel';
import {
  ANALYSIS_METHOD_VERSION,
  analyzeLuminanceDerivative,
  invalidateAnalysisCache,
  proposeSimilarityGroups,
} from './libraryAnalysis';

function photo(id: string, captureTime: string): LibraryPhotographRecord {
  return {
    cameraSerial: 'camera',
    captureTime,
    disposition: 'unmarked',
    fileName: `${id}.jpg`,
    fingerprint: { byteSize: 1, lastModified: 1 },
    id,
    mimeType: 'image/jpeg',
    orientation: null,
    rating: null,
    relativePath: `${id}.jpg`,
    sourceState: 'available',
  };
}

describe('advisory photograph analysis', () => {
  it('computes a versioned perceptual hash and relative Laplacian sharpness from luminance', () => {
    const flat = analyzeLuminanceDerivative(new Uint8Array(64).fill(128), 8, 8);
    const edge = analyzeLuminanceDerivative(
      Uint8Array.from({ length: 64 }, (_, index) => (index % 2 ? 255 : 0)),
      8,
      8,
    );
    expect(flat.methodVersion).toBe(ANALYSIS_METHOD_VERSION);
    expect(flat.sharpness).toBe(0);
    expect(edge.sharpness).toBeGreaterThan(flat.sharpness);
    expect(edge.perceptualHash).toHaveLength(16);
  });

  it('proposes likeness only inside a capture-time neighborhood and never mutates Culling state', () => {
    const photographs = [
      photo('1', '2026-01-01T00:00:00.000Z'),
      photo('2', '2026-01-01T00:00:05.000Z'),
      photo('3', '2026-01-01T01:00:00.000Z'),
    ];
    const signals = new Map([
      [
        '1',
        {
          perceptualHash: '0000000000000000',
          sharpness: 10,
          methodVersion: ANALYSIS_METHOD_VERSION,
        },
      ],
      [
        '2',
        {
          perceptualHash: '0000000000000001',
          sharpness: 20,
          methodVersion: ANALYSIS_METHOD_VERSION,
        },
      ],
      [
        '3',
        {
          perceptualHash: '0000000000000000',
          sharpness: 30,
          methodVersion: ANALYSIS_METHOD_VERSION,
        },
      ],
    ]);
    expect(proposeSimilarityGroups(photographs, signals)).toMatchObject([
      { kind: 'similarity', photographIds: ['1', '2'] },
    ]);
    expect(
      photographs.every((item) => item.disposition === 'unmarked' && item.rating === null),
    ).toBe(true);
  });

  it('invalidates only derived analysis when the method version changes', () => {
    const document = {
      ...createEmptyLibraryDocument('Analysis'),
      reviewGroups: [
        { id: 'manual', origin: 'manual', photographIds: ['1'], expanded: true, provenance: [] },
      ],
      analysisCache: { version: 'old', entries: { one: {} } },
    };
    const next = invalidateAnalysisCache(document, ANALYSIS_METHOD_VERSION);
    expect(next).not.toHaveProperty('analysisCache.entries.one');
    expect(next.reviewGroups).toEqual(document.reviewGroups);
  });
});
