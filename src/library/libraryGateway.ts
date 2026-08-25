import { LIBRARY_SIDECAR_DIRECTORY, type LibrarySidecarFileName } from './libraryFile';
import {
  createBrowserLibraryFileStore,
  type LibraryFileStore,
  type LibraryPermissionState,
} from './libraryFileStore';

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite';
  }) => Promise<FileSystemDirectoryHandle>;
};

type PermissionDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

type IterableDirectoryHandle = FileSystemDirectoryHandle & {
  entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
};

const exportWriteTails = new WeakMap<FileSystemDirectoryHandle, Map<string, Promise<void>>>();

async function serializeExportWriteLocally<T>(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  write: () => Promise<T>,
): Promise<T> {
  let rootTails = exportWriteTails.get(root);
  if (!rootTails) {
    rootTails = new Map();
    exportWriteTails.set(root, rootTails);
  }
  const previous = rootTails.get(relativePath) ?? Promise.resolve();
  const task = previous.then(write, write);
  const tail = task.then(
    () => undefined,
    () => undefined,
  );
  rootTails.set(relativePath, tail);
  try {
    return await task;
  } finally {
    if (rootTails.get(relativePath) === tail) rootTails.delete(relativePath);
  }
}

async function serializeExportWrite<T>(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  write: () => Promise<T>,
): Promise<T> {
  const run = async () => await serializeExportWriteLocally(root, relativePath, write);
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  return locks
    ? await locks.request(
        `openfilm-export:${root.name}:${relativePath}`,
        { mode: 'exclusive' },
        run,
      )
    : await run();
}

export type LibraryDirectoryAvailability = 'available' | 'missing' | 'permission-denied';

export interface LibrarySourceFile {
  file: File;
  relativePath: string;
}

export class LibraryGatewayError extends Error {
  readonly kind: 'different-folder' | 'missing' | 'permission-denied' | 'unsupported';

  constructor(
    kind: 'different-folder' | 'missing' | 'permission-denied' | 'unsupported',
    message: string,
  ) {
    super(message);
    this.name = 'LibraryGatewayError';
    this.kind = kind;
  }
}

export class LibraryPickerCancelledError extends Error {
  constructor() {
    super('The folder picker was cancelled.');
    this.name = 'LibraryPickerCancelledError';
  }
}

export interface LibraryDirectoryGateway {
  createFileStore(root: FileSystemDirectoryHandle): LibraryFileStore;
  getPermission(root: FileSystemDirectoryHandle): Promise<LibraryPermissionState>;
  inspectRecentDirectory(root: FileSystemDirectoryHandle): Promise<LibraryDirectoryAvailability>;
  pickDirectory(): Promise<FileSystemDirectoryHandle>;
  readSourcePhotograph(root: FileSystemDirectoryHandle, relativePath: string): Promise<File>;
  requestPermission(root: FileSystemDirectoryHandle): Promise<LibraryPermissionState>;
  scanSourceFiles(
    root: FileSystemDirectoryHandle,
    signal?: AbortSignal,
  ): AsyncIterable<LibrarySourceFile>;
  pickExportDirectory?(): Promise<FileSystemDirectoryHandle>;
  listExportPaths?(root: FileSystemDirectoryHandle): Promise<string[]>;
  readExportFile?(root: FileSystemDirectoryHandle, relativePath: string): Promise<File | null>;
  writeExportFile?(
    root: FileSystemDirectoryHandle,
    relativePath: string,
    bytes: Blob | Uint8Array,
    options?: { overwrite?: boolean },
  ): Promise<void>;
}

function isDomException(error: unknown, name: string): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === name);
}

function permissionStateToLibraryPermission(state: PermissionState): LibraryPermissionState {
  if (state === 'granted' || state === 'prompt' || state === 'denied') {
    return state;
  }

  return 'unknown';
}

function getPicker(): DirectoryPickerWindow['showDirectoryPicker'] {
  if (typeof globalThis.window === 'undefined') {
    return undefined;
  }

  return (globalThis.window as DirectoryPickerWindow).showDirectoryPicker;
}

function throwDirectoryError(error: unknown): never {
  if (isDomException(error, 'AbortError')) {
    throw new LibraryPickerCancelledError();
  }

  if (isDomException(error, 'NotAllowedError') || isDomException(error, 'SecurityError')) {
    throw new LibraryGatewayError(
      'permission-denied',
      'OpenFilm could not get permission to use that Library folder.',
    );
  }

  throw error instanceof Error
    ? error
    : new Error('OpenFilm could not open the selected Library folder.');
}

function throwSourceFileError(error: unknown, relativePath: string): never {
  if (isDomException(error, 'NotFoundError')) {
    throw new LibraryGatewayError(
      'missing',
      `The Source photograph at ${relativePath} is no longer available in this Library folder.`,
    );
  }

  if (isDomException(error, 'NotAllowedError') || isDomException(error, 'SecurityError')) {
    throw new LibraryGatewayError(
      'permission-denied',
      'OpenFilm lost permission to read a Source photograph in this Library folder.',
    );
  }

  throw error instanceof Error
    ? error
    : new Error(`OpenFilm could not read the Source photograph at ${relativePath}.`);
}

function normalizeRelativePath(relativePath: string): string[] {
  const parts = relativePath.split('/');

  if (
    parts.length === 0 ||
    parts.some((part) => part.length === 0 || part === '.' || part === '..')
  ) {
    throw new LibraryGatewayError(
      'missing',
      'OpenFilm received an invalid Source photograph path.',
    );
  }

  return parts;
}

async function* walkSourceFiles(
  directory: FileSystemDirectoryHandle,
  prefix: string,
  signal?: AbortSignal,
): AsyncIterable<LibrarySourceFile> {
  const iterableDirectory = directory as IterableDirectoryHandle;

  if (typeof iterableDirectory.entries !== 'function') {
    throw new LibraryGatewayError(
      'unsupported',
      'This Chromium browser cannot enumerate a Library folder.',
    );
  }

  for await (const [name, entry] of iterableDirectory.entries()) {
    if (signal?.aborted) {
      return;
    }

    if (prefix.length === 0 && name === LIBRARY_SIDECAR_DIRECTORY) {
      continue;
    }

    const relativePath = prefix.length === 0 ? name : `${prefix}/${name}`;

    if (entry.kind === 'directory') {
      yield* walkSourceFiles(entry as FileSystemDirectoryHandle, relativePath, signal);
      continue;
    }

    try {
      yield {
        file: await (entry as FileSystemFileHandle).getFile(),
        relativePath,
      };
    } catch (error) {
      throwSourceFileError(error, relativePath);
    }
  }
}

export function hasDirectoryPicker(): boolean {
  return typeof getPicker() === 'function';
}

export function createBrowserLibraryDirectoryGateway(): LibraryDirectoryGateway | null {
  return {
    createFileStore(root) {
      return createBrowserLibraryFileStore(root);
    },
    async getPermission(root) {
      const permissionRoot = root as PermissionDirectoryHandle;

      if (!permissionRoot.queryPermission) {
        return 'unknown';
      }

      try {
        return permissionStateToLibraryPermission(
          await permissionRoot.queryPermission({ mode: 'readwrite' }),
        );
      } catch (error) {
        if (isDomException(error, 'NotAllowedError') || isDomException(error, 'SecurityError')) {
          return 'denied';
        }

        return 'unknown';
      }
    },
    async inspectRecentDirectory(root) {
      try {
        const permission = await this.getPermission(root);

        if (permission === 'denied' || permission === 'prompt') {
          return 'permission-denied';
        }

        await root.getDirectoryHandle(LIBRARY_SIDECAR_DIRECTORY, { create: false });
        return 'available';
      } catch (error) {
        if (isDomException(error, 'NotFoundError')) {
          return 'missing';
        }

        if (isDomException(error, 'NotAllowedError') || isDomException(error, 'SecurityError')) {
          return 'permission-denied';
        }

        throw error;
      }
    },
    async pickDirectory() {
      const picker = getPicker();

      if (!picker) {
        throw new LibraryGatewayError(
          'unsupported',
          'OpenFilm needs a Chromium desktop browser with folder access to open a Library.',
        );
      }

      try {
        return await picker({ mode: 'readwrite' });
      } catch (error) {
        throwDirectoryError(error);
      }
    },
    async pickExportDirectory() {
      return await this.pickDirectory();
    },
    async listExportPaths(root) {
      const paths: string[] = [];
      async function walk(directory: FileSystemDirectoryHandle, prefix: string) {
        const iterable = directory as IterableDirectoryHandle;
        for await (const [name, entry] of iterable.entries()) {
          const path = prefix ? `${prefix}/${name}` : name;
          if (entry.kind === 'directory') await walk(entry as FileSystemDirectoryHandle, path);
          else paths.push(path);
        }
      }
      await walk(root, '');
      return paths;
    },
    async readExportFile(root, relativePath) {
      try {
        const parts = normalizeRelativePath(relativePath);
        let directory = root;
        for (const part of parts.slice(0, -1))
          directory = await directory.getDirectoryHandle(part, { create: false });
        return await (await directory.getFileHandle(parts.at(-1)!, { create: false })).getFile();
      } catch (error) {
        if (isDomException(error, 'NotFoundError')) return null;
        throwDirectoryError(error);
      }
    },
    async writeExportFile(root, relativePath, bytes, options) {
      await serializeExportWrite(root, relativePath, async () => {
        const parts = normalizeRelativePath(relativePath);
        let directory = root;
        for (const part of parts.slice(0, -1))
          directory = await directory.getDirectoryHandle(part, { create: true });
        if (!options?.overwrite) {
          try {
            await directory.getFileHandle(parts.at(-1)!, { create: false });
            throw new LibraryGatewayError(
              'different-folder',
              `Export stopped because ${relativePath} already exists.`,
            );
          } catch (error) {
            if (!isDomException(error, 'NotFoundError')) throw error;
          }
        }
        const handle = await directory.getFileHandle(parts.at(-1)!, { create: true });
        const writable = await handle.createWritable({ keepExistingData: false });
        try {
          await writable.write(
            bytes instanceof Uint8Array ? (bytes.slice().buffer as ArrayBuffer) : bytes,
          );
          await writable.close();
        } catch (error) {
          await writable.abort();
          throwDirectoryError(error);
        }
      });
    },
    async readSourcePhotograph(root, relativePath) {
      const parts = normalizeRelativePath(relativePath);
      const fileName = parts.at(-1);

      if (!fileName) {
        throw new LibraryGatewayError(
          'missing',
          'OpenFilm received an empty Source photograph path.',
        );
      }

      try {
        let directory = root;

        for (const directoryName of parts.slice(0, -1)) {
          directory = await directory.getDirectoryHandle(directoryName, { create: false });
        }

        return await (await directory.getFileHandle(fileName, { create: false })).getFile();
      } catch (error) {
        throwSourceFileError(error, relativePath);
      }
    },
    async requestPermission(root) {
      const permissionRoot = root as PermissionDirectoryHandle;

      if (permissionRoot.requestPermission) {
        try {
          return permissionStateToLibraryPermission(
            await permissionRoot.requestPermission({ mode: 'readwrite' }),
          );
        } catch (error) {
          if (isDomException(error, 'NotAllowedError') || isDomException(error, 'SecurityError')) {
            return 'denied';
          }

          throw error;
        }
      }

      const picker = await this.pickDirectory();
      const sameEntry = root.isSameEntry ? await root.isSameEntry(picker) : false;

      if (!sameEntry) {
        throw new LibraryGatewayError(
          'different-folder',
          'Choose the same Library folder to restore its permission.',
        );
      }

      return this.getPermission(picker);
    },
    scanSourceFiles(root, signal) {
      return walkSourceFiles(root, '', signal);
    },
  };
}

export function isLibrarySidecarFileName(value: string): value is LibrarySidecarFileName {
  return (
    value === 'library.json' ||
    value === 'library.previous.json' ||
    value === 'library.pending.json'
  );
}
