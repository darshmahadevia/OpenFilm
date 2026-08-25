import {
  assertOpenFilmLibraryDocument,
  createEmptyLibraryDocument,
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
});
