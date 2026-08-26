import { createMemoryStorage, type StoredLibraryRecovery } from '../storage/browserStorage';
import {
  createLibraryFileEnvelope,
  serializeLibraryFile,
  verifySerializedLibraryFile,
} from './libraryFile';
import {
  createMemoryLibraryFileStore,
  type LibraryFileStore,
  type MemoryLibraryFileStore,
} from './libraryFileStore';
import { createMemoryLibraryLock } from './libraryFilePersistence';
import { LibraryApplication } from './libraryApplication';
import { createEmptyLibraryDocument } from './libraryModel';
import type { LibraryDirectoryGateway, LibrarySourceFile } from './libraryGateway';

interface TestDirectory extends FileSystemDirectoryHandle {
  availability: 'available' | 'missing' | 'permission-denied';
  store: MemoryLibraryFileStore;
  sourceFiles: LibrarySourceFile[];
}

function createDirectory(name: string): TestDirectory {
  const getDirectoryHandle = vi.fn();
  const directory = {
    availability: 'available' as const,
    getDirectoryHandle,
    getFileHandle: vi.fn(),
    name,
    store: createMemoryLibraryFileStore(),
    sourceFiles: [],
  } as unknown as TestDirectory;

  getDirectoryHandle.mockResolvedValue(directory);
  return directory;
}

interface TestBrowserDirectory extends FileSystemDirectoryHandle {
  openfilmBrowserDirectory: true;
  sourceFiles: Map<string, File>;
  store: MemoryLibraryFileStore;
}

function createBrowserDirectory(name: string, sources: LibrarySourceFile[]): TestBrowserDirectory {
  return {
    kind: 'directory',
    name,
    openfilmBrowserDirectory: true,
    sourceFiles: new Map(sources.map((source) => [source.relativePath, source.file])),
    store: createMemoryLibraryFileStore(),
  } as unknown as TestBrowserDirectory;
}

function createBrowserGateway(picked: TestBrowserDirectory): LibraryDirectoryGateway {
  return {
    createFileStore(root) {
      return (root as TestBrowserDirectory).store;
    },
    async getPermission() {
      return 'granted';
    },
    async inspectRecentDirectory() {
      return 'available';
    },
    async pickDirectory() {
      return picked;
    },
    async readSourcePhotograph(root, relativePath) {
      const file = (root as TestBrowserDirectory).sourceFiles.get(relativePath);
      if (!file) throw new Error(`Missing Source photograph: ${relativePath}`);
      return file;
    },
    async requestPermission() {
      return 'granted';
    },
    async *scanSourceFiles(root) {
      for (const [relativePath, file] of (root as TestBrowserDirectory).sourceFiles) {
        yield { file, relativePath };
      }
    },
  };
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
    async readSourcePhotograph(root, relativePath) {
      const source = (root as TestDirectory).sourceFiles.find(
        (candidate) => candidate.relativePath === relativePath,
      );

      if (!source) {
        throw new Error(`Missing Source photograph: ${relativePath}`);
      }

      return source.file;
    },
    async requestPermission(root) {
      (root as TestDirectory).availability = 'available';
      return 'granted';
    },
    async *scanSourceFiles(root) {
      yield* (root as TestDirectory).sourceFiles;
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
    expect(opened.created).toBe(true);
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
      created: false,
      kind: 'opened',
      snapshot: { libraryId: opened.snapshot.libraryId, status: 'saved' },
    });
  });

  it('restores a Browser Library after the user chooses the same folder again', async () => {
    const source = new File(['jpeg bytes'], 'first.jpg', {
      lastModified: 100,
      type: 'image/jpeg',
    });
    const sources = [{ file: source, relativePath: 'first.jpg' }];
    const storage = createMemoryStorage();
    const firstDirectory = createBrowserDirectory('June shoot', sources);
    const firstApp = new LibraryApplication(createBrowserGateway(firstDirectory), storage, {
      lock: createMemoryLibraryLock(),
      now: () => 100,
    });

    const opened = await firstApp.openPickedFolder();
    await firstApp.scanLibrary();
    const libraryId = firstApp.snapshot()?.libraryId;
    const photographId = firstApp.snapshot()?.library?.photographs[0]?.id;

    expect(opened.kind).toBe('opened');
    expect(libraryId).toBeTruthy();
    await expect(storage.loadLibraryRecovery(libraryId!)).resolves.toMatchObject({
      accessMode: 'browser',
      handle: null,
      status: 'saved',
    });
    await expect(firstApp.listRecentLibraries()).resolves.toMatchObject([
      { libraryId, status: 'choose-folder' },
    ]);

    firstApp.close();
    const secondDirectory = createBrowserDirectory('June shoot', sources);
    const secondApp = new LibraryApplication(createBrowserGateway(secondDirectory), storage, {
      lock: createMemoryLibraryLock(),
      now: () => 200,
    });
    const reopened = await secondApp.openPickedFolder();

    expect(reopened).toMatchObject({
      created: false,
      kind: 'opened',
      snapshot: { libraryId, status: 'saved' },
    });
    expect(secondApp.snapshot()?.library?.photographs[0]?.id).toBe(photographId);

    secondApp.close();
    const changedSources = [
      {
        file: new File(['changed jpeg bytes'], 'first.jpg', {
          lastModified: 400,
          type: 'image/jpeg',
        }),
        relativePath: 'first.jpg',
      },
    ];
    const thirdDirectory = createBrowserDirectory('June shoot', changedSources);
    const thirdApp = new LibraryApplication(createBrowserGateway(thirdDirectory), storage, {
      lock: createMemoryLibraryLock(),
      now: () => 300,
    });
    await expect(thirdApp.reauthorizeRecentLibrary(libraryId!)).resolves.toMatchObject({
      kind: 'opened',
      snapshot: { libraryId, status: 'saved' },
    });
  });

  it('downloads and imports a verified Browser Library backup', async () => {
    const { app } = createApplication();
    const opened = await app.openPickedFolder();
    if (opened.kind !== 'opened') throw new Error('The test Library did not open.');

    const backup = app.downloadLibraryBackup();
    const importedStorage = createMemoryStorage();
    const importedApp = new LibraryApplication(
      createGateway(createDirectory('Unused folder')),
      importedStorage,
      { lock: createMemoryLibraryLock(), now: () => 200 },
    );

    await expect(importedApp.importBrowserLibraryBackup(backup.bytes)).resolves.toMatch(
      /Choose its Source folder/,
    );
    await expect(
      importedStorage.loadLibraryRecovery(opened.snapshot.libraryId!),
    ).resolves.toMatchObject({
      accessMode: 'browser',
      durableReference: opened.snapshot.revision,
      handle: null,
      working: opened.snapshot.library,
    });
  });

  it('progressively scans Source photographs and commits Photograph records through the sidecar', async () => {
    const { app, directory } = createApplication();
    directory.sourceFiles = [
      {
        file: new File(['png bytes'], 'second.png', {
          lastModified: 200,
          type: 'image/png',
        }),
        relativePath: 'nested/second.png',
      },
      {
        file: new File(['jpeg bytes'], 'first.jpg', {
          lastModified: 100,
          type: 'image/jpeg',
        }),
        relativePath: 'first.jpg',
      },
      {
        file: new File(['raw bytes'], 'camera.cr3', {
          lastModified: 300,
          type: 'application/octet-stream',
        }),
        relativePath: 'camera.cr3',
      },
    ];

    const opened = await app.openPickedFolder();
    const updates: string[] = [];
    const result = await app.scanLibrary((snapshot) => updates.push(snapshot.scan.status));

    expect(opened.kind).toBe('opened');
    expect(result).toMatchObject({
      progress: {
        discoveredFiles: 3,
        supportedFiles: 2,
        unsupportedFiles: 1,
      },
      status: 'complete',
    });
    expect(updates).toContain('scanning');
    expect(updates.at(-1)).toBe('complete');
    expect(app.snapshot()).toMatchObject({
      scan: { status: 'complete' },
      status: 'saved',
    });
    expect(app.snapshot()?.library?.photographs).toHaveLength(2);
    expect(app.snapshot()?.library?.photographs[0]).toMatchObject({
      fingerprint: { byteSize: 10, lastModified: 100 },
      relativePath: 'first.jpg',
      sourceState: 'available',
    });

    const savedBytes = directory.store.bytes('library.json');

    if (!savedBytes) {
      throw new Error('The scanned Library sidecar was not written.');
    }

    const envelope = await verifySerializedLibraryFile(savedBytes);
    expect(envelope.revision).toBe(2);
    expect(envelope.library).not.toHaveProperty('source');
    expect(envelope.library.photographs).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ blob: expect.anything() })]),
    );
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

  it('commits one whole Library command and undoes or redoes it as one durable revision', async () => {
    const { app, directory } = createApplication();
    await app.openPickedFolder();

    await expect(
      app.commitCommand((document) => ({ ...document, reviewNote: 'first pass' }), 'Saved review.'),
    ).resolves.toMatchObject({ kind: 'updated', snapshot: { status: 'saved' } });
    expect(app.snapshot()?.library).toHaveProperty('reviewNote', 'first pass');
    expect(app.historyStatus()).toEqual({ canRedo: false, canUndo: true });

    await expect(app.undo()).resolves.toMatchObject({ kind: 'updated' });
    expect(app.snapshot()?.library).not.toHaveProperty('reviewNote');
    expect(app.historyStatus()).toEqual({ canRedo: true, canUndo: false });

    await expect(app.redo()).resolves.toMatchObject({ kind: 'updated' });
    expect(app.snapshot()?.library).toHaveProperty('reviewNote', 'first pass');

    const bytes = directory.store.bytes('library.json');
    expect(bytes).not.toBeNull();
    await expect(verifySerializedLibraryFile(bytes!)).resolves.toMatchObject({ revision: 4 });
  });

  it('serializes rapid undo and redo behind the durable command queue', async () => {
    const { app } = createApplication();
    await app.openPickedFolder();
    await app.commitCommand((document) => ({ ...document, reviewNote: 'queued' }), 'Saved review.');

    const undo = app.undo();
    const redo = app.redo();
    await expect(undo).resolves.toMatchObject({ kind: 'updated' });
    await expect(redo).resolves.toMatchObject({ kind: 'updated' });
    expect(app.snapshot()?.library).toHaveProperty('reviewNote', 'queued');
  });

  it('renders Export work through the application scheduler boundary', async () => {
    const directory = createDirectory('Export shoot');
    directory.sourceFiles = [
      {
        file: new File(['source'], 'frame.jpg', { type: 'image/jpeg' }),
        relativePath: 'frame.jpg',
      },
    ];
    const renderExport = vi.fn(async () => new Blob(['rendered'], { type: 'image/jpeg' }));
    const app = new LibraryApplication(createGateway(directory), createMemoryStorage(), {
      lock: createMemoryLibraryLock(),
      now: () => 100,
      renderExport,
    });
    await app.openPickedFolder();

    await expect(
      app.renderExportPhotograph(
        {
          cameraSerial: null,
          captureTime: null,
          disposition: 'pick',
          fileName: 'frame.jpg',
          fingerprint: { byteSize: 6, lastModified: 0 },
          id: 'frame',
          mimeType: 'image/jpeg',
          orientation: null,
          rating: null,
          relativePath: 'frame.jpg',
          sourceState: 'available',
        },
        { format: 'jpeg', quality: 0.9 },
      ),
    ).resolves.toBeInstanceOf(Blob);
    expect(renderExport).toHaveBeenCalledOnce();
    expect(app.resourceStatus()?.fullResolutionReads).toBe(1);
  });

  it('reuses Grid derivatives under an observable byte budget and releases them on close', async () => {
    const directory = createDirectory('Cached shoot');
    directory.sourceFiles = [
      {
        file: new File(['source'], 'frame.jpg', { type: 'image/jpeg' }),
        relativePath: 'frame.jpg',
      },
    ];
    const gateway = createGateway(directory);
    const readSource = vi.spyOn(gateway, 'readSourcePhotograph');
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cached');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const app = new LibraryApplication(gateway, createMemoryStorage(), {
      lock: createMemoryLibraryLock(),
      now: () => 100,
    });
    await app.openPickedFolder();

    await app.loadLibraryThumbnail('frame.jpg', 640);
    await app.loadLibraryThumbnail('frame.jpg', 640);

    expect(readSource).toHaveBeenCalledOnce();
    expect(app.resourceStatus()?.thumbnailCache).toMatchObject({ count: 1, bytes: 6 });
    app.close();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:cached');
    createObjectUrl.mockRestore();
    revokeObjectUrl.mockRestore();
  });

  it('blocks another command while a failed command waits for Retry', async () => {
    const { app, directory } = createApplication();
    await app.openPickedFolder();
    directory.store.setFailure({
      fileName: 'library.pending.json',
      mode: 'throw',
      operation: 'write',
    });

    await expect(
      app.commitCommand((document) => ({ ...document, reviewNote: 'recover me' }), 'Saved review.'),
    ).resolves.toMatchObject({ kind: 'updated', snapshot: { status: 'unsaved' } });
    await expect(
      app.commitCommand((document) => ({ ...document, later: true }), 'Saved later command.'),
    ).resolves.toMatchObject({ kind: 'failed', message: expect.stringContaining('Unsaved') });
    await expect(app.retry()).resolves.toMatchObject({
      kind: 'updated',
      snapshot: { status: 'saved' },
    });
    expect(app.snapshot()?.library).toHaveProperty('reviewNote', 'recover me');
  });
});
