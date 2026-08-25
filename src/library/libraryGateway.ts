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

export type LibraryDirectoryAvailability = 'available' | 'missing' | 'permission-denied';

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
  requestPermission(root: FileSystemDirectoryHandle): Promise<LibraryPermissionState>;
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
  };
}

export function isLibrarySidecarFileName(value: string): value is LibrarySidecarFileName {
  return (
    value === 'library.json' ||
    value === 'library.previous.json' ||
    value === 'library.pending.json'
  );
}
