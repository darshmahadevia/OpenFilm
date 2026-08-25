import { createMemoryStorage, type StoredLibraryRecovery } from '../storage/browserStorage';
import { createLibraryFileEnvelope, serializeLibraryFile } from './libraryFile';
import {
  createMemoryLibraryFileStore,
  type LibraryFileStore,
  type MemoryLibraryFileStore,
} from './libraryFileStore';
import { createMemoryLibraryLock } from './libraryFilePersistence';
import { LibraryApplication } from './libraryApplication';
import { createEmptyLibraryDocument } from './libraryModel';
import type { LibraryDirectoryGateway } from './libraryGateway';

interface TestDirectory extends FileSystemDirectoryHandle {
  availability: 'available' | 'missing' | 'permission-denied';
  store: MemoryLibraryFileStore;
}

function createDirectory(name: string): TestDirectory {
  const getDirectoryHandle = vi.fn();
  const directory = {
    availability: 'available' as const,
    getDirectoryHandle,
    getFileHandle: vi.fn(),
    name,
    store: createMemoryLibraryFileStore(),
  } as unknown as TestDirectory;

  getDirectoryHandle.mockResolvedValue(directory);
  return directory;
}

function createGateway(picked: TestDirectory): LibraryDirectoryGateway {
  return {
    createFileStore(root) {
      return (root as TestDirectory).store as LibraryFileStore;
    },
    async getPermission(root) {
      return (root as TestDirectory).availability === 'permission-denied' ? 'denied' : 'granted';
    },
    async inspectRecentDirectory(root) {
      return (root as TestDirectory).availability;
    },
    async pickDirectory() {
      return picked;
    },
    async requestPermission(root) {
      (root as TestDirectory).availability = 'available';
      return 'granted';
    },
  };
}

function createApplication(directory = createDirectory('June shoot')) {
  const storage = createMemoryStorage();
  const app = new LibraryApplication(createGateway(directory), storage, {
    lock: createMemoryLibraryLock(),
    now: () => 100,
  });

  return { app, directory, storage };
}

describe('Library application boundary', () => {
  it('creates and reopens an empty Library through the sidecar without storing Source bytes', async () => {
    const { app, directory, storage } = createApplication();
    const opened = await app.openPickedFolder();

    expect(opened.kind).toBe('opened');

    if (opened.kind !== 'opened') {
      throw new Error('The test Library did not open.');
    }

    expect(opened.snapshot.status).toBe('saved');
    expect(opened.snapshot.library?.photographs).toEqual([]);
    expect(directory.store.bytes('library.json')).not.toBeNull();

    const recovery = await storage.loadLibraryRecovery(opened.snapshot.libraryId ?? '');
    expect(recovery).toMatchObject({
      status: 'saved',
      working: opened.snapshot.library,
    });
    expect(recovery).not.toHaveProperty('source');

    app.close();
    const reopened = await app.openRecentLibrary(opened.snapshot.libraryId ?? '');
    expect(reopened).toMatchObject({
      kind: 'opened',
      snapshot: { libraryId: opened.snapshot.libraryId, status: 'saved' },
    });
  });

  it('reports Ready, Reauthorize, Unsaved recovery, and Missing folder recent states', async () => {
    const { app, directory, storage } = createApplication();
    const opened = await app.openPickedFolder();

    if (opened.kind !== 'opened' || !opened.snapshot.library) {
      throw new Error('The test Library did not open.');
    }

    const recovery = await storage.loadLibraryRecovery(opened.snapshot.library.libraryId);

    if (!recovery) {
      throw new Error('The test Library recovery record was not written.');
    }

    await expect(app.listRecentLibraries()).resolves.toMatchObject([
      { libraryId: recovery.libraryId, status: 'ready' },
    ]);

    directory.availability = 'permission-denied';
    await expect(app.listRecentLibraries()).resolves.toMatchObject([
      { libraryId: recovery.libraryId, status: 'reauthorize' },
    ]);

    await expect(app.reauthorizeRecentLibrary(recovery.libraryId)).resolves.toMatchObject({
      kind: 'opened',
      snapshot: { libraryId: recovery.libraryId, status: 'saved' },
    });

    directory.availability = 'available';
    const unsavedRecovery: StoredLibraryRecovery = {
      ...recovery,
      status: 'unsaved',
      working: createEmptyLibraryDocument('June shoot', {
        libraryId: recovery.libraryId,
        now: 101,
      }),
    };
    await storage.saveLibraryRecovery(unsavedRecovery);
    await expect(app.listRecentLibraries()).resolves.toMatchObject([
      { libraryId: recovery.libraryId, status: 'unsaved-recovery' },
    ]);

    await storage.saveLibraryRecovery({
      ...unsavedRecovery,
      durableReference: { checksum: 'b'.repeat(64), revision: 1 },
    });
    await expect(app.listRecentLibraries()).resolves.toMatchObject([
      { libraryId: recovery.libraryId, status: 'read-only' },
    ]);
    await storage.saveLibraryRecovery(unsavedRecovery);

    directory.availability = 'missing';
    await expect(app.listRecentLibraries()).resolves.toMatchObject([
      { libraryId: recovery.libraryId, status: 'missing-folder' },
    ]);
  });

  it('keeps an invalid sidecar read-only instead of using the IndexedDB copy as authority', async () => {
    const directory = createDirectory('Corrupt shoot');
    const storage = createMemoryStorage();
    const app = new LibraryApplication(createGateway(directory), storage, {
      lock: createMemoryLibraryLock(),
      now: () => 100,
    });
    await directory.store.write('library.json', new TextEncoder().encode('{"not":"a Library"}'));

    const result = await app.openPickedFolder();

    expect(result.kind).toBe('read-only');

    if (result.kind === 'read-only') {
      expect(result.snapshot.status).toBe('read-only');
      expect(result.snapshot.library).toBeNull();
    }
  });

  it('reopens an unsaved working copy when the first sidecar write never created a file', async () => {
    const { app, directory, storage } = createApplication();
    const library = createEmptyLibraryDocument('June shoot', {
      libraryId: 'library-unsaved',
      now: 100,
    });

    await storage.saveLibraryRecovery({
      durableReference: null,
      handle: directory,
      lastOpenedAt: 100,
      libraryId: library.libraryId,
      rootName: library.rootName,
      status: 'unsaved',
      working: library,
    });

    await expect(app.listRecentLibraries()).resolves.toMatchObject([
      { libraryId: library.libraryId, status: 'unsaved-recovery' },
    ]);
    await expect(app.openRecentLibrary(library.libraryId)).resolves.toMatchObject({
      kind: 'opened',
      snapshot: { libraryId: library.libraryId, status: 'unsaved' },
    });
    await expect(app.retry()).resolves.toMatchObject({
      kind: 'updated',
      snapshot: { status: 'saved' },
    });
    expect(directory.store.bytes('library.json')).not.toBeNull();
  });

  it('marks a checksum-valid envelope with an invalid typed payload read-only in recents', async () => {
    const directory = createDirectory('Invalid payload shoot');
    const storage = createMemoryStorage();
    const app = new LibraryApplication(createGateway(directory), storage, {
      lock: createMemoryLibraryLock(),
      now: () => 100,
    });
    const envelope = await createLibraryFileEnvelope(
      { format: 'wrong.library', schemaVersion: 1 },
      1,
      null,
      { writtenAt: 100 },
    );

    await directory.store.write('library.json', serializeLibraryFile(envelope));
    await storage.saveLibraryRecovery({
      durableReference: { checksum: envelope.checksum, revision: envelope.revision },
      handle: directory,
      lastOpenedAt: 100,
      libraryId: 'library-invalid-payload',
      rootName: 'Invalid payload shoot',
      status: 'saved',
      working: createEmptyLibraryDocument('Invalid payload shoot', {
        libraryId: 'library-invalid-payload',
        now: 100,
      }),
    });

    await expect(app.listRecentLibraries()).resolves.toMatchObject([
      { libraryId: 'library-invalid-payload', status: 'read-only' },
    ]);
  });
});
