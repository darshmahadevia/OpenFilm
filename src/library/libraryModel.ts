import type { JsonValue, LibraryDocument } from './libraryFile';

export const LIBRARY_DOCUMENT_FORMAT = 'openfilm.library-state' as const;
export const LIBRARY_DOCUMENT_SCHEMA_VERSION = 1 as const;

export type LibraryPhotographRecord = { [key: string]: JsonValue };

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
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return false;
  }

  return value.relativePath === undefined || typeof value.relativePath === 'string';
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
