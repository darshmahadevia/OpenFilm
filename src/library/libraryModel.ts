import type { JsonValue, LibraryDocument } from './libraryFile';

export const LIBRARY_DOCUMENT_FORMAT = 'openfilm.library-state' as const;
export const LIBRARY_DOCUMENT_SCHEMA_VERSION = 1 as const;

export const LIBRARY_PHOTOGRAPH_DISPOSITIONS = ['unmarked', 'pick', 'reject'] as const;
export type LibraryPhotographDisposition = (typeof LIBRARY_PHOTOGRAPH_DISPOSITIONS)[number];

export const LIBRARY_PHOTOGRAPH_SOURCE_STATES = ['available', 'missing'] as const;
export type LibraryPhotographSourceState = (typeof LIBRARY_PHOTOGRAPH_SOURCE_STATES)[number];

export interface LibraryFileFingerprint {
  byteSize: number;
  lastModified: number;
  [key: string]: JsonValue;
}

export interface LibraryPhotographRecord {
  cameraSerial: string | null;
  captureTime: string | null;
  disposition: LibraryPhotographDisposition;
  fileName: string;
  fingerprint: LibraryFileFingerprint;
  id: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  orientation: number | null;
  rating: number | null;
  relativePath: string;
  sourceState: LibraryPhotographSourceState;
  [key: string]: JsonValue;
}

export type OpenFilmLibraryDocument = LibraryDocument & {
  createdAt: number;
  format: typeof LIBRARY_DOCUMENT_FORMAT;
  libraryId: string;
  photographs: LibraryPhotographRecord[];
  rootName: string;
  schemaVersion: typeof LIBRARY_DOCUMENT_SCHEMA_VERSION;
};

export class LibraryDocumentFormatError extends Error {
  readonly code = 'invalid-library-document';

  constructor(message: string) {
    super(message);
    this.name = 'LibraryDocumentFormatError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype,
  );
}

function isPhotographRecord(value: unknown): value is LibraryPhotographRecord {
  return isLibraryPhotographRecord(value);
}

function isLibraryPhotographDisposition(value: unknown): value is LibraryPhotographDisposition {
  return LIBRARY_PHOTOGRAPH_DISPOSITIONS.includes(value as LibraryPhotographDisposition);
}

function isLibraryPhotographSourceState(value: unknown): value is LibraryPhotographSourceState {
  return LIBRARY_PHOTOGRAPH_SOURCE_STATES.includes(value as LibraryPhotographSourceState);
}

function isLibraryFileFingerprint(value: unknown): value is LibraryFileFingerprint {
  return Boolean(
    isRecord(value) &&
    typeof value.byteSize === 'number' &&
    Number.isSafeInteger(value.byteSize) &&
    value.byteSize >= 0 &&
    typeof value.lastModified === 'number' &&
    Number.isFinite(value.lastModified) &&
    value.lastModified >= 0,
  );
}

export function isLibraryPhotographRecord(value: unknown): value is LibraryPhotographRecord {
  return Boolean(
    isRecord(value) &&
    !('source' in value) &&
    !('blob' in value) &&
    !('file' in value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.relativePath === 'string' &&
    value.relativePath.length > 0 &&
    typeof value.fileName === 'string' &&
    value.fileName.length > 0 &&
    (value.mimeType === 'image/jpeg' ||
      value.mimeType === 'image/png' ||
      value.mimeType === 'image/webp') &&
    isLibraryFileFingerprint(value.fingerprint) &&
    (value.captureTime === null || typeof value.captureTime === 'string') &&
    (value.cameraSerial === null || typeof value.cameraSerial === 'string') &&
    (value.orientation === null ||
      (typeof value.orientation === 'number' &&
        Number.isInteger(value.orientation) &&
        value.orientation >= 1 &&
        value.orientation <= 8)) &&
    isLibraryPhotographDisposition(value.disposition) &&
    (value.rating === null ||
      (typeof value.rating === 'number' &&
        Number.isInteger(value.rating) &&
        value.rating >= 0 &&
        value.rating <= 5)) &&
    isLibraryPhotographSourceState(value.sourceState),
  );
}

export function compareLibraryPhotographRecords(
  first: LibraryPhotographRecord,
  second: LibraryPhotographRecord,
): number {
  if (first.captureTime === null && second.captureTime !== null) {
    return 1;
  }

  if (first.captureTime !== null && second.captureTime === null) {
    return -1;
  }

  if (first.captureTime !== second.captureTime) {
    return first.captureTime! < second.captureTime! ? -1 : 1;
  }

  if (first.relativePath !== second.relativePath) {
    return first.relativePath < second.relativePath ? -1 : 1;
  }

  return first.id < second.id ? -1 : first.id === second.id ? 0 : 1;
}

export function sortLibraryPhotographRecords(
  photographs: readonly LibraryPhotographRecord[],
): LibraryPhotographRecord[] {
  return [...photographs].sort(compareLibraryPhotographRecords);
}

export function isOpenFilmLibraryDocument(value: unknown): value is OpenFilmLibraryDocument {
  return Boolean(
    isRecord(value) &&
    value.format === LIBRARY_DOCUMENT_FORMAT &&
    value.schemaVersion === LIBRARY_DOCUMENT_SCHEMA_VERSION &&
    typeof value.libraryId === 'string' &&
    value.libraryId.length > 0 &&
    typeof value.rootName === 'string' &&
    value.rootName.length > 0 &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt) &&
    Array.isArray(value.photographs) &&
    value.photographs.every(isPhotographRecord),
  );
}

export function assertOpenFilmLibraryDocument(
  value: unknown,
): asserts value is OpenFilmLibraryDocument {
  if (!isOpenFilmLibraryDocument(value)) {
    throw new LibraryDocumentFormatError(
      'The Library file does not contain a supported OpenFilm Library document.',
    );
  }
}

function createLibraryId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `library-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyLibraryDocument(
  rootName: string,
  options: { libraryId?: string; now?: number } = {},
): OpenFilmLibraryDocument {
  const normalizedRootName = rootName.trim() || 'Untitled Library';

  return {
    createdAt: options.now ?? Date.now(),
    format: LIBRARY_DOCUMENT_FORMAT,
    libraryId: options.libraryId ?? createLibraryId(),
    photographs: [],
    rootName: normalizedRootName,
    schemaVersion: LIBRARY_DOCUMENT_SCHEMA_VERSION,
  };
}

export function cloneOpenFilmLibraryDocument(
  document: OpenFilmLibraryDocument,
): OpenFilmLibraryDocument {
  return JSON.parse(JSON.stringify(document)) as OpenFilmLibraryDocument;
}
