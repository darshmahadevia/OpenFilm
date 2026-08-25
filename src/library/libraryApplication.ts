import {
  getLibraryRevisionReference,
  sameLibraryRevision,
  type LibraryDocument,
  type LibraryRevisionReference,
} from './libraryFile';
import {
  createBrowserLibraryLock,
  LibraryFileCoordinator,
  LibraryFileSession,
  type LibraryLock,
  type LibraryCommitResult,
  type LibraryLoadResult,
  type LibrarySessionActionResult,
} from './libraryFilePersistence';
import {
  createEmptyLibraryDocument,
  isOpenFilmLibraryDocument,
  type OpenFilmLibraryDocument,
} from './libraryModel';
import {
  LibraryGatewayError,
  LibraryPickerCancelledError,
  type LibraryDirectoryAvailability,
  type LibraryDirectoryGateway,
} from './libraryGateway';
import type {
  BrowserStorage,
  StoredLibraryRecovery,
  StoredLibraryStatus,
} from '../storage/browserStorage';

export type RecentLibraryStatus =
  'missing-folder' | 'reauthorize' | 'read-only' | 'ready' | 'unsaved-recovery';

export interface RecentLibraryEntry {
  lastOpenedAt: number;
  libraryId: string;
  rootName: string;
  status: RecentLibraryStatus;
}

export type LibraryWorkspaceStatus = 'read-only' | 'saved' | 'saving' | 'unsaved';

export interface LibraryWorkspaceSnapshot {
  library: OpenFilmLibraryDocument | null;
  libraryId: string | null;
  message: string;
  revision: LibraryRevisionReference | null;
  rootName: string;
  status: LibraryWorkspaceStatus;
}

export type LibraryOpenResult =
  | { kind: 'cancelled' }
  | { kind: 'missing-folder'; libraryId: string; rootName: string }
  | { kind: 'opened'; snapshot: LibraryWorkspaceSnapshot }
  | { kind: 'reauthorize'; libraryId: string; rootName: string; message: string }
  | { kind: 'read-only'; snapshot: LibraryWorkspaceSnapshot };

export type LibraryActionResult =
  | { kind: 'updated'; snapshot: LibraryWorkspaceSnapshot }
  | { kind: 'reauthorize'; message: string }
  | { kind: 'saved-copy'; message: string }
  | { kind: 'failed'; message: string };

interface ActiveLibrary {
  handle: FileSystemDirectoryHandle;
  libraryId: string;
  pendingFromIndexedDb: boolean;
  rootName: string;
  session: LibraryFileSession;
  snapshot: LibraryWorkspaceSnapshot;
}

interface LibraryApplicationOptions {
  lock?: LibraryLock | null;
  now?: () => number;
}

function asOpenFilmLibraryDocument(value: LibraryDocument | null): OpenFilmLibraryDocument | null {
  return isOpenFilmLibraryDocument(value) ? value : null;
}

function describeLoadFailure(result: LibraryLoadResult): string {
  if (result.status === 'permission-denied') {
    return 'OpenFilm no longer has permission to read this Library folder. Reauthorize it to continue.';
  }

  if (result.status === 'conflict') {
    return result.message;
  }

  if (result.status === 'corrupt') {
    return result.message;
  }

  return result.message;
}

function describeCommitFailure(result: LibraryCommitResult): string {
  return 'message' in result ? result.message : 'OpenFilm could not save this Library.';
}

function describeActionFailure(result: LibraryCommitResult | LibrarySessionActionResult): string {
  return 'message' in result ? result.message : 'OpenFilm could not complete that Library action.';
}

function describeStoredStatus(status: StoredLibraryStatus): RecentLibraryStatus {
  if (status === 'unsaved') {
    return 'unsaved-recovery';
  }

  if (status === 'read-only') {
    return 'read-only';
  }

  return 'ready';
}

export class LibraryApplication {
  private active: ActiveLibrary | null = null;
  private readonly lock: LibraryLock | null;
  private readonly now: () => number;

  constructor(
    private readonly gateway: LibraryDirectoryGateway,
    private readonly storage: BrowserStorage,
    options: LibraryApplicationOptions = {},
  ) {
    this.lock = options.lock === undefined ? createBrowserLibraryLock() : options.lock;
    this.now = options.now ?? (() => Date.now());
  }

  snapshot(): LibraryWorkspaceSnapshot | null {
    return this.active?.snapshot ?? null;
  }

  async listRecentLibraries(): Promise<RecentLibraryEntry[]> {
    const stored = await this.storage.listLibraryRecoveries();

    return await Promise.all(
      stored.map(async (recovery) => {
        let status: RecentLibraryStatus;

        try {
          status = await this.getRecentStatus(recovery);
        } catch {
          status = 'read-only';
        }

        return {
          lastOpenedAt: recovery.lastOpenedAt,
          libraryId: recovery.libraryId,
          rootName: recovery.rootName,
          status,
        };
      }),
    );
  }

  async openPickedFolder(): Promise<LibraryOpenResult> {
    try {
      const root = await this.gateway.pickDirectory();
      return await this.openRoot(root, null, true);
    } catch (error) {
      if (error instanceof LibraryGatewayError && error.kind === 'permission-denied') {
        return {
          kind: 'reauthorize',
          libraryId: '',
          message: error.message,
          rootName: 'Selected folder',
        };
      }

      if (error instanceof LibraryPickerCancelledError) {
        return { kind: 'cancelled' };
      }

      throw error;
    }
  }

  async openRecentLibrary(libraryId: string): Promise<LibraryOpenResult> {
    const recovery = await this.storage.loadLibraryRecovery(libraryId);

    if (!recovery) {
      return {
        kind: 'missing-folder',
        libraryId,
        rootName: 'Library',
      };
    }

    const availability = await this.gateway.inspectRecentDirectory(recovery.handle);

    if (availability === 'permission-denied') {
      return {
        kind: 'reauthorize',
        libraryId: recovery.libraryId,
        message: 'This Library needs permission again before OpenFilm can read it.',
        rootName: recovery.rootName,
      };
    }

    if (availability === 'missing') {
      return {
        kind: 'missing-folder',
        libraryId: recovery.libraryId,
        rootName: recovery.rootName,
      };
    }

    return await this.openRoot(recovery.handle, recovery, false);
  }

  async reauthorizeRecentLibrary(libraryId: string): Promise<LibraryOpenResult> {
    const recovery = await this.storage.loadLibraryRecovery(libraryId);

    if (!recovery) {
      return {
        kind: 'missing-folder',
        libraryId,
        rootName: 'Library',
      };
    }

    const permission = await this.gateway.requestPermission(recovery.handle);

    if (permission !== 'granted') {
      return {
        kind: 'reauthorize',
        libraryId: recovery.libraryId,
        message: 'OpenFilm still needs permission to read and save this Library.',
        rootName: recovery.rootName,
      };
    }

    return await this.openRecentLibrary(libraryId);
  }

  async retry(): Promise<LibraryActionResult> {
    const active = this.active;

    if (!active || active.snapshot.status === 'saved' || !active.snapshot.library) {
      return { kind: 'failed', message: 'There is no Unsaved Library command to retry.' };
    }

    const result = active.pendingFromIndexedDb
      ? await active.session.save(active.snapshot.library as OpenFilmLibraryDocument)
      : await active.session.retry();

    return await this.applySessionAction(result);
  }

  async saveCopy(): Promise<LibraryActionResult> {
    const active = this.active;

    if (!active?.snapshot.library) {
      return { kind: 'failed', message: 'There is no current Library state to save as a copy.' };
    }

    try {
      const destination = await this.gateway.pickDirectory();
      const result = await active.session.saveCopy(this.gateway.createFileStore(destination));

      if (result.status !== 'saved-copy') {
        return { kind: 'failed', message: describeCommitFailure(result) };
      }

      return {
        kind: 'saved-copy',
        message: `Saved a copy of ${active.rootName} to the selected folder. The original Library remains Unsaved until it is retried or reverted.`,
      };
    } catch (error) {
      return {
        kind: 'failed',
        message: error instanceof Error ? error.message : 'OpenFilm could not save a Library copy.',
      };
    }
  }

  async revert(): Promise<LibraryActionResult> {
    const active = this.active;

    if (!active) {
      return { kind: 'failed', message: 'There is no open Library to revert.' };
    }

    const result = await active.session.revert();

    if (result.status === 'reverted') {
      active.pendingFromIndexedDb = false;
      active.snapshot = {
        library: asOpenFilmLibraryDocument(result.library),
        libraryId: active.libraryId,
        message: `Reverted to Library revision ${result.revision}.`,
        revision: getLibraryRevisionReference(active.session.snapshot().durable),
        rootName: active.rootName,
        status: 'saved',
      };
      await this.persistActive();
      return { kind: 'updated', snapshot: active.snapshot };
    }

    if ('message' in result) {
      return { kind: 'failed', message: result.message };
    }

    return { kind: 'failed', message: describeLoadFailure(result) };
  }

  close(): void {
    this.active = null;
  }

  private async openRoot(
    root: FileSystemDirectoryHandle,
    recovery: StoredLibraryRecovery | null,
    createWhenEmpty: boolean,
  ): Promise<LibraryOpenResult> {
    const rootName = root.name || recovery?.rootName || 'Untitled Library';
    const coordinator = new LibraryFileCoordinator(this.gateway.createFileStore(root), {
      lock: this.lock,
      now: this.now,
    });
    const session = new LibraryFileSession(coordinator);
    const loaded = await session.open();

    if (
      loaded.status === 'empty' &&
      !createWhenEmpty &&
      !(recovery?.status === 'unsaved' && isOpenFilmLibraryDocument(recovery.working))
    ) {
      return {
        kind: 'missing-folder',
        libraryId: recovery?.libraryId ?? '',
        rootName,
      };
    }

    if (loaded.status === 'empty') {
      if (
        recovery?.status === 'unsaved' &&
        isOpenFilmLibraryDocument(recovery.working) &&
        sameLibraryRevision(recovery.durableReference, null)
      ) {
        const snapshot = this.createSnapshot(
          recovery.working,
          rootName,
          session,
          'unsaved',
          'OpenFilm recovered a working Library copy from browser storage. Retry, Save a copy, or Revert before making another change.',
        );
        await this.activate(root, session, snapshot, true);
        return { kind: 'opened', snapshot };
      }

      if (!createWhenEmpty) {
        return {
          kind: 'missing-folder',
          libraryId: recovery?.libraryId ?? '',
          rootName,
        };
      }

      const emptyLibrary = createEmptyLibraryDocument(rootName, { now: this.now() });
      const saved = await session.save(emptyLibrary);

      if (saved.status !== 'saved') {
        const snapshot = this.createSnapshot(
          emptyLibrary,
          rootName,
          session,
          saved.status === 'permission-denied' || saved.status === 'coordination-unavailable'
            ? 'read-only'
            : 'unsaved',
          describeCommitFailure(saved),
        );
        await this.activate(root, session, snapshot, false);
        return snapshot.status === 'read-only'
          ? { kind: 'read-only', snapshot }
          : { kind: 'opened', snapshot };
      }

      const snapshot = this.createSnapshot(
        emptyLibrary,
        rootName,
        session,
        'saved',
        'The Library is Saved.',
      );
      await this.activate(root, session, snapshot, false);
      return { kind: 'opened', snapshot };
    }

    const loadedLibrary = asOpenFilmLibraryDocument(loaded.revision?.library ?? null);

    if (!loadedLibrary) {
      const snapshot = this.createSnapshot(
        recovery ? recovery.working : null,
        rootName,
        session,
        'read-only',
        'OpenFilm could not validate the Library file. It is read-only until the file is repaired.',
      );
      await this.activate(root, session, snapshot, false);
      return { kind: 'read-only', snapshot };
    }

    const indexedDbRecovery =
      recovery?.status === 'unsaved' && isOpenFilmLibraryDocument(recovery.working)
        ? recovery.working
        : null;

    if (
      indexedDbRecovery &&
      (!sameLibraryRevision(
        recovery?.durableReference ?? null,
        getLibraryRevisionReference(loaded.durable),
      ) ||
        recovery?.libraryId !== loadedLibrary.libraryId)
    ) {
      const snapshot = this.createSnapshot(
        indexedDbRecovery,
        rootName,
        session,
        'read-only',
        'This browser recovery belongs to a different durable Library revision. OpenFilm kept it read-only instead of replacing the current Library file.',
      );
      await this.activate(root, session, snapshot, false);
      return { kind: 'read-only', snapshot };
    }

    const working = indexedDbRecovery ?? loadedLibrary;
    const status: LibraryWorkspaceStatus =
      loaded.status === 'recovered' || indexedDbRecovery
        ? 'unsaved'
        : loaded.status === 'saved'
          ? 'saved'
          : 'read-only';
    const message =
      status === 'unsaved'
        ? indexedDbRecovery
          ? 'OpenFilm recovered a working Library copy from browser storage. Retry, Save a copy, or Revert before making another change.'
          : loaded.message
        : status === 'saved'
          ? loaded.message
          : describeLoadFailure(loaded);
    const snapshot = this.createSnapshot(working, rootName, session, status, message);
    await this.activate(root, session, snapshot, Boolean(indexedDbRecovery));

    if (status === 'read-only') {
      return { kind: 'read-only', snapshot };
    }

    return { kind: 'opened', snapshot };
  }

  private createSnapshot(
    library: OpenFilmLibraryDocument | null,
    rootName: string,
    session: LibraryFileSession,
    status: LibraryWorkspaceStatus,
    message: string,
  ): LibraryWorkspaceSnapshot {
    const durable = session.snapshot().durable;

    return {
      library,
      libraryId: library?.libraryId ?? null,
      message,
      revision: getLibraryRevisionReference(durable),
      rootName,
      status,
    };
  }

  private async activate(
    handle: FileSystemDirectoryHandle,
    session: LibraryFileSession,
    snapshot: LibraryWorkspaceSnapshot,
    pendingFromIndexedDb: boolean,
  ): Promise<void> {
    this.active = {
      handle,
      libraryId: snapshot.libraryId ?? `unknown-${this.now()}`,
      pendingFromIndexedDb,
      rootName: snapshot.rootName,
      session,
      snapshot,
    };
    await this.persistActive();
  }

  private async applySessionAction(
    result: LibrarySessionActionResult | LibraryCommitResult,
  ): Promise<LibraryActionResult> {
    const active = this.active;

    if (!active) {
      return { kind: 'failed', message: 'There is no open Library session.' };
    }

    if (result.status === 'saved') {
      active.pendingFromIndexedDb = false;
      const library = asOpenFilmLibraryDocument(active.session.snapshot().working);
      active.snapshot = this.createSnapshot(
        library,
        active.rootName,
        active.session,
        'saved',
        'The Library is Saved.',
      );
      await this.persistActive();
      return { kind: 'updated', snapshot: active.snapshot };
    }

    if (result.status === 'saved-copy') {
      return { kind: 'saved-copy', message: 'Saved a copy of the current Library.' };
    }

    const library = asOpenFilmLibraryDocument(active.session.snapshot().working);
    const status: LibraryWorkspaceStatus =
      result.status === 'permission-denied' || result.status === 'coordination-unavailable'
        ? 'read-only'
        : 'unsaved';
    active.snapshot = this.createSnapshot(
      library,
      active.rootName,
      active.session,
      status,
      describeActionFailure(result),
    );
    await this.persistActive();

    return status === 'read-only'
      ? { kind: 'reauthorize', message: active.snapshot.message }
      : { kind: 'updated', snapshot: active.snapshot };
  }

  private async persistActive(): Promise<void> {
    const active = this.active;

    if (!active?.snapshot.library) {
      return;
    }

    const durable = active.session.snapshot().durable;
    const recovery: StoredLibraryRecovery = {
      durableReference: getLibraryRevisionReference(durable),
      handle: active.handle,
      lastOpenedAt: this.now(),
      libraryId: active.snapshot.library.libraryId,
      rootName: active.rootName,
      status: this.toStoredStatus(active.snapshot.status),
      working: active.snapshot.library,
    };

    await this.storage.saveLibraryRecovery(recovery);
  }

  private toStoredStatus(status: LibraryWorkspaceStatus): StoredLibraryStatus {
    return status === 'saving' ? 'unsaved' : status;
  }

  private async getRecentStatus(recovery: StoredLibraryRecovery): Promise<RecentLibraryStatus> {
    const availability: LibraryDirectoryAvailability = await this.gateway.inspectRecentDirectory(
      recovery.handle,
    );

    if (availability === 'missing') {
      return 'missing-folder';
    }

    if (availability === 'permission-denied') {
      return 'reauthorize';
    }

    const coordinator = new LibraryFileCoordinator(this.gateway.createFileStore(recovery.handle), {
      lock: this.lock,
      now: this.now,
    });
    const loaded = await coordinator.load();

    if (loaded.status === 'permission-denied') {
      return 'reauthorize';
    }

    if (loaded.status === 'empty') {
      if (recovery.status === 'unsaved' && sameLibraryRevision(recovery.durableReference, null)) {
        return 'unsaved-recovery';
      }

      return recovery.status === 'read-only' ? 'read-only' : 'missing-folder';
    }

    if (!isOpenFilmLibraryDocument(loaded.revision?.library)) {
      return 'read-only';
    }

    if (loaded.status === 'corrupt' || loaded.status === 'conflict') {
      return 'read-only';
    }

    if (recovery.status === 'unsaved') {
      return sameLibraryRevision(
        recovery.durableReference,
        getLibraryRevisionReference(loaded.durable),
      ) && recovery.libraryId === loaded.revision.library.libraryId
        ? 'unsaved-recovery'
        : 'read-only';
    }

    if (loaded.status === 'recovered') {
      return 'unsaved-recovery';
    }

    return describeStoredStatus(recovery.status);
  }
}
