export const LIBRARY_FILE_FORMAT = 'openfilm.library' as const;
export const LIBRARY_FILE_SCHEMA_VERSION = 1 as const;
export const LIBRARY_SIDECAR_DIRECTORY = '.openfilm' as const;
export const LIBRARY_AUTHORITATIVE_FILE = 'library.json' as const;
export const LIBRARY_PREVIOUS_FILE = 'library.previous.json' as const;
export const LIBRARY_PENDING_FILE = 'library.pending.json' as const;

export const LIBRARY_SIDECAR_FILES = [
  LIBRARY_AUTHORITATIVE_FILE,
  LIBRARY_PREVIOUS_FILE,
  LIBRARY_PENDING_FILE,
] as const;

export type LibrarySidecarFileName = (typeof LIBRARY_SIDECAR_FILES)[number];

export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/**
 * The durability gate does not own Library reconciliation or Edit validation yet.
 * It only requires the durable payload to be a JSON object so those domains can
 * add their versioned fields without changing the file commit protocol.
 */
export type LibraryDocument = { [key: string]: JsonValue };

export interface LibraryRevisionReference {
  checksum: string;
  revision: number;
}

export interface LibraryFileEnvelope {
  checksum: string;
  format: typeof LIBRARY_FILE_FORMAT;
  library: LibraryDocument;
  parentChecksum: string | null;
  parentRevision: number | null;
  revision: number;
  schemaVersion: typeof LIBRARY_FILE_SCHEMA_VERSION;
  writtenAt: number;
}

export type ChecksumProvider = (canonicalJson: string) => Promise<string>;

export class LibraryFileFormatError extends Error {
  readonly code = 'invalid-library-file';

  constructor(message: string) {
    super(message);
    this.name = 'LibraryFileFormatError';
  }
}

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function isJsonValue(value: unknown): value is JsonValue {
  if (isJsonPrimitive(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    return false;
  }

  return Object.values(value).every(isJsonValue);
}

function assertJsonValue(value: unknown, label: string): asserts value is JsonValue {
  if (!isJsonValue(value)) {
    throw new LibraryFileFormatError(`${label} must contain JSON values only.`);
  }
}

/**
 * JSON.stringify preserves insertion order, which makes semantically equal
 * documents produce different checksums after an object is reconstructed.
 * Canonical JSON sorts object keys and keeps array order intact.
 */
export function canonicalizeJson(value: JsonValue): string {
  assertJsonValue(value, 'Library file');

  if (isJsonPrimitive(value)) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(',')}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`)
    .join(',')}}`;
}

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

function envelopeWithoutChecksum(envelope: Omit<LibraryFileEnvelope, 'checksum'>): JsonValue {
  return {
    format: envelope.format,
    library: envelope.library,
    parentChecksum: envelope.parentChecksum,
    parentRevision: envelope.parentRevision,
    revision: envelope.revision,
    schemaVersion: envelope.schemaVersion,
    writtenAt: envelope.writtenAt,
  };
}

function isChecksum(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function isLibraryDocument(value: unknown): value is LibraryDocument {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    isJsonValue(value),
  );
}

function validateEnvelopeShape(value: unknown): asserts value is LibraryFileEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LibraryFileFormatError('The Library file must contain one JSON object.');
  }

  const envelope = value as Partial<LibraryFileEnvelope>;

  if (envelope.format !== LIBRARY_FILE_FORMAT) {
    throw new LibraryFileFormatError('The Library file format is not supported.');
  }

  if (envelope.schemaVersion !== LIBRARY_FILE_SCHEMA_VERSION) {
    throw new LibraryFileFormatError('The Library file schema version is not supported.');
  }

  if (
    typeof envelope.revision !== 'number' ||
    !Number.isSafeInteger(envelope.revision) ||
    envelope.revision < 1 ||
    typeof envelope.writtenAt !== 'number' ||
    !Number.isFinite(envelope.writtenAt) ||
    !isLibraryDocument(envelope.library) ||
    !isChecksum(envelope.checksum)
  ) {
    throw new LibraryFileFormatError('The Library file metadata or payload is invalid.');
  }

  if (
    envelope.parentRevision !== null &&
    (typeof envelope.parentRevision !== 'number' ||
      !Number.isSafeInteger(envelope.parentRevision) ||
      envelope.parentRevision < 1)
  ) {
    throw new LibraryFileFormatError('The Library file parent revision is invalid.');
  }

  if (envelope.parentRevision === null && envelope.parentChecksum !== null) {
    throw new LibraryFileFormatError('A first Library revision cannot have a parent checksum.');
  }

  if (envelope.parentRevision !== null && !isChecksum(envelope.parentChecksum)) {
    throw new LibraryFileFormatError('A child Library revision needs a parent checksum.');
  }
}

export async function sha256Hex(canonicalJson: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) {
    throw new Error('OpenFilm needs Web Crypto SHA-256 support to save a Library file.');
  }

  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson));

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function getLibraryRevisionReference(
  envelope: LibraryFileEnvelope | null,
): LibraryRevisionReference | null {
  return envelope ? { checksum: envelope.checksum, revision: envelope.revision } : null;
}

export function sameLibraryRevision(
  first: LibraryRevisionReference | null,
  second: LibraryRevisionReference | null,
): boolean {
  return first?.revision === second?.revision && first?.checksum === second?.checksum;
}

export async function createLibraryFileEnvelope(
  library: LibraryDocument,
  revision: number,
  parent: LibraryRevisionReference | null,
  options: { checksum?: ChecksumProvider; writtenAt?: number } = {},
): Promise<LibraryFileEnvelope> {
  assertJsonValue(library, 'Library');

  if (!isLibraryDocument(library)) {
    throw new LibraryFileFormatError('The Library payload must be one JSON object.');
  }

  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new LibraryFileFormatError('The Library revision must be a positive safe integer.');
  }

  if (parent && (!Number.isSafeInteger(parent.revision) || parent.revision < 1)) {
    throw new LibraryFileFormatError('The parent Library revision is invalid.');
  }

  const envelopeWithoutChecksumValue: Omit<LibraryFileEnvelope, 'checksum'> = {
    format: LIBRARY_FILE_FORMAT,
    library: cloneJson(library),
    parentChecksum: parent?.checksum ?? null,
    parentRevision: parent?.revision ?? null,
    revision,
    schemaVersion: LIBRARY_FILE_SCHEMA_VERSION,
    writtenAt: options.writtenAt ?? Date.now(),
  };
  const checksum = await (options.checksum ?? sha256Hex)(
    canonicalizeJson(envelopeWithoutChecksum(envelopeWithoutChecksumValue)),
  );

  if (!isChecksum(checksum)) {
    throw new LibraryFileFormatError('The Library checksum provider returned an invalid digest.');
  }

  return {
    ...envelopeWithoutChecksumValue,
    checksum,
  };
}

export function serializeLibraryFile(envelope: LibraryFileEnvelope): Uint8Array {
  validateEnvelopeShape(envelope);
  return new TextEncoder().encode(`${canonicalizeJson(envelope as unknown as JsonValue)}\n`);
}

export async function verifySerializedLibraryFile(
  bytes: Uint8Array,
  options: { checksum?: ChecksumProvider } = {},
): Promise<LibraryFileEnvelope> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new LibraryFileFormatError('The Library file is truncated or not valid JSON.');
  }

  validateEnvelopeShape(parsed);

  const expectedChecksum = await (options.checksum ?? sha256Hex)(
    canonicalizeJson(envelopeWithoutChecksum(parsed)),
  );

  if (expectedChecksum !== parsed.checksum) {
    throw new LibraryFileFormatError('The Library file checksum does not match its contents.');
  }

  return {
    ...parsed,
    library: cloneJson(parsed.library),
  };
}
