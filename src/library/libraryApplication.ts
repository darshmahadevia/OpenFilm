import {
  getLibraryRevisionReference,
  sameLibraryRevision,
  serializeLibraryFile,
  verifySerializedLibraryFile,
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
  cloneOpenFilmLibraryDocument,
  createEmptyLibraryDocument,
  isOpenFilmLibraryDocument,
  type OpenFilmLibraryDocument,
} from './libraryModel';
import {
  createIdleLibraryScanState,
  scanLibraryFolder,
  type LibraryScanResult,
  type LibraryScanState,
} from './libraryScanner';
import { createLibraryGridThumbnail, type LibraryThumbnail } from './libraryThumbnail';
import { createLibraryWorkScheduler, type LibraryWorkScheduler } from './libraryScheduler';
import { renderLibraryPhotograph } from './libraryRenderedExport';
import {
  createFinalSetExport,
  type FinalSetExport,
  type FinalSetExportFolder,
} from './libraryFinalSetExport';
import { ByteBudgetedResourceCache } from './libraryResourceCache';
import {
  countBrowserLibrarySourceMatches,
  getBrowserLibraryFile,
  isBrowserLibraryDirectory,
  LibraryGatewayError,
  LibraryPickerCancelledError,
  restoreBrowserLibraryFile,
  type LibraryDirectoryAvailability,
  type LibraryDirectoryGateway,
} from './libraryGateway';
import type {
  BrowserStorage,
  StoredLibraryRecovery,
  StoredLibraryStatus,
} from '../storage/browserStorage';

export type RecentLibraryStatus =
  'choose-folder' | 'missing-folder' | 'reauthorize' | 'read-only' | 'ready' | 'unsaved-recovery';

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
  scan: LibraryScanState;
  status: LibraryWorkspaceStatus;
}

export type LibraryOpenResult =
  | { kind: 'cancelled' }
  | { kind: 'missing-folder'; libraryId: string; rootName: string }
  | { created: boolean; kind: 'opened'; snapshot: LibraryWorkspaceSnapshot }
  | { kind: 'reauthorize'; libraryId: string; rootName: string; message: string }
  | { kind: 'read-only'; snapshot: LibraryWorkspaceSnapshot };

export type LibraryActionResult =
  | { kind: 'updated'; snapshot: LibraryWorkspaceSnapshot }
  | { kind: 'reauthorize'; message: string }
  | { kind: 'saved-copy'; message: string }
  | { kind: 'failed'; message: string };

interface ActiveLibrary {
  finalSetExport: FinalSetExport | null;
  fullResolutionReads: number;
  fullResolutionTail: Promise<unknown>;
  handle: FileSystemDirectoryHandle;
  libraryId: string;
  pendingFromIndexedDb: boolean;
  rootName: string;
  scanAbortController: AbortController | null;
  scanPromise: Promise<LibraryScanResult> | null;
  session: LibraryFileSession;
  snapshot: LibraryWorkspaceSnapshot;
  thumbnailCache: ByteBudgetedResourceCache<LibraryThumbnail>;
  workScheduler: LibraryWorkScheduler;
}

interface LibraryApplicationOptions {
  lock?: LibraryLock | null;
  now?: () => number;
  renderExport?: typeof renderLibraryPhotograph;
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

const LIBRARY_HISTORY_LIMIT = 50;

export class LibraryApplication {
  private active: ActiveLibrary | null = null;
  private readonly undoStack: OpenFilmLibraryDocument[] = [];
  private readonly redoStack: OpenFilmLibraryDocument[] = [];
  private pendingUndoSnapshot: OpenFilmLibraryDocument | null = null;
  private commandTail: Promise<unknown> = Promise.resolve();
  private readonly lock: LibraryLock | null;
  private readonly now: () => number;
  private readonly renderExport: typeof renderLibraryPhotograph;

  constructor(
    private readonly gateway: LibraryDirectoryGateway,
    private readonly storage: BrowserStorage,
    options: LibraryApplicationOptions = {},
  ) {
    this.lock = options.lock === undefined ? createBrowserLibraryLock() : options.lock;
    this.now = options.now ?? (() => Date.now());
    this.renderExport = options.renderExport ?? renderLibraryPhotograph;
  }

  snapshot(): LibraryWorkspaceSnapshot | null {
    return this.active?.snapshot ?? null;
  }

  historyStatus(): { canRedo: boolean; canUndo: boolean } {
    return { canRedo: this.redoStack.length > 0, canUndo: this.undoStack.length > 0 };
  }

  downloadLibraryBackup(): { bytes: Uint8Array; fileName: string } {
    const active = this.active;
    const durable = active?.session.snapshot().durable;
    if (!active || !durable) throw new Error('Open a saved Library before downloading a backup.');
    return {
      bytes: serializeLibraryFile(durable),
      fileName: `${active.rootName.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-|-$/g, '') || 'openfilm'}-library.json`,
    };
  }

  async importBrowserLibraryBackup(bytes: Uint8Array): Promise<string> {
    const envelope = await verifySerializedLibraryFile(bytes);
    if (!isOpenFilmLibraryDocument(envelope.library)) {
      throw new Error('That file does not contain a supported OpenFilm Library.');
    }
    await this.storage.saveLibraryRecovery({
      accessMode: 'browser',
      browserLibraryFile: new Uint8Array(bytes),
      durableReference: getLibraryRevisionReference(envelope),
      handle: null,
      lastOpenedAt: this.now(),
      libraryId: envelope.library.libraryId,
      rootName: envelope.library.rootName,
      status: 'saved',
      working: envelope.library,
    });
    return `Imported ${envelope.library.rootName}. Choose its Source folder to open the Library.`;
  }

  resourceStatus(): {
    fullResolutionReads: number;
    scheduler: ReturnType<LibraryWorkScheduler['snapshot']>;
    thumbnailCache: ReturnType<ByteBudgetedResourceCache<LibraryThumbnail>['snapshot']>;
  } | null {
    const active = this.active;
    return active
      ? {
          fullResolutionReads: active.fullResolutionReads,
          scheduler: active.workScheduler.snapshot(),
          thumbnailCache: active.thumbnailCache.snapshot(),
        }
      : null;
  }

  async commitCommand(
    command: (document: OpenFilmLibraryDocument) => OpenFilmLibraryDocument,
    successMessage: string,
  ): Promise<LibraryActionResult> {
    const task = this.commandTail.then(
      () => this.commitCommandNow(command, successMessage),
      () => this.commitCommandNow(command, successMessage),
    );
    this.commandTail = task.then(
      () => undefined,
      () => undefined,
    );
    return await task;
  }

  private async commitCommandNow(
    command: (document: OpenFilmLibraryDocument) => OpenFilmLibraryDocument,
    successMessage: string,
  ): Promise<LibraryActionResult> {
    const active = this.active;
    if (!active?.snapshot.library) {
      return { kind: 'failed', message: 'Open a Library before making a change.' };
    }
    if (active.snapshot.status !== 'saved') {
      return {
        kind: 'failed',
        message:
          'This Library is Unsaved. Retry, Save a copy, or Revert before making another change.',
      };
    }

    const before = cloneOpenFilmLibraryDocument(active.snapshot.library);
    let next: OpenFilmLibraryDocument;
    try {
      next = command(cloneOpenFilmLibraryDocument(before));
    } catch (error) {
      return {
        kind: 'failed',
        message:
          error instanceof Error ? error.message : 'OpenFilm could not apply that Library command.',
      };
    }
    if (!isOpenFilmLibraryDocument(next)) {
      return { kind: 'failed', message: 'That command did not produce a valid Library document.' };
    }

    this.pendingUndoSnapshot = before;
    const result = await active.session.save(next);
    const action = await this.applySessionAction(result);
    if (action.kind === 'updated' && action.snapshot.status === 'saved') {
      this.finishPendingHistory();
      active.snapshot = { ...action.snapshot, message: successMessage };
      action.snapshot = active.snapshot;
      await this.persistActive();
    }
    return action;
  }

  async undo(): Promise<LibraryActionResult> {
    const task = this.commandTail.then(
      () => this.undoNow(),
      () => this.undoNow(),
    );
    this.commandTail = task.then(
      () => undefined,
      () => undefined,
    );
    return await task;
  }

  private async undoNow(): Promise<LibraryActionResult> {
    const active = this.active;
    const previous = this.undoStack.at(-1);
    if (!active?.snapshot.library || !previous || active.snapshot.status !== 'saved') {
      return { kind: 'failed', message: 'There is no saved Library command to undo.' };
    }
    const current = cloneOpenFilmLibraryDocument(active.snapshot.library);
    const result = await active.session.save(cloneOpenFilmLibraryDocument(previous));
    const action = await this.applySessionAction(result);
    if (action.kind === 'updated' && action.snapshot.status === 'saved') {
      this.undoStack.pop();
      this.redoStack.push(current);
      active.snapshot = { ...action.snapshot, message: 'Undid the last Library command.' };
      action.snapshot = active.snapshot;
      await this.persistActive();
    }
    return action;
  }

  async redo(): Promise<LibraryActionResult> {
    const task = this.commandTail.then(
      () => this.redoNow(),
      () => this.redoNow(),
    );
    this.commandTail = task.then(
      () => undefined,
      () => undefined,
    );
    return await task;
  }

  private async redoNow(): Promise<LibraryActionResult> {
    const active = this.active;
    const next = this.redoStack.at(-1);
    if (!active?.snapshot.library || !next || active.snapshot.status !== 'saved') {
      return { kind: 'failed', message: 'There is no Library command to redo.' };
    }
    const current = cloneOpenFilmLibraryDocument(active.snapshot.library);
    const result = await active.session.save(cloneOpenFilmLibraryDocument(next));
    const action = await this.applySessionAction(result);
    if (action.kind === 'updated' && action.snapshot.status === 'saved') {
      this.redoStack.pop();
      this.undoStack.push(current);
      active.snapshot = { ...action.snapshot, message: 'Redid the last Library command.' };
      action.snapshot = active.snapshot;
      await this.persistActive();
    }
    return action;
  }

  async readSourcePhotograph(relativePath: string, signal?: AbortSignal): Promise<File> {
    const active = this.active;
    if (!active) {
      throw new Error('Open a Library before reading a Source photograph.');
    }
    return await active.workScheduler.enqueue(
      'active-comparison',
      async () =>
        await this.runFullResolution(active, async () => {
          active.fullResolutionReads += 1;
          return await this.gateway.readSourcePhotograph(active.handle, relativePath);
        }),
      signal,
    );
  }

  finalSetExport(): FinalSetExport | null {
    return this.active?.finalSetExport ?? null;
  }

  async loadLibraryThumbnail(
    relativePath: string,
    maxWidth: number,
    signal?: AbortSignal,
    cacheRevision = '',
  ): Promise<LibraryThumbnail> {
    return await this.loadThumbnail(
      relativePath,
      maxWidth,
      'visible-thumbnail',
      signal,
      cacheRevision,
    );
  }

  async loadComparisonThumbnail(
    relativePath: string,
    maxWidth: number,
    signal?: AbortSignal,
    cacheRevision = '',
  ): Promise<LibraryThumbnail> {
    return await this.loadThumbnail(
      relativePath,
      maxWidth,
      'active-comparison',
      signal,
      cacheRevision,
    );
  }

  private async loadThumbnail(
    relativePath: string,
    maxWidth: number,
    priority: 'active-comparison' | 'visible-thumbnail',
    signal?: AbortSignal,
    cacheRevision = '',
  ): Promise<LibraryThumbnail> {
    const active = this.active;

    if (!active) {
      throw new Error('Open a Library before reading a Source photograph.');
    }

    const cacheKey = `${relativePath}\u0000${maxWidth}\u0000${cacheRevision}`;
    const cached = active.thumbnailCache.get(cacheKey);
    if (cached) return { ...cached, dispose: () => undefined };

    return await active.workScheduler.enqueue(
      priority,
      async () => {
        const thumbnail = await createLibraryGridThumbnail(
          await this.gateway.readSourcePhotograph(active.handle, relativePath),
          { maxWidth, signal },
        );
        active.thumbnailCache.admit(cacheKey, {
          bytes: thumbnail.bytes,
          dispose: thumbnail.dispose,
          value: thumbnail,
        });
        return { ...thumbnail, dispose: () => undefined };
      },
      signal,
    );
  }

  async scanLibrary(
    onSnapshot?: (snapshot: LibraryWorkspaceSnapshot) => void,
    options: { cacheContentHashes?: boolean } = {},
  ): Promise<LibraryScanResult | null> {
    const active = this.active;

    if (!active || !active.snapshot.library || active.snapshot.status !== 'saved') {
      return null;
    }

    if (active.scanPromise) {
      return await active.scanPromise;
    }

    const controller = new AbortController();
    const originalPhotographs = active.snapshot.library.photographs;
    active.scanAbortController = controller;

    const updateScanSnapshot = (
      scan: LibraryScanState,
      photographs: OpenFilmLibraryDocument['photographs'],
    ) => {
      if (this.active !== active) {
        return;
      }

      active.snapshot = {
        ...active.snapshot,
        library: { ...active.snapshot.library!, photographs },
        scan,
      };
      onSnapshot?.(active.snapshot);
    };

    const promise = (async () => {
      const result = await scanLibraryFolder(active.handle, this.gateway, {
        cacheContentHashes: options.cacheContentHashes,
        existingPhotographs: originalPhotographs,
        onProgress: (scan, photographs) => updateScanSnapshot(scan, photographs),
        scheduler: active.workScheduler,
        signal: controller.signal,
      });

      if (this.active !== active) {
        return result;
      }

      const scannedLibrary: OpenFilmLibraryDocument = {
        ...active.snapshot.library!,
        photographs: result.photographs,
      };
      const changed = JSON.stringify(originalPhotographs) !== JSON.stringify(result.photographs);

      updateScanSnapshot(
        {
          error: result.error,
          message:
            result.status === 'complete'
              ? 'Scan complete. The Library is ready to review.'
              : result.status === 'cancelled'
                ? 'Scan cancelled. Photograph records found so far remain in the Grid.'
                : 'Scan stopped before the folder was fully read.',
          progress: result.progress,
          status: result.status,
          unsupportedFiles: result.unsupportedFiles,
        },
        result.photographs,
      );

      if (changed) {
        active.snapshot = { ...active.snapshot, status: 'saving' };
        onSnapshot?.(active.snapshot);
        const saved = await active.session.save(scannedLibrary);

        if (saved.status === 'saved') {
          active.pendingFromIndexedDb = false;
          const library = asOpenFilmLibraryDocument(active.session.snapshot().working);
          active.snapshot = this.createSnapshot(
            library,
            active.rootName,
            active.session,
            'saved',
            'The Library is Saved.',
            active.snapshot.scan,
          );
          await this.persistActive();
          onSnapshot?.(active.snapshot);
        } else {
          await this.applySessionAction(saved);
          onSnapshot?.(active.snapshot);
        }
      } else {
        await this.persistActive();
        onSnapshot?.(active.snapshot);
      }

      return result;
    })();

    active.scanPromise = promise;

    try {
      return await promise;
    } finally {
      if (this.active === active) {
        active.scanAbortController = null;
        active.scanPromise = null;
      }
    }
  }

  cancelScan(): void {
    this.active?.scanAbortController?.abort();
  }

  private async findBrowserRecovery(
    root: FileSystemDirectoryHandle,
  ): Promise<StoredLibraryRecovery | null> {
    if (!isBrowserLibraryDirectory(root)) return null;
    const candidates = (await this.storage.listLibraryRecoveries()).filter(
      (recovery) => recovery.accessMode === 'browser' && recovery.rootName === root.name,
    );
    if (candidates.length === 1) return candidates[0]!;
    const ranked = candidates
      .map((recovery) => ({
        recovery,
        score: countBrowserLibrarySourceMatches(root, recovery.working.photographs),
      }))
      .filter(({ score }) => score > 0)
      .sort((first, second) => second.score - first.score);

    if (ranked.length === 0 || (ranked[1] && ranked[0]!.score === ranked[1].score)) return null;
    return ranked[0]!.recovery;
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
      const recovery = await this.findBrowserRecovery(root);
      if (recovery?.accessMode === 'browser') {
        await restoreBrowserLibraryFile(root, recovery.browserLibraryFile);
      }
      return await this.openRoot(root, recovery, true);
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

    if (recovery.accessMode === 'browser') {
      return {
        kind: 'reauthorize',
        libraryId: recovery.libraryId,
        message: 'Choose this Library folder again so OpenFilm can read its Source photographs.',
        rootName: recovery.rootName,
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

    if (recovery.accessMode === 'browser') {
      try {
        const root = await this.gateway.pickDirectory();
        const matches = countBrowserLibrarySourceMatches(root, recovery.working.photographs);
        if (
          !isBrowserLibraryDirectory(root) ||
          (root.name !== recovery.rootName &&
            recovery.working.photographs.length > 0 &&
            matches === 0)
        ) {
          return {
            kind: 'reauthorize',
            libraryId,
            message: 'That folder does not match this Browser Library. Choose the original folder.',
            rootName: recovery.rootName,
          };
        }
        await restoreBrowserLibraryFile(root, recovery.browserLibraryFile);
        return await this.openRoot(root, recovery, false);
      } catch (error) {
        if (error instanceof LibraryPickerCancelledError) return { kind: 'cancelled' };
        throw error;
      }
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

    const action = await this.applySessionAction(result);
    if (action.kind === 'updated' && action.snapshot.status === 'saved') {
      this.finishPendingHistory();
    }
    return action;
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
        scan: createIdleLibraryScanState(),
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

  async close(): Promise<void> {
    const active = this.active;
    active?.scanAbortController?.abort();
    await active?.finalSetExport?.close();
    if (this.active !== active) return;
    active?.workScheduler.dispose();
    active?.thumbnailCache.dispose();
    this.active = null;
    this.clearHistory();
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
        return { created: false, kind: 'opened', snapshot };
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
          : { created: true, kind: 'opened', snapshot };
      }

      const snapshot = this.createSnapshot(
        emptyLibrary,
        rootName,
        session,
        'saved',
        'The Library is Saved.',
      );
      await this.activate(root, session, snapshot, false);
      return { created: true, kind: 'opened', snapshot };
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

    return { created: false, kind: 'opened', snapshot };
  }

  private createSnapshot(
    library: OpenFilmLibraryDocument | null,
    rootName: string,
    session: LibraryFileSession,
    status: LibraryWorkspaceStatus,
    message: string,
    scan: LibraryScanState = createIdleLibraryScanState(),
  ): LibraryWorkspaceSnapshot {
    const durable = session.snapshot().durable;

    return {
      library,
      libraryId: library?.libraryId ?? null,
      message,
      revision: getLibraryRevisionReference(durable),
      rootName,
      scan,
      status,
    };
  }

  private async activate(
    handle: FileSystemDirectoryHandle,
    session: LibraryFileSession,
    snapshot: LibraryWorkspaceSnapshot,
    pendingFromIndexedDb: boolean,
  ): Promise<void> {
    const previous = this.active;
    previous?.scanAbortController?.abort();
    await previous?.finalSetExport?.close();
    previous?.workScheduler.dispose();
    previous?.thumbnailCache.dispose();
    this.clearHistory();
    const active: ActiveLibrary = {
      finalSetExport: null,
      fullResolutionReads: 0,
      fullResolutionTail: Promise.resolve(),
      handle,
      libraryId: snapshot.libraryId ?? `unknown-${this.now()}`,
      pendingFromIndexedDb,
      rootName: snapshot.rootName,
      scanAbortController: null,
      scanPromise: null,
      session,
      snapshot,
      thumbnailCache: new ByteBudgetedResourceCache<LibraryThumbnail>(96 * 1024 * 1024),
      workScheduler: createLibraryWorkScheduler(),
    };
    active.finalSetExport = createFinalSetExport({
      chooseFolder: async (): Promise<FinalSetExportFolder> => {
        if (
          !this.gateway.pickExportDirectory ||
          !this.gateway.listExportPaths ||
          !this.gateway.readExportFile ||
          !this.gateway.writeExportFile
        ) {
          throw new Error(
            'This browser cannot authorize an Export folder. Use bounded browser downloads.',
          );
        }
        const destination = await this.gateway.pickExportDirectory();
        return {
          paths: await this.gateway.listExportPaths(destination),
          read: async (relativePath) =>
            await this.gateway.readExportFile!(destination, relativePath),
          write: async (relativePath, bytes, options) =>
            await this.gateway.writeExportFile!(destination, relativePath, bytes, options),
        };
      },
      getLibrary: () => active.snapshot.library,
      readSourcePhotograph: async (relativePath, signal) =>
        await active.workScheduler.enqueue(
          'background',
          async () =>
            await this.runFullResolution(active, async () => {
              active.fullResolutionReads += 1;
              return await this.gateway.readSourcePhotograph(active.handle, relativePath);
            }),
          signal,
        ),
      render: async (file, photograph, options, signal) =>
        await active.workScheduler.enqueue(
          'background',
          async () =>
            await this.runFullResolution(
              active,
              async () => await this.renderExport(file, photograph, options, signal),
            ),
          signal,
        ),
      requestDownload: async (bytes, fileName) => {
        const url = URL.createObjectURL(bytes);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      },
    });
    this.active = active;
    await this.persistActive();
  }

  private clearHistory(): void {
    this.undoStack.splice(0);
    this.redoStack.splice(0);
    this.pendingUndoSnapshot = null;
    this.commandTail = Promise.resolve();
  }

  private async runFullResolution<T>(active: ActiveLibrary, run: () => Promise<T>): Promise<T> {
    const task = active.fullResolutionTail.then(run, run);
    active.fullResolutionTail = task.then(
      () => undefined,
      () => undefined,
    );
    return await task;
  }

  private finishPendingHistory(): void {
    if (!this.pendingUndoSnapshot) return;
    this.undoStack.push(this.pendingUndoSnapshot);
    this.undoStack.splice(0, Math.max(0, this.undoStack.length - LIBRARY_HISTORY_LIMIT));
    this.redoStack.splice(0);
    this.pendingUndoSnapshot = null;
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
        active.snapshot.scan,
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
      active.snapshot.scan,
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
    const common = {
      durableReference: getLibraryRevisionReference(durable),
      lastOpenedAt: this.now(),
      libraryId: active.snapshot.library.libraryId,
      rootName: active.rootName,
      status: this.toStoredStatus(active.snapshot.status),
      working: active.snapshot.library,
    };
    let recovery: StoredLibraryRecovery;

    if (isBrowserLibraryDirectory(active.handle)) {
      const browserLibraryFile = getBrowserLibraryFile(active.handle);
      if (!browserLibraryFile) {
        throw new Error('OpenFilm could not save this Browser Library in recovery storage.');
      }
      recovery = {
        ...common,
        accessMode: 'browser',
        browserLibraryFile,
        handle: null,
      };
    } else {
      recovery = {
        ...common,
        accessMode: 'directory',
        browserLibraryFile: null,
        handle: active.handle,
      };
    }

    await this.storage.saveLibraryRecovery(recovery);
  }

  private toStoredStatus(status: LibraryWorkspaceStatus): StoredLibraryStatus {
    return status === 'saving' ? 'unsaved' : status;
  }

  private async getRecentStatus(recovery: StoredLibraryRecovery): Promise<RecentLibraryStatus> {
    if (recovery.accessMode === 'browser') return 'choose-folder';

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
