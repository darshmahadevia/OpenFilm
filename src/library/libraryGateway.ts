import { LIBRARY_SIDECAR_DIRECTORY, type LibrarySidecarFileName } from './libraryFile';
import {
  createBrowserLibraryFileStore,
  createMemoryLibraryFileStore,
  type LibraryFileStore,
  type LibraryPermissionState,
  type MemoryLibraryFileStore,
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

interface BrowserLibraryDirectoryHandle extends FileSystemDirectoryHandle {
  readonly openfilmBrowserDirectory: true;
  readonly sourceFiles: ReadonlyMap<string, File>;
  readonly store: MemoryLibraryFileStore;
}

export function isBrowserLibraryDirectory(
  root: FileSystemDirectoryHandle,
): root is BrowserLibraryDirectoryHandle {
  return (root as Partial<BrowserLibraryDirectoryHandle>).openfilmBrowserDirectory === true;
}

export function getBrowserLibraryFile(root: FileSystemDirectoryHandle): Uint8Array | null {
  return isBrowserLibraryDirectory(root) ? root.store.bytes('library.json') : null;
}

export function restoreBrowserLibraryFile(
  root: FileSystemDirectoryHandle,
  bytes: Uint8Array,
): Promise<void> {
  if (!isBrowserLibraryDirectory(root)) {
    throw new Error('The selected folder does not use browser Library storage.');
  }
  return root.store.write('library.json', bytes);
}

export function countBrowserLibrarySourceMatches(
  root: FileSystemDirectoryHandle,
  photographs: readonly {
    fingerprint: { byteSize: number; lastModified: number };
    relativePath: string;
  }[],
): number {
  if (!isBrowserLibraryDirectory(root)) return 0;
  return photographs.reduce((count, photograph) => {
    const file = root.sourceFiles.get(photograph.relativePath);
    return file &&
      file.size === photograph.fingerprint.byteSize &&
      file.lastModified === photograph.fingerprint.lastModified
      ? count + 1
      : count;
  }, 0);
}

function createBrowserLibraryDirectory(
  rootName: string,
  sourceFiles: Map<string, File>,
  sidecars: Partial<Record<LibrarySidecarFileName, Uint8Array>>,
): BrowserLibraryDirectoryHandle {
  return {
    kind: 'directory',
    name: rootName,
    openfilmBrowserDirectory: true,
    sourceFiles,
    store: createMemoryLibraryFileStore(sidecars),
  } as unknown as BrowserLibraryDirectoryHandle;
}

function pickBrowserLibraryDirectory(): Promise<FileSystemDirectoryHandle> {
  if (typeof document === 'undefined') {
    return Promise.reject(
      new LibraryGatewayError('unsupported', 'This browser cannot open a folder.'),
    );
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.hidden = true;

    const finish = () => input.remove();
    input.addEventListener(
      'cancel',
      () => {
        finish();
        reject(new LibraryPickerCancelledError());
      },
      { once: true },
    );
    input.addEventListener(
      'change',
      () => {
        void (async () => {
          const files = Array.from(input.files ?? []);
          if (files.length === 0) {
            finish();
            reject(new LibraryPickerCancelledError());
            return;
          }

          const firstPath = files[0]?.webkitRelativePath || files[0]?.name || '';
          const pathParts = firstPath.split('/').filter(Boolean);
          const rootName = pathParts.length > 1 ? pathParts[0]! : 'Selected folder';
          const sources = new Map<string, File>();
          const sidecars: Partial<Record<LibrarySidecarFileName, Uint8Array>> = {};

          for (const file of files) {
            const selectedPath = file.webkitRelativePath || file.name;
            const selectedParts = selectedPath.split('/').filter(Boolean);
            const relativePath =
              selectedParts.length > 1 ? selectedParts.slice(1).join('/') : selectedPath;

            if (relativePath.startsWith(`${LIBRARY_SIDECAR_DIRECTORY}/`)) {
              const fileName = relativePath.slice(LIBRARY_SIDECAR_DIRECTORY.length + 1);
              if (isLibrarySidecarFileName(fileName)) {
                sidecars[fileName] = new Uint8Array(await file.arrayBuffer());
              }
              continue;
            }

            sources.set(relativePath, file);
          }

          finish();
          resolve(createBrowserLibraryDirectory(rootName, sources, sidecars));
        })().catch((error: unknown) => {
          finish();
          reject(
            error instanceof Error
              ? error
              : new Error('OpenFilm could not read the selected folder.'),
          );
        });
      },
      { once: true },
    );

    document.body.append(input);
    input.click();
  });
}

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
      return isBrowserLibraryDirectory(root) ? root.store : createBrowserLibraryFileStore(root);
    },
    async getPermission(root) {
      if (isBrowserLibraryDirectory(root)) return 'granted';
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
      if (isBrowserLibraryDirectory(root)) return 'available';
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

      if (!picker) return await pickBrowserLibraryDirectory();

      try {
        return await picker({ mode: 'readwrite' });
      } catch (error) {
        throwDirectoryError(error);
      }
    },
    async pickExportDirectory() {
      const picker = getPicker();
      if (!picker) {
        throw new LibraryGatewayError(
          'unsupported',
          'This browser cannot authorize an Export folder. Use the download fallback.',
        );
      }
      try {
        return await picker({ mode: 'readwrite' });
      } catch (error) {
        throwDirectoryError(error);
      }
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
      if (isBrowserLibraryDirectory(root)) {
        const file = root.sourceFiles.get(relativePath);
        if (file) return file;
        throw new LibraryGatewayError(
          'missing',
          `The Source photograph at ${relativePath} is no longer available in this selected folder.`,
        );
      }
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
      if (isBrowserLibraryDirectory(root)) return 'granted';
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
      if (isBrowserLibraryDirectory(root)) {
        return (async function* () {
          for (const [relativePath, file] of root.sourceFiles) {
            if (signal?.aborted) return;
            yield { file, relativePath };
          }
        })();
      }
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
