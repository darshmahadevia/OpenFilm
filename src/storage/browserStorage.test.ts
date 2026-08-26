import { createEditHistory } from '../editor/editHistory';
import { neutralAdjustments } from '../editor/adjustments';
import {
  createBrowserStorage,
  createMemoryStorage,
  normalizeStoredLibraryRecovery,
  describeStorageError,
  normalizeStoredEdit,
  type StoredEdit,
  type StoredLook,
} from './browserStorage';
import { createEmptyLibraryDocument } from '../library/libraryModel';

const firstLook: StoredLook = {
  adjustments: { ...neutralAdjustments, exposure: 0.5 },
  createdAt: 1,
  description: 'A saved starting point.',
  id: 'first',
  title: 'First Look',
  updatedAt: 1,
};

function createStoredEdit(source: StoredEdit['source'] = null): StoredEdit {
  return {
    grainSeed: 9876,
    history: {
      future: [],
      past: [],
      present: createEditHistory({ adjustments: { saturation: 35 } }).present,
    },
    savedAt: 1,
    source,
    sourceFileName: 'missing-source.jpg',
    version: 1,
  };
}

describe('browser storage', () => {
  it('uses an in-memory session adapter when persistent storage is unavailable', async () => {
    const storage = createMemoryStorage({ customLooks: [firstLook] });

    expect(await storage.listCustomLooks()).toEqual([firstLook]);

    const renamed = { ...firstLook, title: 'Renamed Look', updatedAt: 2 };
    await storage.saveCustomLook(renamed);
    expect((await storage.listCustomLooks())[0].title).toBe('Renamed Look');

    await storage.deleteCustomLook(firstLook.id);
    expect(await storage.listCustomLooks()).toEqual([]);

    const edit = createStoredEdit();
    await storage.saveLatestEdit(edit);
    expect(await storage.loadLatestEdit()).toMatchObject({
      grainSeed: 9876,
      source: null,
      sourceFileName: 'missing-source.jpg',
    });
  });

  it('normalizes a valid recovery record and rejects malformed records', () => {
    const edit = createStoredEdit();

    expect(normalizeStoredEdit(edit)).toMatchObject({
      source: null,
      sourceFileName: 'missing-source.jpg',
    });
    expect(normalizeStoredEdit({ ...edit, version: 2 })).toBeNull();
    expect(normalizeStoredEdit({ ...edit, history: { present: {} } })).toBeNull();
  });

  it('stores a Library handle and working copy separately from the v1 Edit record', async () => {
    const handle = {
      getDirectoryHandle: vi.fn(),
      getFileHandle: vi.fn(),
      name: 'June shoot',
    } as unknown as FileSystemDirectoryHandle;
    const recovery = {
      durableReference: { checksum: 'a'.repeat(64), revision: 1 },
      handle,
      lastOpenedAt: 10,
      libraryId: 'library-1',
      rootName: 'June shoot',
      status: 'saved' as const,
      working: createEmptyLibraryDocument('June shoot', {
        libraryId: 'library-1',
        now: 10,
      }),
    };
    const storage = createMemoryStorage();

    expect(normalizeStoredLibraryRecovery(recovery)).toMatchObject({
      libraryId: 'library-1',
      status: 'saved',
    });
    expect(
      normalizeStoredLibraryRecovery({
        ...recovery,
        libraryId: 'different-library',
      }),
    ).toBeNull();
    await storage.saveLibraryRecovery(recovery);
    expect(await storage.listLibraryRecoveries()).toMatchObject([
      { handle, libraryId: 'library-1', working: recovery.working },
    ]);

    await storage.deleteLibraryRecovery('library-1');
    await expect(storage.listLibraryRecoveries()).resolves.toEqual([]);
  });

  it('stores a Browser Library file without a serializable directory handle', async () => {
    const recovery = {
      accessMode: 'browser' as const,
      browserLibraryFile: new Uint8Array([1, 2, 3]),
      durableReference: { checksum: 'b'.repeat(64), revision: 2 },
      handle: null,
      lastOpenedAt: 20,
      libraryId: 'browser-library',
      rootName: 'Brave shoot',
      status: 'saved' as const,
      working: createEmptyLibraryDocument('Brave shoot', {
        libraryId: 'browser-library',
        now: 20,
      }),
    };
    const storage = createMemoryStorage();

    await storage.saveLibraryRecovery(recovery);
    await expect(storage.loadLibraryRecovery('browser-library')).resolves.toMatchObject({
      accessMode: 'browser',
      browserLibraryFile: new Uint8Array([1, 2, 3]),
      handle: null,
    });
  });

  it('explains that a failed storage adapter does not end the editing session', () => {
    expect(describeStorageError('failed')).toContain('browser storage failed');
    expect(describeStorageError('unavailable')).toContain('does not provide IndexedDB');
    expect(describeStorageError()).toContain('remain in memory');
    expect(createBrowserStorage(undefined)).toBeNull();
  });
});
