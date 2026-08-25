import { createMemoryLibraryFileStore, type MemoryLibraryFileStore } from './libraryFileStore';
import {
  createMemoryLibraryLock,
  LibraryFileCoordinator,
  LibraryFileSession,
  LIBRARY_COMMIT_PHASES,
  type LibraryCommitResult,
} from './libraryFilePersistence';
import {
  LIBRARY_AUTHORITATIVE_FILE,
  LIBRARY_PENDING_FILE,
  LIBRARY_PREVIOUS_FILE,
  type LibraryDocument,
  type LibraryRevisionReference,
} from './libraryFile';

const firstLibrary: LibraryDocument = {
  libraryId: 'library-1',
  photographs: [{ disposition: 'unmarked', id: 'photo-1', rating: null }],
  rootName: 'June shoot',
};

const secondLibrary: LibraryDocument = {
  ...firstLibrary,
  photographs: [{ disposition: 'pick', id: 'photo-1', rating: 4 }],
};

const thirdLibrary: LibraryDocument = {
  ...firstLibrary,
  photographs: [{ disposition: 'reject', id: 'photo-1', rating: 1 }],
};

function createCoordinator(
  store: MemoryLibraryFileStore,
  options: ConstructorParameters<typeof LibraryFileCoordinator>[1] = {},
): LibraryFileCoordinator {
  return new LibraryFileCoordinator(store, {
    lock: createMemoryLibraryLock(),
    now: () => 100,
    ...options,
  });
}

async function saveInitial(store: MemoryLibraryFileStore): Promise<LibraryRevisionReference> {
  const result = await createCoordinator(store).commit(firstLibrary, null);

  expect(result.status).toBe('saved');

  if (result.status !== 'saved') {
    throw new Error('The initial Library revision did not save.');
  }

  return { checksum: result.checksum, revision: result.revision };
}

function expectNoPartialRevision(result: LibraryCommitResult): void {
  expect(['saved', 'interrupted', 'failed', 'conflict', 'permission-denied']).toContain(
    result.status,
  );
  expect(result.status).not.toBe('saved');
}

describe('Library file commit protocol', () => {
  it('writes a versioned authoritative file and keeps no unverified candidate after save', async () => {
    const store = createMemoryLibraryFileStore();
    const result = await createCoordinator(store).commit(firstLibrary, null);

    expect(result).toMatchObject({ revision: 1, status: 'saved' });
    expect(store.bytes(LIBRARY_AUTHORITATIVE_FILE)).not.toBeNull();
    expect(store.bytes(LIBRARY_PREVIOUS_FILE)).toBeNull();
    expect(store.bytes(LIBRARY_PENDING_FILE)).toBeNull();

    const loaded = await createCoordinator(store).load();
    expect(loaded.status).toBe('saved');
    expect(loaded.revision?.library).toEqual(firstLibrary);
  });

  it('recovers a complete revision or the previous verified revision after interruption at every phase', async () => {
    for (const phase of LIBRARY_COMMIT_PHASES) {
      const store = createMemoryLibraryFileStore();
      const initialReference = await saveInitial(store);
      const interrupted = await createCoordinator(store, { interruptAt: phase }).commit(
        secondLibrary,
        initialReference,
      );

      expect(interrupted.status, phase).toBe('interrupted');

      const loaded = await createCoordinator(store).load();
      expect(loaded.status, phase).not.toBe('corrupt');
      expect(loaded.revision, phase).not.toBeNull();
      expect([1, 2], phase).toContain(loaded.revision?.revision);

      if (loaded.revision?.revision === 2) {
        expect(loaded.revision.library, phase).toEqual(secondLibrary);
      } else {
        expect(loaded.revision?.library, phase).toEqual(firstLibrary);
      }

      if (phase === 'authoritative-write-start') {
        expect(loaded.status, phase).toBe('recovered');
      }
    }
  });

  it('never reports Saved when the pending, previous, or authoritative write is truncated', async () => {
    const pendingStore = createMemoryLibraryFileStore();
    const pendingReference = await saveInitial(pendingStore);
    pendingStore.setFailure({
      fileName: LIBRARY_PENDING_FILE,
      mode: 'truncate-and-throw',
      operation: 'write',
    });

    const pendingResult = await createCoordinator(pendingStore).commit(
      secondLibrary,
      pendingReference,
    );
    expectNoPartialRevision(pendingResult);
    expect((await createCoordinator(pendingStore).load()).revision?.library).toEqual(firstLibrary);

    const previousStore = createMemoryLibraryFileStore();
    const previousReference = await saveInitial(previousStore);
    previousStore.setFailure({
      fileName: LIBRARY_PREVIOUS_FILE,
      mode: 'truncate-and-throw',
      operation: 'write',
    });

    const previousResult = await createCoordinator(previousStore).commit(
      secondLibrary,
      previousReference,
    );
    expectNoPartialRevision(previousResult);
    expect((await createCoordinator(previousStore).load()).revision?.library).toEqual(
      secondLibrary,
    );

    const authoritativeStore = createMemoryLibraryFileStore();
    const authoritativeReference = await saveInitial(authoritativeStore);
    authoritativeStore.setFailure({
      fileName: LIBRARY_AUTHORITATIVE_FILE,
      mode: 'truncate-and-throw',
      operation: 'write',
    });

    const authoritativeResult = await createCoordinator(authoritativeStore).commit(
      secondLibrary,
      authoritativeReference,
    );
    expectNoPartialRevision(authoritativeResult);
    const authoritativeRecovery = await createCoordinator(authoritativeStore).load();
    expect(authoritativeRecovery.status).toBe('recovered');
    expect(authoritativeRecovery.revision?.library).toEqual(secondLibrary);
  });

  it('requires write-then-read verification even when the write call resolves', async () => {
    const store = createMemoryLibraryFileStore();
    const reference = await saveInitial(store);
    store.setFailure({
      fileName: LIBRARY_AUTHORITATIVE_FILE,
      mode: 'corrupt-after-write',
      operation: 'write',
    });

    const result = await createCoordinator(store).commit(secondLibrary, reference);
    expectNoPartialRevision(result);

    const recovery = await createCoordinator(store).load();
    expect(recovery.status).toBe('recovered');
    expect(recovery.revision?.library).toEqual(secondLibrary);
    expect(recovery.durable?.library).toEqual(firstLibrary);
  });

  it('retries a verified pending revision idempotently and fails closed without Web Locks', async () => {
    const store = createMemoryLibraryFileStore();
    const reference = await saveInitial(store);
    store.setFailure({
      fileName: LIBRARY_AUTHORITATIVE_FILE,
      mode: 'corrupt-after-write',
      operation: 'write',
    });

    const failed = await createCoordinator(store).commit(secondLibrary, reference);
    expect(failed.status).toBe('failed');

    const retried = await createCoordinator(store).retry();
    expect(retried).toMatchObject({ revision: 2, status: 'saved' });

    const repeated = await createCoordinator(store).retry();
    expect(repeated.status).toBe('nothing-to-retry');
    expect((await createCoordinator(store).load()).revision?.library).toEqual(secondLibrary);

    const noLock = await new LibraryFileCoordinator(store, { lock: null }).commit(thirdLibrary, {
      checksum: retried.status === 'saved' ? retried.checksum : reference.checksum,
      revision: 2,
    });
    expect(noLock.status).toBe('coordination-unavailable');
  });

  it('detects a newer external revision and never merges competing tabs', async () => {
    const store = createMemoryLibraryFileStore();
    const initialReference = await saveInitial(store);
    const firstTab = createCoordinator(store);
    const secondTab = createCoordinator(store);

    const first = await firstTab.commit(secondLibrary, initialReference);
    expect(first.status).toBe('saved');

    const stale = await secondTab.commit(thirdLibrary, initialReference);
    expect(stale.status).toBe('conflict');
    expect((await createCoordinator(store).load()).revision?.library).toEqual(secondLibrary);

    const freshReference =
      first.status === 'saved'
        ? { checksum: first.checksum, revision: first.revision }
        : initialReference;
    const sharedLock = createMemoryLibraryLock();
    const [tabA, tabB] = await Promise.all([
      createCoordinator(store, { lock: sharedLock }).commit(firstLibrary, freshReference),
      createCoordinator(store, { lock: sharedLock }).commit(thirdLibrary, freshReference),
    ]);

    expect([tabA.status, tabB.status].sort()).toEqual(['conflict', 'saved']);
    expect((await createCoordinator(store).load()).revision?.revision).toBe(3);
  });

  it('makes permission loss, Retry, Save a copy, Revert, and mutation blocking explicit', async () => {
    const store = createMemoryLibraryFileStore();
    await saveInitial(store);
    const session = new LibraryFileSession(createCoordinator(store), {
      lock: createMemoryLibraryLock(),
      now: () => 200,
    });
    await session.open();

    store.setPermission('denied');
    const permissionResult = await session.save(secondLibrary);
    expect(permissionResult.status).toBe('permission-denied');
    expect(session.snapshot().status).toBe('read-only');

    const blocked = await session.save(thirdLibrary);
    expect(blocked.status).toBe('blocked-unsaved');

    const copyStore = createMemoryLibraryFileStore();
    const copyResult = await session.saveCopy(copyStore);
    expect(copyResult.status).toBe('saved-copy');
    expect((await createCoordinator(copyStore).load()).revision?.library).toEqual(secondLibrary);

    store.setPermission('granted');
    const retryResult = await session.retry();
    expect(retryResult.status).toBe('saved');
    expect((await createCoordinator(store).load()).revision?.library).toEqual(secondLibrary);

    store.setFailure({
      fileName: LIBRARY_AUTHORITATIVE_FILE,
      mode: 'corrupt-after-write',
      operation: 'write',
    });
    const failedResult = await session.save(thirdLibrary);
    expect(failedResult.status).toBe('failed');

    const reverted = await session.revert();
    expect(reverted).toMatchObject({ revision: 2, status: 'reverted' });
    expect(session.snapshot().status).toBe('saved');
    expect((await createCoordinator(store).load()).revision?.library).toEqual(secondLibrary);
  });
});
