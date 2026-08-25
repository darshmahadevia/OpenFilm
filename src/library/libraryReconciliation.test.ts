import type { LibraryPhotographRecord } from './libraryModel';
import {
  reconcileLibrarySources,
  resolveAmbiguousSource,
  resolveLibrarySourceChoice,
} from './libraryReconciliation';
import { createEmptyLibraryDocument } from './libraryModel';

function record(id: string, path: string, size = 10, hash?: string): LibraryPhotographRecord {
  return {
    cameraSerial: null,
    captureTime: null,
    disposition: id === 'old' ? 'pick' : 'unmarked',
    fileName: path,
    fingerprint: { byteSize: size, lastModified: 1, ...(hash ? { contentHash: hash } : {}) },
    id,
    mimeType: 'image/jpeg',
    orientation: null,
    rating: id === 'old' ? 5 : null,
    relativePath: path,
    sourceState: 'available',
  };
}

describe('Library source reconciliation', () => {
  it('preserves unchanged identity, creates a new identity for changed bytes, and keeps old state Missing', () => {
    const result = reconcileLibrarySources(
      [record('old', 'frame.jpg')],
      [
        {
          fingerprint: { byteSize: 11, lastModified: 2 },
          mimeType: 'image/jpeg',
          relativePath: 'frame.jpg',
        },
      ],
      () => 'new',
    );
    expect(result.photographs).toEqual(
      expect.arrayContaining(
        [
          { id: 'old', disposition: 'pick', rating: 5, sourceState: 'missing' },
          { id: 'new', disposition: 'unmarked', sourceState: 'available' },
        ].map((expected) => expect.objectContaining(expected)),
      ),
    );
    expect(result.summary.changed).toBe(1);
  });

  it('relinks one unique content hash and preserves state', () => {
    const result = reconcileLibrarySources(
      [record('old', 'before.jpg', 10, 'same')],
      [
        {
          fingerprint: { byteSize: 10, lastModified: 2, contentHash: 'same' },
          mimeType: 'image/jpeg',
          relativePath: 'after.jpg',
        },
      ],
      () => 'new',
    );
    expect(result.photographs).toMatchObject([
      { id: 'old', relativePath: 'after.jpg', disposition: 'pick', sourceState: 'available' },
    ]);
    expect(result.summary.moved).toBe(1);
  });

  it('keeps ambiguous identities separate for an explicit choice', () => {
    const result = reconcileLibrarySources(
      [record('one', 'one.jpg', 10, 'same'), record('two', 'two.jpg', 10, 'same')],
      [
        {
          fingerprint: { byteSize: 10, lastModified: 2, contentHash: 'same' },
          mimeType: 'image/jpeg',
          relativePath: 'moved.jpg',
        },
      ],
      () => 'new',
    );
    expect(result.ambiguous).toEqual([
      { candidatePhotographIds: ['one', 'two'], newPhotographId: 'new' },
    ]);
    expect(result.photographs.filter((item) => item.sourceState === 'missing')).toHaveLength(2);

    const resolved = resolveAmbiguousSource(result, 'new', 'two');
    expect(resolved.ambiguous).toEqual([]);
    expect(resolved.photographs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'two', relativePath: 'moved.jpg', sourceState: 'available' }),
        expect.objectContaining({ id: 'one', sourceState: 'missing' }),
      ]),
    );
    expect(resolved.photographs.some((item) => item.id === 'new')).toBe(false);

    const document = {
      ...createEmptyLibraryDocument('Choices'),
      photographs: result.photographs.map((item) =>
        item.id === 'new'
          ? { ...item, reconciliationCandidates: ['one', 'two'] }
          : item.id === 'one'
            ? { ...item, disposition: 'pick' as const, rating: 5 }
            : item,
      ),
    };
    const chosen = resolveLibrarySourceChoice(document, 'new', 'one');
    expect(chosen.photographs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'one', relativePath: 'moved.jpg', rating: 5 }),
      ]),
    );
  });
});
