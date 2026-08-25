import {
  createLibraryFileEnvelope,
  getLibraryRevisionReference,
  LIBRARY_AUTHORITATIVE_FILE,
  LIBRARY_PENDING_FILE,
  LIBRARY_PREVIOUS_FILE,
  LibraryFileFormatError,
  sameLibraryRevision,
  serializeLibraryFile,
  verifySerializedLibraryFile,
  type ChecksumProvider,
  type LibraryDocument,
  type LibraryFileEnvelope,
  type LibraryRevisionReference,
  type LibrarySidecarFileName,
} from './libraryFile';
import { LibraryFileAccessError, type LibraryFileStore } from './libraryFileStore';

export const DEFAULT_LIBRARY_LOCK_NAME = 'openfilm-library-file';

export const LIBRARY_COMMIT_PHASES = [
  'lock-acquired',
  'base-read',
  'candidate-write-start',
  'candidate-written',
  'candidate-verified',
  'external-check-before-previous',
  'previous-write-start',
  'previous-written',
  'previous-verified',
  'external-check-before-authoritative',
  'authoritative-write-start',
  'authoritative-written',
  'authoritative-verified',
  'pending-cleanup-start',
  'pending-cleaned',
] as const;

export type LibraryCommitPhase = (typeof LIBRARY_COMMIT_PHASES)[number];

export class LibraryInterruptionError extends Error {
  readonly phase: LibraryCommitPhase;

  constructor(phase: LibraryCommitPhase) {
    super(`Injected interruption at the ${phase} Library commit phase.`);
    this.name = 'LibraryInterruptionError';
    this.phase = phase;
  }
}

export interface LibraryLock {
  runExclusive<T>(callback: () => Promise<T>): Promise<T>;
}

export function createBrowserLibraryLock(name = DEFAULT_LIBRARY_LOCK_NAME): LibraryLock | null {
  const locks = globalThis.navigator?.locks;

  if (!locks) {
    return null;
  }

  return {
    async runExclusive<T>(callback: () => Promise<T>): Promise<T> {
      return await locks.request<Promise<T>>(name, { mode: 'exclusive' }, () => callback());
    },
  };
}

export function createMemoryLibraryLock(): LibraryLock {
  let tail = Promise.resolve();

  return {
    runExclusive<T>(callback: () => Promise<T>): Promise<T> {
      const previous = tail;
      let release!: () => void;

      tail = new Promise<void>((resolve) => {
        release = resolve;
      });

      return previous.then(callback).finally(release);
    },
  };
}

export interface LibraryCommitOptions {
  interruptAt?: LibraryCommitPhase;
  onPhase?: (phase: LibraryCommitPhase) => void | Promise<void>;
}

export interface LibraryFileCoordinatorOptions extends LibraryCommitOptions {
  checksum?: ChecksumProvider;
  lock?: LibraryLock | null;
  now?: () => number;
}

export type LibraryLoadStatus =
  'conflict' | 'corrupt' | 'empty' | 'permission-denied' | 'recovered' | 'saved';

export interface LibraryLoadResult {
  durable: LibraryFileEnvelope | null;
  invalidFiles: LibrarySidecarFileName[];
  message: string;
  recovery: LibraryFileEnvelope | null;
  revision: LibraryFileEnvelope | null;
  status: LibraryLoadStatus;
}

export interface LibrarySavedResult {
  checksum: string;
  revision: number;
  status: 'saved';
}

export interface LibraryConflictResult {
  actual: LibraryRevisionReference | null;
  current: LibraryLoadResult;
  expected: LibraryRevisionReference | null;
  message: string;
  status: 'conflict';
}

export interface LibraryRecoveryResult {
  message: string;
  phase: LibraryCommitPhase;
  recovery: LibraryLoadResult;
  status: 'interrupted';
}

export interface LibraryPermissionResult {
  action: 'reauthorize';
  message: string;
  phase: LibraryCommitPhase;
  recovery: LibraryLoadResult;
  status: 'permission-denied';
}

export interface LibraryFailedResult {
  message: string;
  phase: LibraryCommitPhase;
  recovery: LibraryLoadResult;
  status: 'failed';
}

export interface LibraryBlockedResult {
  message: string;
  recovery: LibraryLoadResult;
  status: 'blocked-unsaved';
}

export interface LibraryCoordinationResult {
  message: string;
  status: 'coordination-unavailable';
}

export type LibraryCommitResult =
  | LibraryBlockedResult
  | LibraryConflictResult
  | LibraryCoordinationResult
  | LibraryFailedResult
  | LibraryPermissionResult
  | LibraryRecoveryResult
  | LibrarySavedResult;

export interface LibraryRetryEmptyResult {
  message: string;
  status: 'nothing-to-retry';
}

export type LibraryRetryResult = LibraryCommitResult | LibraryRetryEmptyResult;

interface SidecarSlot {
  bytes: Uint8Array | null;
  envelope: LibraryFileEnvelope | null;
  invalid: boolean;
}

interface SidecarSlots {
  authoritative: SidecarSlot;
  invalidFiles: LibrarySidecarFileName[];
  pending: SidecarSlot;
  previous: SidecarSlot;
}

function emptySlot(): SidecarSlot {
  return { bytes: null, envelope: null, invalid: false };
}

function referenceFromParent(envelope: LibraryFileEnvelope): LibraryRevisionReference | null {
  return envelope.parentRevision === null
    ? null
    : {
        checksum: envelope.parentChecksum as string,
        revision: envelope.parentRevision,
      };
}

function describeReference(reference: LibraryRevisionReference | null): string {
  return reference ? `revision ${reference.revision}` : 'the empty Library';
}

function chooseDurableSlot(slots: SidecarSlots): SidecarSlot {
  if (slots.authoritative.envelope) {
    return slots.authoritative;
  }

  return slots.previous.envelope ? slots.previous : emptySlot();
}

function sameEnvelope(
  first: LibraryFileEnvelope | null,
  second: LibraryFileEnvelope | null,
): boolean {
  return sameLibraryRevision(
    getLibraryRevisionReference(first),
    getLibraryRevisionReference(second),
  );
}

export class LibraryFileCoordinator {
  private readonly checksum?: ChecksumProvider;
  private readonly defaultCommitOptions: LibraryCommitOptions;
  private readonly lock: LibraryLock | null;
  private readonly now: () => number;
  private readonly store: LibraryFileStore;

  constructor(store: LibraryFileStore, options: LibraryFileCoordinatorOptions = {}) {
    this.store = store;
    this.checksum = options.checksum;
    this.now = options.now ?? (() => Date.now());
    this.defaultCommitOptions = {
      interruptAt: options.interruptAt,
      onPhase: options.onPhase,
    };
    this.lock = options.lock === undefined ? createBrowserLibraryLock() : options.lock;
  }

  async load(): Promise<LibraryLoadResult> {
    try {
      return this.describeSlots(await this.readSlots());
    } catch (error) {
      return this.describeLoadError(error);
    }
  }

  async commit(
    library: LibraryDocument,
    expected: LibraryRevisionReference | null,
    options: LibraryCommitOptions = {},
  ): Promise<LibraryCommitResult> {
    if (!this.lock) {
      return {
        message:
          'OpenFilm cannot prove single-writer Library commits because Web Locks is unavailable.',
        status: 'coordination-unavailable',
      };
    }

    let currentPhase: LibraryCommitPhase = 'lock-acquired';

    try {
      return await this.lock.runExclusive(async () => {
        await this.checkpoint('lock-acquired', options);
        currentPhase = 'base-read';
        const slots = await this.readSlots();
        await this.checkpoint('base-read', options);

        const initialResult = this.ensureCommitBase(slots, expected);

        if (initialResult) {
          return initialResult;
        }

        const durable = chooseDurableSlot(slots);
        const nextRevision = (durable.envelope?.revision ?? 0) + 1;
        const candidate = await createLibraryFileEnvelope(
          library,
          nextRevision,
          getLibraryRevisionReference(durable.envelope),
          { checksum: this.checksum, writtenAt: this.now() },
        );

        return await this.promoteNewCandidate(candidate, durable, expected, options, (phase) => {
          currentPhase = phase;
        });
      });
    } catch (error) {
      return await this.describeCommitError(error, currentPhase);
    }
  }

  async retry(options: LibraryCommitOptions = {}): Promise<LibraryRetryResult> {
    if (!this.lock) {
      return {
        message:
          'OpenFilm cannot prove single-writer Library commits because Web Locks is unavailable.',
        status: 'coordination-unavailable',
      };
    }

    let currentPhase: LibraryCommitPhase = 'lock-acquired';

    try {
      return await this.lock.runExclusive(async () => {
        await this.checkpoint('lock-acquired', options);
        currentPhase = 'base-read';
        const slots = await this.readSlots();
        await this.checkpoint('base-read', options);
        const current = this.describeSlots(slots);
        const candidate = slots.pending.envelope;

        if (!candidate || !current.recovery || !sameEnvelope(candidate, current.recovery)) {
          return {
            message: 'There is no verified pending Library revision to retry.',
            status: 'nothing-to-retry',
          };
        }

        const durable = chooseDurableSlot(slots);
        const expected = getLibraryRevisionReference(durable.envelope);

        if (!sameLibraryRevision(referenceFromParent(candidate), expected)) {
          return this.createConflictResult(
            expected,
            expected,
            current,
            'The pending Library revision belongs to an older external revision.',
          );
        }

        await this.checkpoint('candidate-verified', options);

        return await this.promoteVerifiedCandidate(
          candidate,
          durable,
          expected,
          options,
          (phase) => {
            currentPhase = phase;
          },
        );
      });
    } catch (error) {
      if (error instanceof LibraryInterruptionError) {
        return {
          message: error.message,
          phase: error.phase,
          recovery: await this.load(),
          status: 'interrupted',
        };
      }

      return await this.describeCommitError(error, currentPhase);
    }
  }

  /**
   * Revert discards the pending revision. If the authoritative file is
   * damaged, it first restores the last verified previous snapshot and reads
   * it back before removing the pending copy.
   */
  async clearPending(): Promise<LibraryLoadResult> {
    if (!this.lock) {
      return {
        durable: null,
        invalidFiles: [],
        message: 'OpenFilm cannot revert the Library safely because Web Locks is unavailable.',
        recovery: null,
        revision: null,
        status: 'conflict',
      };
    }

    try {
      await this.lock.runExclusive(async () => {
        const slots = await this.readSlots();
        const durable = chooseDurableSlot(slots);

        if (!slots.pending.envelope) {
          return;
        }

        if (!slots.authoritative.envelope && durable.envelope) {
          await this.store.write(
            LIBRARY_AUTHORITATIVE_FILE,
            serializeLibraryFile(durable.envelope),
          );
          const restored = await this.readSlot(LIBRARY_AUTHORITATIVE_FILE);

          if (!restored.envelope || !sameEnvelope(restored.envelope, durable.envelope)) {
            throw new Error('OpenFilm could not verify the reverted Library revision.');
          }
        }

        await this.store.remove(LIBRARY_PENDING_FILE);
      });

      return await this.load();
    } catch (error) {
      return this.describeLoadError(error);
    }
  }

  private async checkpoint(
    phase: LibraryCommitPhase,
    options: LibraryCommitOptions,
  ): Promise<void> {
    const combinedOptions = { ...this.defaultCommitOptions, ...options };

    if (combinedOptions.interruptAt === phase) {
      throw new LibraryInterruptionError(phase);
    }

    await combinedOptions.onPhase?.(phase);
  }

  private describeLoadError(error: unknown): LibraryLoadResult {
    if (error instanceof LibraryFileAccessError && error.kind === 'permission-denied') {
      return {
        durable: null,
        invalidFiles: [],
        message:
          'OpenFilm lost permission to read this Library folder. Reauthorize it before continuing.',
        recovery: null,
        revision: null,
        status: 'permission-denied',
      };
    }

    return {
      durable: null,
      invalidFiles: [],
      message:
        error instanceof Error
          ? error.message
          : 'OpenFilm could not read the Library sidecar files.',
      recovery: null,
      revision: null,
      status: 'corrupt',
    };
  }

  private describeSlots(slots: SidecarSlots): LibraryLoadResult {
    const authoritative = slots.authoritative.envelope;
    const previous = slots.previous.envelope;
    const pending = slots.pending.envelope;

    if (authoritative && previous && previous.revision > authoritative.revision) {
      return {
        durable: authoritative,
        invalidFiles: slots.invalidFiles,
        message:
          'The previous Library snapshot is newer than library.json. OpenFilm stopped instead of choosing between them.',
        recovery: null,
        revision: authoritative,
        status: 'conflict',
      };
    }

    if (
      authoritative &&
      pending &&
      pending.revision === authoritative.revision &&
      !sameEnvelope(pending, authoritative)
    ) {
      return {
        durable: authoritative,
        invalidFiles: slots.invalidFiles,
        message:
          'The Library sidecar contains two different files for the same revision. OpenFilm stopped without merging them.',
        recovery: null,
        revision: authoritative,
        status: 'conflict',
      };
    }

    const durableSlot = chooseDurableSlot(slots);
    const durable = durableSlot.envelope;
    const durableReference = getLibraryRevisionReference(durable);

    if (pending && (!durable || pending.revision > durable.revision)) {
      if (!sameLibraryRevision(referenceFromParent(pending), durableReference)) {
        return {
          durable,
          invalidFiles: slots.invalidFiles,
          message:
            'A pending Library revision was based on a different external revision. OpenFilm stopped instead of merging tabs.',
          recovery: pending,
          revision: pending,
          status: 'conflict',
        };
      }

      return {
        durable,
        invalidFiles: slots.invalidFiles,
        message:
          'OpenFilm recovered a verified pending Library revision. Retry, Save a copy, or Revert before making another change.',
        recovery: pending,
        revision: pending,
        status: 'recovered',
      };
    }

    if (durable) {
      if (authoritative) {
        return {
          durable,
          invalidFiles: slots.invalidFiles,
          message:
            slots.invalidFiles.length > 0
              ? 'The Library is Saved. OpenFilm retained an invalid sidecar for inspection.'
              : 'The Library is Saved.',
          recovery: null,
          revision: authoritative,
          status: 'saved',
        };
      }

      return {
        durable,
        invalidFiles: slots.invalidFiles,
        message:
          'OpenFilm recovered the last verified Library snapshot from the previous file. Retry or Revert before making another change.',
        recovery: null,
        revision: durable,
        status: 'recovered',
      };
    }

    if (slots.invalidFiles.length > 0) {
      return {
        durable: null,
        invalidFiles: slots.invalidFiles,
        message:
          'OpenFilm could not verify any Library sidecar revision. It stopped without reporting a partial file as Saved.',
        recovery: null,
        revision: null,
        status: 'corrupt',
      };
    }

    return {
      durable: null,
      invalidFiles: [],
      message: 'No Library file exists yet.',
      recovery: null,
      revision: null,
      status: 'empty',
    };
  }

  private async readSlot(fileName: LibrarySidecarFileName): Promise<SidecarSlot> {
    const bytes = await this.store.read(fileName);

    if (!bytes) {
      return emptySlot();
    }

    try {
      return {
        bytes,
        envelope: await verifySerializedLibraryFile(bytes, { checksum: this.checksum }),
        invalid: false,
      };
    } catch (error) {
      if (error instanceof LibraryFileFormatError) {
        return { bytes, envelope: null, invalid: true };
      }

      throw error;
    }
  }

  private async readSlots(): Promise<SidecarSlots> {
    const [authoritative, previous, pending] = await Promise.all([
      this.readSlot(LIBRARY_AUTHORITATIVE_FILE),
      this.readSlot(LIBRARY_PREVIOUS_FILE),
      this.readSlot(LIBRARY_PENDING_FILE),
    ]);
    const invalidFiles: LibrarySidecarFileName[] = [];

    if (authoritative.invalid) {
      invalidFiles.push(LIBRARY_AUTHORITATIVE_FILE);
    }

    if (previous.invalid) {
      invalidFiles.push(LIBRARY_PREVIOUS_FILE);
    }

    if (pending.invalid) {
      invalidFiles.push(LIBRARY_PENDING_FILE);
    }

    return { authoritative, invalidFiles, pending, previous };
  }

  private ensureCommitBase(
    slots: SidecarSlots,
    expected: LibraryRevisionReference | null,
  ): LibraryCommitResult | null {
    const current = this.describeSlots(slots);

    if (current.status === 'permission-denied') {
      return {
        action: 'reauthorize',
        message: current.message,
        phase: 'base-read',
        recovery: current,
        status: 'permission-denied',
      };
    }

    if (current.status === 'corrupt' || current.status === 'conflict') {
      return {
        actual: getLibraryRevisionReference(current.durable),
        current,
        expected,
        message: current.message,
        status: 'conflict',
      };
    }

    if (current.status === 'recovered') {
      return {
        message:
          'This Library has an unsaved or recovered revision. Retry, Save a copy, or Revert before making another change.',
        recovery: current,
        status: 'blocked-unsaved',
      };
    }

    const actual = getLibraryRevisionReference(current.durable);

    if (!sameLibraryRevision(actual, expected)) {
      return this.createConflictResult(
        expected,
        actual,
        current,
        `The Library changed after it was opened. Expected ${describeReference(expected)} but found ${describeReference(actual)}.`,
      );
    }

    return null;
  }

  private createConflictResult(
    expected: LibraryRevisionReference | null,
    actual: LibraryRevisionReference | null,
    current: LibraryLoadResult,
    message: string,
  ): LibraryConflictResult {
    return { actual, current, expected, message, status: 'conflict' };
  }

  private async promoteNewCandidate(
    candidate: LibraryFileEnvelope,
    durable: SidecarSlot,
    expected: LibraryRevisionReference | null,
    options: LibraryCommitOptions,
    setPhase: (phase: LibraryCommitPhase) => void,
  ): Promise<LibraryCommitResult> {
    await this.checkpoint('candidate-write-start', options);
    setPhase('candidate-write-start');
    await this.store.write(LIBRARY_PENDING_FILE, serializeLibraryFile(candidate));
    await this.checkpoint('candidate-written', options);
    setPhase('candidate-written');

    const pendingAfterWrite = await this.readSlot(LIBRARY_PENDING_FILE);

    if (!pendingAfterWrite.envelope || !sameEnvelope(pendingAfterWrite.envelope, candidate)) {
      throw new Error('OpenFilm could not verify the pending Library revision.');
    }

    await this.checkpoint('candidate-verified', options);
    setPhase('candidate-verified');

    return this.promoteVerifiedCandidate(candidate, durable, expected, options, setPhase);
  }

  private async promoteVerifiedCandidate(
    candidate: LibraryFileEnvelope,
    durable: SidecarSlot,
    expected: LibraryRevisionReference | null,
    options: LibraryCommitOptions,
    setPhase: (phase: LibraryCommitPhase) => void,
  ): Promise<LibraryCommitResult> {
    const afterCandidateSlots = await this.readSlots();
    const afterCandidate = this.describeSlots(afterCandidateSlots);
    const afterCandidateReference = getLibraryRevisionReference(afterCandidate.durable);

    await this.checkpoint('external-check-before-previous', options);
    setPhase('external-check-before-previous');

    if (!sameLibraryRevision(afterCandidateReference, expected)) {
      return this.createConflictResult(
        expected,
        afterCandidateReference,
        afterCandidate,
        'A newer external Library revision appeared before the previous snapshot was written. OpenFilm stopped without merging it.',
      );
    }

    if (durable.envelope && durable.bytes) {
      await this.checkpoint('previous-write-start', options);
      setPhase('previous-write-start');
      await this.store.write(LIBRARY_PREVIOUS_FILE, serializeLibraryFile(durable.envelope));
      await this.checkpoint('previous-written', options);
      setPhase('previous-written');

      const previousAfterWrite = await this.readSlot(LIBRARY_PREVIOUS_FILE);

      if (
        !previousAfterWrite.envelope ||
        !sameEnvelope(previousAfterWrite.envelope, durable.envelope)
      ) {
        throw new Error('OpenFilm could not verify the recoverable previous Library snapshot.');
      }

      await this.checkpoint('previous-verified', options);
      setPhase('previous-verified');
    } else {
      await this.checkpoint('previous-write-start', options);
      setPhase('previous-write-start');
    }

    const beforeAuthoritativeSlots = await this.readSlots();
    const beforeAuthoritative = this.describeSlots(beforeAuthoritativeSlots);
    const beforeAuthoritativeReference = getLibraryRevisionReference(beforeAuthoritative.durable);

    await this.checkpoint('external-check-before-authoritative', options);
    setPhase('external-check-before-authoritative');

    if (!sameLibraryRevision(beforeAuthoritativeReference, expected)) {
      return this.createConflictResult(
        expected,
        beforeAuthoritativeReference,
        beforeAuthoritative,
        'A newer external Library revision appeared before the authoritative file was written. OpenFilm stopped without merging it.',
      );
    }

    const candidateBytes = serializeLibraryFile(candidate);
    await this.checkpoint('authoritative-write-start', options);
    setPhase('authoritative-write-start');
    await this.store.write(LIBRARY_AUTHORITATIVE_FILE, candidateBytes);
    await this.checkpoint('authoritative-written', options);
    setPhase('authoritative-written');

    const authoritativeAfterWrite = await this.readSlot(LIBRARY_AUTHORITATIVE_FILE);

    if (
      !authoritativeAfterWrite.envelope ||
      !sameEnvelope(authoritativeAfterWrite.envelope, candidate)
    ) {
      throw new Error('OpenFilm could not verify the authoritative Library file after writing it.');
    }

    await this.checkpoint('authoritative-verified', options);
    setPhase('authoritative-verified');

    await this.checkpoint('pending-cleanup-start', options);
    setPhase('pending-cleanup-start');

    try {
      await this.store.remove(LIBRARY_PENDING_FILE);
    } catch {
      // The authoritative write already passed read-back verification. Keeping
      // the verified pending copy is safe and lets the next load inspect it.
    }

    await this.checkpoint('pending-cleaned', options);
    setPhase('pending-cleaned');

    return {
      checksum: candidate.checksum,
      revision: candidate.revision,
      status: 'saved',
    };
  }

  private async describeCommitError(
    error: unknown,
    phase: LibraryCommitPhase,
  ): Promise<LibraryCommitResult> {
    if (error instanceof LibraryInterruptionError) {
      return {
        message: error.message,
        phase: error.phase,
        recovery: await this.load(),
        status: 'interrupted',
      };
    }

    if (error instanceof LibraryFileAccessError && error.kind === 'permission-denied') {
      return {
        action: 'reauthorize',
        message: error.message,
        phase,
        recovery: await this.load(),
        status: 'permission-denied',
      };
    }

    return {
      message: error instanceof Error ? error.message : 'The Library commit failed.',
      phase,
      recovery: await this.load(),
      status: 'failed',
    };
  }
}

export type LibrarySessionStatus = 'conflict' | 'empty' | 'read-only' | 'saved' | 'unsaved';

export interface LibrarySessionSnapshot {
  durable: LibraryFileEnvelope | null;
  message: string;
  status: LibrarySessionStatus;
  working: LibraryDocument | null;
}

export interface LibrarySavedCopyResult {
  checksum: string;
  revision: number;
  status: 'saved-copy';
}

export interface LibraryRevertedResult {
  library: LibraryDocument;
  revision: number;
  status: 'reverted';
}

export interface LibraryNothingToRevertResult {
  message: string;
  status: 'nothing-to-revert';
}

export type LibrarySessionActionResult =
  | LibraryCommitResult
  | LibraryNothingToRevertResult
  | LibraryRetryEmptyResult
  | LibraryRevertedResult
  | LibrarySavedCopyResult;

export class LibraryFileSession {
  private durable: LibraryFileEnvelope | null = null;
  private expected: LibraryRevisionReference | null = null;
  private message = 'Open a Library folder to begin.';
  private opened = false;
  private status: LibrarySessionStatus = 'empty';
  private working: LibraryDocument | null = null;

  constructor(
    private readonly coordinator: LibraryFileCoordinator,
    private readonly options: LibraryFileCoordinatorOptions = {},
  ) {}

  async open(): Promise<LibraryLoadResult> {
    const result = await this.coordinator.load();
    this.opened = true;
    this.applyLoadResult(result);
    return result;
  }

  snapshot(): LibrarySessionSnapshot {
    return {
      durable: this.durable,
      message: this.message,
      status: this.status,
      working: this.working,
    };
  }

  async save(library: LibraryDocument): Promise<LibraryCommitResult> {
    if (!this.opened) {
      await this.open();
    }

    if (this.status === 'unsaved' || this.status === 'conflict' || this.status === 'read-only') {
      return {
        message:
          'This Library has an unresolved save outcome. Retry, Save a copy, or Revert before making another change.',
        recovery: await this.coordinator.load(),
        status: 'blocked-unsaved',
      };
    }

    this.working = library;
    const result = await this.coordinator.commit(library, this.expected, this.options);
    await this.applyCommitResult(result);
    return result;
  }

  async retry(): Promise<LibraryRetryResult> {
    if (!this.opened) {
      await this.open();
    }

    if (!this.working) {
      return {
        message: 'There is no unsaved Library command to retry.',
        status: 'nothing-to-retry',
      };
    }

    const load = await this.coordinator.load();
    const result = load.recovery
      ? await this.coordinator.retry(this.options)
      : await this.coordinator.commit(this.working, this.expected, this.options);

    await this.applySessionActionResult(result);
    return result;
  }

  async saveCopy(
    destination: LibraryFileStore,
  ): Promise<LibrarySavedCopyResult | LibraryCommitResult> {
    if (!this.working) {
      return {
        message: 'There is no current Library state to save as a copy.',
        status: 'blocked-unsaved',
        recovery: await this.coordinator.load(),
      };
    }

    const copyCoordinator = new LibraryFileCoordinator(destination, this.options);
    const result = await copyCoordinator.commit(this.working, null, this.options);

    if (result.status !== 'saved') {
      return result;
    }

    return { ...result, status: 'saved-copy' };
  }

  async revert(): Promise<
    LibraryRevertedResult | LibraryNothingToRevertResult | LibraryLoadResult
  > {
    const result = await this.coordinator.clearPending();

    if (!result.durable) {
      return result.status === 'empty'
        ? {
            message: 'There is no saved Library revision to revert to.',
            status: 'nothing-to-revert',
          }
        : result;
    }

    this.working = result.durable.library;
    this.durable = result.durable;
    this.expected = getLibraryRevisionReference(result.durable);
    this.message = result.message;
    this.status = result.status === 'saved' ? 'saved' : 'unsaved';

    return {
      library: result.durable.library,
      revision: result.durable.revision,
      status: 'reverted',
    };
  }

  private applyLoadResult(result: LibraryLoadResult): void {
    this.durable = result.durable;
    this.expected = getLibraryRevisionReference(result.durable);
    this.message = result.message;
    this.working = result.revision?.library ?? null;

    if (result.status === 'saved' || result.status === 'empty') {
      this.status = result.status;
    } else if (result.status === 'permission-denied' || result.status === 'corrupt') {
      this.status = 'read-only';
    } else if (result.status === 'conflict') {
      this.status = 'conflict';
    } else {
      this.status = 'unsaved';
    }
  }

  private async applyCommitResult(result: LibraryCommitResult): Promise<void> {
    if (result.status === 'saved') {
      await this.refreshAfterSave();
      return;
    }

    this.message = result.message;
    this.status =
      result.status === 'permission-denied' || result.status === 'coordination-unavailable'
        ? 'read-only'
        : result.status === 'conflict'
          ? 'conflict'
          : 'unsaved';
  }

  private async applySessionActionResult(result: LibrarySessionActionResult): Promise<void> {
    if (result.status === 'saved') {
      await this.refreshAfterSave();
      return;
    }

    if (result.status === 'reverted') {
      this.status = 'saved';
      this.message = `Reverted to Library revision ${result.revision}.`;
      return;
    }

    if ('message' in result) {
      this.message = result.message;
    }

    if (result.status === 'permission-denied' || result.status === 'coordination-unavailable') {
      this.status = 'read-only';
    } else if (result.status === 'conflict') {
      this.status = 'conflict';
    } else if (result.status !== 'saved-copy' && result.status !== 'nothing-to-retry') {
      this.status = 'unsaved';
    }
  }

  private async refreshAfterSave(): Promise<void> {
    const result = await this.coordinator.load();
    this.applyLoadResult(result);
  }
}
