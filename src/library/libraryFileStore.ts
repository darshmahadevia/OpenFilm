import {
  LIBRARY_SIDECAR_DIRECTORY,
  LIBRARY_SIDECAR_FILES,
  type LibrarySidecarFileName,
} from './libraryFile';

export type LibraryPermissionState = 'granted' | 'prompt' | 'denied' | 'unknown';
export type LibraryFileOperation = 'read' | 'write' | 'remove';

export class LibraryFileAccessError extends Error {
  readonly kind: 'io' | 'not-found' | 'permission-denied';
  readonly operation: LibraryFileOperation;
  readonly fileName: LibrarySidecarFileName;

  constructor(
    kind: 'io' | 'not-found' | 'permission-denied',
    operation: LibraryFileOperation,
    fileName: LibrarySidecarFileName,
    message: string,
  ) {
    super(message);
    this.name = 'LibraryFileAccessError';
    this.kind = kind;
    this.operation = operation;
    this.fileName = fileName;
  }
}

export interface LibraryFileStore {
  getPermission(): Promise<LibraryPermissionState>;
  read(fileName: LibrarySidecarFileName): Promise<Uint8Array | null>;
  remove(fileName: LibrarySidecarFileName): Promise<void>;
  requestPermission(): Promise<LibraryPermissionState>;
  write(fileName: LibrarySidecarFileName, bytes: Uint8Array): Promise<void>;
}

function isDomException(error: unknown, name: string): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === name);
}

export function toLibraryFileAccessError(
  error: unknown,
  operation: LibraryFileOperation,
  fileName: LibrarySidecarFileName,
): LibraryFileAccessError {
  if (error instanceof LibraryFileAccessError) {
    return error;
  }

  if (isDomException(error, 'NotFoundError')) {
    return new LibraryFileAccessError(
      'not-found',
      operation,
      fileName,
      `The ${fileName} Library sidecar file was not found.`,
    );
  }

  if (
    isDomException(error, 'NotAllowedError') ||
    isDomException(error, 'SecurityError') ||
    isDomException(error, 'InvalidStateError')
  ) {
    return new LibraryFileAccessError(
      'permission-denied',
      operation,
      fileName,
      'OpenFilm no longer has write permission for this Library folder.',
    );
  }

  const message = error instanceof Error ? error.message : 'The browser file operation failed.';

  return new LibraryFileAccessError('io', operation, fileName, message);
}

function assertKnownSidecarFile(fileName: string): asserts fileName is LibrarySidecarFileName {
  if (!(LIBRARY_SIDECAR_FILES as readonly string[]).includes(fileName)) {
    throw new Error(`Unknown Library sidecar file: ${fileName}`);
  }
}

async function getSidecarDirectory(
  root: FileSystemDirectoryHandle,
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  return root.getDirectoryHandle(LIBRARY_SIDECAR_DIRECTORY, { create });
}

type PermissionDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

export function createBrowserLibraryFileStore(root: FileSystemDirectoryHandle): LibraryFileStore {
  const permissionRoot = root as PermissionDirectoryHandle;

  return {
    async getPermission() {
      try {
        return permissionRoot.queryPermission
          ? await permissionRoot.queryPermission({ mode: 'readwrite' })
          : 'unknown';
      } catch (error) {
        const accessError = toLibraryFileAccessError(error, 'read', 'library.json');

        return accessError.kind === 'permission-denied' ? 'denied' : 'unknown';
      }
    },
    async read(fileName) {
      assertKnownSidecarFile(fileName);

      try {
        const directory = await getSidecarDirectory(root, false);
        const fileHandle = await directory.getFileHandle(fileName, { create: false });
        const file = await fileHandle.getFile();
        return new Uint8Array(await file.arrayBuffer());
      } catch (error) {
        const accessError = toLibraryFileAccessError(error, 'read', fileName);

        if (accessError.kind === 'not-found') {
          return null;
        }

        throw accessError;
      }
    },
    async remove(fileName) {
      assertKnownSidecarFile(fileName);

      try {
        const directory = await getSidecarDirectory(root, false);
        await directory.removeEntry(fileName);
      } catch (error) {
        const accessError = toLibraryFileAccessError(error, 'remove', fileName);

        if (accessError.kind !== 'not-found') {
          throw accessError;
        }
      }
    },
    async requestPermission() {
      try {
        return permissionRoot.requestPermission
          ? await permissionRoot.requestPermission({ mode: 'readwrite' })
          : 'unknown';
      } catch (error) {
        const accessError = toLibraryFileAccessError(error, 'write', 'library.json');

        if (accessError.kind === 'permission-denied') {
          return 'denied';
        }

        throw accessError;
      }
    },
    async write(fileName, bytes) {
      assertKnownSidecarFile(fileName);

      let writable: FileSystemWritableFileStream | null = null;

      try {
        const directory = await getSidecarDirectory(root, true);
        const fileHandle = await directory.getFileHandle(fileName, { create: true });
        writable = await fileHandle.createWritable({ keepExistingData: false });
        await writable.write(bytes.slice().buffer as ArrayBuffer);
        await writable.close();
      } catch (error) {
        try {
          await writable?.abort();
        } catch {
          // The original write error is the useful recovery message.
        }

        throw toLibraryFileAccessError(error, 'write', fileName);
      }
    },
  };
}

export type MemoryLibraryFailureMode =
  'corrupt-after-write' | 'corrupt-read' | 'throw' | 'truncate-and-throw';

export interface MemoryLibraryFailure {
  fileName: LibrarySidecarFileName;
  mode: MemoryLibraryFailureMode;
  once?: boolean;
  operation: LibraryFileOperation;
}

export interface MemoryLibraryFileStore extends LibraryFileStore {
  bytes(fileName: LibrarySidecarFileName): Uint8Array | null;
  setFailure(failure: MemoryLibraryFailure | null): void;
  setPermission(permission: LibraryPermissionState): void;
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function corruptBytes(bytes: Uint8Array): Uint8Array {
  const corrupted = copyBytes(bytes);

  if (corrupted.length === 0) {
    return new Uint8Array([0]);
  }

  corrupted[Math.floor(corrupted.length / 2)] ^= 0xff;
  return corrupted;
}

export function createMemoryLibraryFileStore(
  initial: Partial<Record<LibrarySidecarFileName, Uint8Array>> = {},
): MemoryLibraryFileStore {
  const files = new Map<LibrarySidecarFileName, Uint8Array>();
  let failure: MemoryLibraryFailure | null = null;
  let permission: LibraryPermissionState = 'granted';

  for (const fileName of LIBRARY_SIDECAR_FILES) {
    const bytes = initial[fileName];

    if (bytes) {
      files.set(fileName, copyBytes(bytes));
    }
  }

  function matchesFailure(operation: LibraryFileOperation, fileName: LibrarySidecarFileName) {
    if (!failure || failure.operation !== operation || failure.fileName !== fileName) {
      return null;
    }

    const matched = failure;

    if (failure.once !== false) {
      failure = null;
    }

    return matched;
  }

  function throwFailure(operation: LibraryFileOperation, fileName: LibrarySidecarFileName): never {
    throw new LibraryFileAccessError(
      'io',
      operation,
      fileName,
      `Injected ${operation} failure for ${fileName}.`,
    );
  }

  function assertPermission(
    operation: LibraryFileOperation,
    fileName: LibrarySidecarFileName,
  ): void {
    if (permission === 'denied') {
      throw new LibraryFileAccessError(
        'permission-denied',
        operation,
        fileName,
        'The test Library folder no longer grants write permission.',
      );
    }
  }

  return {
    bytes(fileName) {
      const bytes = files.get(fileName);
      return bytes ? copyBytes(bytes) : null;
    },
    async getPermission() {
      return permission;
    },
    async read(fileName) {
      assertPermission('read', fileName);
      const matchedFailure = matchesFailure('read', fileName);

      if (matchedFailure?.mode === 'throw') {
        throwFailure('read', fileName);
      }

      const bytes = files.get(fileName);

      if (!bytes) {
        return null;
      }

      return matchedFailure?.mode === 'corrupt-read' ? corruptBytes(bytes) : copyBytes(bytes);
    },
    async remove(fileName) {
      assertPermission('remove', fileName);
      const matchedFailure = matchesFailure('remove', fileName);

      if (matchedFailure?.mode === 'throw') {
        throwFailure('remove', fileName);
      }

      files.delete(fileName);
    },
    async requestPermission() {
      permission = 'granted';
      return permission;
    },
    setFailure(nextFailure) {
      failure = nextFailure;
    },
    setPermission(nextPermission) {
      permission = nextPermission;
    },
    async write(fileName, bytes) {
      assertPermission('write', fileName);
      const matchedFailure = matchesFailure('write', fileName);

      if (matchedFailure?.mode === 'throw') {
        throwFailure('write', fileName);
      }

      if (matchedFailure?.mode === 'truncate-and-throw') {
        files.set(fileName, copyBytes(bytes).slice(0, Math.max(1, Math.floor(bytes.length / 2))));
        throwFailure('write', fileName);
      }

      files.set(
        fileName,
        matchedFailure?.mode === 'corrupt-after-write' ? corruptBytes(bytes) : copyBytes(bytes),
      );
    },
  };
}
