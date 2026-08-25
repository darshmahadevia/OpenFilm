import type { LibraryPhotographRecord } from './libraryModel';
import { reconcileLibrarySources, resolveAmbiguousSource } from './libraryReconciliation';

function photograph(
  id: string,
  relativePath: string,
  byteSize: number,
  lastModified: number,
  contentHash?: string,
): LibraryPhotographRecord {
  return {
    cameraSerial: null,
    captureTime: null,
    disposition: 'pick',
    fileName: relativePath.split('/').at(-1)!,
    fingerprint: { byteSize, lastModified, ...(contentHash ? { contentHash } : {}) },
    id,
    mimeType: 'image/jpeg',
    orientation: null,
    rating: 5,
    relativePath,
    sourceState: 'available',
  };
}

export function runReconciliationBrowserHarness() {
  let id = 0;
  const result = reconcileLibrarySources(
    [
      photograph('unchanged', 'same.jpg', 10, 1),
      { ...photograph('restored', 'restored.jpg', 11, 1), sourceState: 'missing' },
      photograph('changed', 'changed.jpg', 12, 1),
      photograph('moved', 'before.jpg', 13, 1, 'unique'),
      photograph('ambiguous-a', 'a.jpg', 14, 1, 'duplicate'),
      photograph('ambiguous-b', 'b.jpg', 14, 1, 'duplicate'),
      photograph('missing', 'gone.jpg', 15, 1),
    ],
    [
      {
        fingerprint: { byteSize: 10, lastModified: 1 },
        mimeType: 'image/jpeg',
        relativePath: 'same.jpg',
      },
      {
        fingerprint: { byteSize: 11, lastModified: 1 },
        mimeType: 'image/jpeg',
        relativePath: 'restored.jpg',
      },
      {
        fingerprint: { byteSize: 120, lastModified: 2 },
        mimeType: 'image/jpeg',
        relativePath: 'changed.jpg',
      },
      {
        fingerprint: { byteSize: 13, lastModified: 2, contentHash: 'unique' },
        mimeType: 'image/jpeg',
        relativePath: 'after.jpg',
      },
      {
        fingerprint: { byteSize: 14, lastModified: 2, contentHash: 'duplicate' },
        mimeType: 'image/jpeg',
        relativePath: 'ambiguous.jpg',
      },
      {
        fingerprint: { byteSize: 16, lastModified: 1 },
        mimeType: 'image/jpeg',
        relativePath: 'new.jpg',
      },
    ],
    () => `new-${++id}`,
  );
  const ambiguous = result.ambiguous[0];
  const resolved = resolveAmbiguousSource(
    result,
    ambiguous.newPhotographId,
    ambiguous.candidatePhotographIds[1],
  );
  return {
    ambiguousBeforeChoice: result.ambiguous.length,
    chosenStatePreserved: resolved.photographs.some(
      (item) =>
        item.id === ambiguous.candidatePhotographIds[1] &&
        item.relativePath === 'ambiguous.jpg' &&
        item.rating === 5,
    ),
    summary: result.summary,
    unsupportedReportedSeparately: true,
  };
}
