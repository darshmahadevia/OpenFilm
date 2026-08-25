import type { LibraryDirectoryGateway, LibrarySourceFile } from './libraryGateway';
import {
  isLibraryPhotographRecord,
  sortLibraryPhotographRecords,
  type LibraryPhotographRecord,
} from './libraryModel';
import {
  createLibraryMetadataExtractor,
  type LibraryMetadataExtractor,
  type PhotographMetadata,
} from './libraryMetadata';
import type { LibraryWorkScheduler } from './libraryScheduler';

const MIME_TYPE_BY_EXTENSION: Record<string, LibraryPhotographRecord['mimeType']> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const MIME_TYPES: Set<string> = new Set(Object.values(MIME_TYPE_BY_EXTENSION));

export interface LibraryScanProgress {
  discoveredFiles: number;
  metadataFailures: number;
  processedFiles: number;
  supportedFiles: number;
  unsupportedFiles: number;
}

export interface UnsupportedLibraryFile {
  extension: string;
  reason: 'unsupported-format';
  relativePath: string;
}

export type LibraryScanStatus = 'cancelled' | 'complete' | 'failed' | 'idle' | 'scanning';

export interface LibraryScanState {
  error: string | null;
  message: string | null;
  progress: LibraryScanProgress;
  status: LibraryScanStatus;
  unsupportedFiles: UnsupportedLibraryFile[];
}

export interface LibraryScanResult {
  error: string | null;
  photographs: LibraryPhotographRecord[];
  progress: LibraryScanProgress;
  status: Exclude<LibraryScanStatus, 'idle' | 'scanning'>;
  unsupportedFiles: UnsupportedLibraryFile[];
}

export interface LibraryScanOptions {
  cacheContentHashes?: boolean;
  createRecordId?: () => string;
  existingPhotographs?: readonly LibraryPhotographRecord[];
  metadataExtractor?: LibraryMetadataExtractor;
  onProgress?: (state: LibraryScanState, photographs: LibraryPhotographRecord[]) => void;
  scheduler?: LibraryWorkScheduler;
  signal?: AbortSignal;
  yieldToBrowser?: () => Promise<void>;
}

function createInitialProgress(): LibraryScanProgress {
  return {
    discoveredFiles: 0,
    metadataFailures: 0,
    processedFiles: 0,
    supportedFiles: 0,
    unsupportedFiles: 0,
  };
}

export function createIdleLibraryScanState(): LibraryScanState {
  return {
    error: null,
    message: null,
    progress: createInitialProgress(),
    status: 'idle',
    unsupportedFiles: [],
  };
}

function createScanState(
  status: LibraryScanStatus,
  progress: LibraryScanProgress,
  unsupportedFiles: UnsupportedLibraryFile[],
  message: string | null,
  error: string | null,
): LibraryScanState {
  return {
    error,
    message,
    progress: { ...progress },
    status,
    unsupportedFiles: [...unsupportedFiles],
  };
}

function createBrowserRecordId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `photograph-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');

  return dot > 0 ? fileName.slice(dot).toLowerCase() : '(none)';
}

function getSupportedMimeType(
  source: LibrarySourceFile,
): LibraryPhotographRecord['mimeType'] | null {
  const extensionMimeType = MIME_TYPE_BY_EXTENSION[getExtension(source.file.name)];

  if (extensionMimeType) {
    return extensionMimeType;
  }

  const fileMimeType = source.file.type.toLowerCase();

  return MIME_TYPES.has(fileMimeType)
    ? (fileMimeType as LibraryPhotographRecord['mimeType'])
    : null;
}

function createFingerprint(file: File): LibraryPhotographRecord['fingerprint'] {
  return {
    byteSize: file.size,
    lastModified: Number.isFinite(file.lastModified) ? Math.max(0, file.lastModified) : 0,
  };
}

function sameFingerprint(
  first: LibraryPhotographRecord['fingerprint'],
  second: LibraryPhotographRecord['fingerprint'],
): boolean {
  return first.byteSize === second.byteSize && first.lastModified === second.lastModified;
}

function createPhotographRecord(
  source: LibrarySourceFile,
  mimeType: LibraryPhotographRecord['mimeType'],
  metadata: PhotographMetadata,
  fingerprint: LibraryPhotographRecord['fingerprint'],
  createRecordId: () => string,
): LibraryPhotographRecord {
  const pathParts = source.relativePath.split('/');

  return {
    cameraSerial: metadata.cameraSerial,
    captureTime: metadata.captureTime,
    disposition: 'unmarked',
    fileName: pathParts.at(-1) ?? source.file.name,
    fingerprint,
    id: createRecordId(),
    mimeType,
    orientation: metadata.orientation,
    rating: null,
    relativePath: source.relativePath,
    sourceState: 'available',
  };
}

function updateExistingPhotographRecord(
  record: LibraryPhotographRecord,
  source: LibrarySourceFile,
  mimeType: LibraryPhotographRecord['mimeType'],
  metadata: PhotographMetadata,
  fingerprint: LibraryPhotographRecord['fingerprint'],
): LibraryPhotographRecord {
  return {
    ...record,
    cameraSerial: metadata.cameraSerial ?? record.cameraSerial,
    captureTime: metadata.captureTime ?? record.captureTime,
    fileName: source.relativePath.split('/').at(-1) ?? source.file.name,
    fingerprint,
    mimeType,
    orientation: metadata.orientation ?? record.orientation,
    relativePath: source.relativePath,
    sourceState: 'available',
  };
}

function upsertPhotographRecord(
  photographs: readonly LibraryPhotographRecord[],
  source: LibrarySourceFile,
  mimeType: LibraryPhotographRecord['mimeType'],
  metadata: PhotographMetadata,
  fingerprint: LibraryPhotographRecord['fingerprint'],
  existingPhotographs: readonly LibraryPhotographRecord[],
  claimedIds: Set<string>,
  createRecordId: () => string,
): { photographs: LibraryPhotographRecord[]; recordId: string } {
  const existing = existingPhotographs.find(
    (record) =>
      !claimedIds.has(record.id) &&
      record.relativePath === source.relativePath &&
      sameFingerprint(record.fingerprint, fingerprint),
  );

  if (existing) {
    const updated = updateExistingPhotographRecord(
      existing,
      source,
      mimeType,
      metadata,
      fingerprint,
    );

    return {
      photographs: photographs.map((record) => (record.id === existing.id ? updated : record)),
      recordId: updated.id,
    };
  }

  const changedAtSamePath = existingPhotographs.some(
    (record) => !claimedIds.has(record.id) && record.relativePath === source.relativePath,
  );
  if (changedAtSamePath) {
    const created = createPhotographRecord(source, mimeType, metadata, fingerprint, createRecordId);
    return { photographs: [...photographs, created], recordId: created.id };
  }

  const hash = fingerprint.contentHash;
  const moveCandidates = hash
    ? existingPhotographs.filter(
        (record) =>
          !claimedIds.has(record.id) &&
          record.relativePath !== source.relativePath &&
          record.fingerprint.contentHash === hash,
      )
    : [];
  if (moveCandidates.length === 1) {
    const moved = updateExistingPhotographRecord(
      moveCandidates[0],
      source,
      mimeType,
      metadata,
      fingerprint,
    );
    return {
      photographs: photographs.map((record) =>
        record.id === moveCandidates[0].id ? moved : record,
      ),
      recordId: moved.id,
    };
  }

  const created = createPhotographRecord(source, mimeType, metadata, fingerprint, createRecordId);
  if (moveCandidates.length > 1) {
    created.reconciliationCandidates = moveCandidates.map((record) => record.id);
  }

  return {
    photographs: [...photographs, created],
    recordId: created.id,
  };
}

async function contentHash(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

function markUnseenPhotographsMissing(
  photographs: readonly LibraryPhotographRecord[],
  discoveredIds: ReadonlySet<string>,
): LibraryPhotographRecord[] {
  return photographs.map((record) =>
    discoveredIds.has(record.id) || record.sourceState === 'missing'
      ? record
      : { ...record, sourceState: 'missing' },
  );
}

function describeScanError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'OpenFilm could not finish scanning this Library folder.';
}

function isScanCancellation(error: unknown, signal: AbortSignal | undefined): boolean {
  return (
    Boolean(signal?.aborted) || (error instanceof Error && error.message.includes('cancelled'))
  );
}

function yieldToBrowser(): Promise<void> {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function isSupportedLibrarySource(source: LibrarySourceFile): boolean {
  return getSupportedMimeType(source) !== null;
}

export async function scanLibraryFolder(
  root: FileSystemDirectoryHandle,
  gateway: LibraryDirectoryGateway,
  options: LibraryScanOptions = {},
): Promise<LibraryScanResult> {
  const signal = options.signal;
  const existingPhotographs = (options.existingPhotographs ?? []).filter(isLibraryPhotographRecord);
  const createRecordId = options.createRecordId ?? createBrowserRecordId;
  const extractor = options.metadataExtractor ?? createLibraryMetadataExtractor();
  const ownsExtractor = options.metadataExtractor === undefined;
  const scheduler = options.scheduler;
  const progress = createInitialProgress();
  const unsupportedFiles: UnsupportedLibraryFile[] = [];
  const claimedIds = new Set<string>();
  const discoveredIds = new Set<string>();
  let photographs = sortLibraryPhotographRecords(existingPhotographs);

  const emit = (status: LibraryScanStatus, message: string | null, error: string | null = null) => {
    options.onProgress?.(
      createScanState(status, progress, unsupportedFiles, message, error),
      sortLibraryPhotographRecords(photographs),
    );
  };

  emit('scanning', 'Scanning the Library folder.');

  try {
    for await (const source of gateway.scanSourceFiles(root, signal)) {
      if (signal?.aborted) {
        break;
      }

      progress.discoveredFiles += 1;
      const mimeType = getSupportedMimeType(source);

      if (!mimeType) {
        unsupportedFiles.push({
          extension: getExtension(source.file.name),
          reason: 'unsupported-format',
          relativePath: source.relativePath,
        });
        progress.unsupportedFiles += 1;
        progress.processedFiles += 1;
        emit('scanning', 'Scanning the Library folder.');
        await (options.yieldToBrowser ?? yieldToBrowser)();
        continue;
      }

      progress.supportedFiles += 1;
      let metadata: PhotographMetadata = {
        cameraSerial: null,
        captureTime: null,
        orientation: null,
      };

      try {
        metadata = scheduler
          ? await scheduler.enqueue('scan', () => extractor.extract(source.file, signal), signal)
          : await extractor.extract(source.file, signal);
      } catch (error) {
        if (isScanCancellation(error, signal)) {
          throw error;
        }

        progress.metadataFailures += 1;
      }

      let fingerprint = createFingerprint(source.file);
      if (options.cacheContentHashes) {
        try {
          const hash = scheduler
            ? await scheduler.enqueue('background', () => contentHash(source.file), signal)
            : await contentHash(source.file);
          fingerprint = { ...fingerprint, contentHash: hash };
        } catch (error) {
          if (isScanCancellation(error, signal)) throw error;
        }
      }

      const next = upsertPhotographRecord(
        photographs,
        source,
        mimeType,
        metadata,
        fingerprint,
        existingPhotographs,
        claimedIds,
        createRecordId,
      );
      photographs = next.photographs;
      claimedIds.add(next.recordId);
      discoveredIds.add(next.recordId);
      progress.processedFiles += 1;
      emit('scanning', 'Scanning the Library folder.');
      await (options.yieldToBrowser ?? yieldToBrowser)();
    }

    if (signal?.aborted) {
      const sorted = sortLibraryPhotographRecords(photographs);
      emit('cancelled', 'Scan cancelled. Photograph records found so far remain in the Grid.');
      return {
        error: null,
        photographs: sorted,
        progress: { ...progress },
        status: 'cancelled',
        unsupportedFiles: [...unsupportedFiles],
      };
    }

    photographs = sortLibraryPhotographRecords(
      markUnseenPhotographsMissing(photographs, discoveredIds),
    );
    emit('complete', 'Scan complete. The Library is ready to review.');

    return {
      error: null,
      photographs,
      progress: { ...progress },
      status: 'complete',
      unsupportedFiles: [...unsupportedFiles],
    };
  } catch (error) {
    if (isScanCancellation(error, signal)) {
      const sorted = sortLibraryPhotographRecords(photographs);
      emit('cancelled', 'Scan cancelled. Photograph records found so far remain in the Grid.');
      return {
        error: null,
        photographs: sorted,
        progress: { ...progress },
        status: 'cancelled',
        unsupportedFiles: [...unsupportedFiles],
      };
    }

    const message = describeScanError(error);
    const sorted = sortLibraryPhotographRecords(photographs);
    emit('failed', 'Scan stopped before the folder was fully read.', message);

    return {
      error: message,
      photographs: sorted,
      progress: { ...progress },
      status: 'failed',
      unsupportedFiles: [...unsupportedFiles],
    };
  } finally {
    if (ownsExtractor) {
      extractor.dispose();
    }
  }
}
