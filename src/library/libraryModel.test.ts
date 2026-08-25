import {
  assertOpenFilmLibraryDocument,
  createEmptyLibraryDocument,
  isLibraryPhotographRecord,
  isOpenFilmLibraryDocument,
} from './libraryModel';

describe('OpenFilm Library documents', () => {
  it('creates a versioned empty Library without Source photographs', () => {
    const library = createEmptyLibraryDocument('June shoot', {
      libraryId: 'library-1',
      now: 10,
    });

    expect(library).toEqual({
      createdAt: 10,
      format: 'openfilm.library-state',
      libraryId: 'library-1',
      photographs: [],
      rootName: 'June shoot',
      schemaVersion: 1,
    });
    expect(isOpenFilmLibraryDocument(library)).toBe(true);
  });

  it('rejects a Library file payload that is not the supported document', () => {
    expect(isOpenFilmLibraryDocument({ libraryId: 'wrong', photographs: [] })).toBe(false);
    expect(() => assertOpenFilmLibraryDocument({ libraryId: 'wrong' })).toThrow(
      'supported OpenFilm Library document',
    );
  });

  it('validates a Photograph record without admitting Source bytes', () => {
    const record = {
      cameraSerial: null,
      captureTime: '2024-03-05T14:06:07',
      disposition: 'unmarked',
      fileName: 'frame.jpg',
      fingerprint: { byteSize: 10, lastModified: 20 },
      id: 'photograph-1',
      mimeType: 'image/jpeg',
      orientation: null,
      rating: null,
      relativePath: 'nested/frame.jpg',
      sourceState: 'available',
    };

    expect(isLibraryPhotographRecord(record)).toBe(true);
    expect(isLibraryPhotographRecord({ ...record, source: { blob: 'not allowed' } })).toBe(false);
    expect(isLibraryPhotographRecord({ ...record, fingerprint: { byteSize: -1 } })).toBe(false);
  });
});
