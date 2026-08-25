import { createBrowserLibraryDirectoryGateway } from './libraryGateway';

function createDirectoryHandle(name: string, permission: PermissionState = 'granted') {
  const handle = {
    getDirectoryHandle: vi.fn(async () => handle),
    getFileHandle: vi.fn(),
    kind: 'directory' as const,
    name,
    queryPermission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => 'granted' as PermissionState),
  } as unknown as FileSystemDirectoryHandle & {
    getDirectoryHandle: ReturnType<typeof vi.fn>;
    queryPermission: ReturnType<typeof vi.fn>;
    requestPermission: ReturnType<typeof vi.fn>;
  };

  return handle;
}

describe('browser Library gateway', () => {
  it('opens the system folder picker in readwrite mode', async () => {
    const root = createDirectoryHandle('June shoot');
    const picker = vi.fn(async () => root);
    const originalPicker = (
      window as Window & {
        showDirectoryPicker?: (options?: {
          mode?: 'read' | 'readwrite';
        }) => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker;

    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: picker,
    });

    try {
      const gateway = createBrowserLibraryDirectoryGateway();

      await expect(gateway?.pickDirectory()).resolves.toBe(root);
      expect(picker).toHaveBeenCalledWith({ mode: 'readwrite' });
    } finally {
      Object.defineProperty(window, 'showDirectoryPicker', {
        configurable: true,
        value: originalPicker,
      });
    }
  });

  it('requests permission on the existing directory handle during recovery', async () => {
    const root = createDirectoryHandle('June shoot', 'prompt');
    const gateway = createBrowserLibraryDirectoryGateway();

    await expect(gateway?.requestPermission(root)).resolves.toBe('granted');
    expect(root.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
  });

  it('distinguishes an unavailable sidecar directory from a permission denial', async () => {
    const missing = createDirectoryHandle('Missing shoot');
    missing.getDirectoryHandle.mockRejectedValue(
      Object.assign(new Error('Folder is gone'), { name: 'NotFoundError' }),
    );
    const denied = createDirectoryHandle('Private shoot');
    denied.queryPermission.mockResolvedValue('denied');
    const gateway = createBrowserLibraryDirectoryGateway();

    await expect(gateway?.inspectRecentDirectory(missing)).resolves.toBe('missing');
    await expect(gateway?.inspectRecentDirectory(denied)).resolves.toBe('permission-denied');
  });

  it('walks nested Source photographs, skips the Library sidecars, and reads by relative path', async () => {
    const nestedFile = {
      getFile: vi.fn(async () => new File(['nested'], 'photo.jpg', { type: 'image/jpeg' })),
      kind: 'file' as const,
    };
    const nested = createDirectoryHandle('nested') as unknown as FileSystemDirectoryHandle & {
      entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
    };
    const sidecar = createDirectoryHandle('.openfilm');
    const rootFile = {
      getFile: vi.fn(async () => new File(['root'], 'root.webp', { type: 'image/webp' })),
      kind: 'file' as const,
    };
    const root = createDirectoryHandle('June shoot') as unknown as FileSystemDirectoryHandle & {
      entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
    };

    nested.entries = async function* () {
      yield ['photo.jpg', nestedFile as unknown as FileSystemFileHandle];
    };
    root.entries = async function* () {
      yield ['.openfilm', sidecar];
      yield ['nested', nested];
      yield ['root.webp', rootFile as unknown as FileSystemFileHandle];
    };
    root.getDirectoryHandle = vi.fn(async (name) => {
      if (name === 'nested') {
        return nested;
      }

      return sidecar;
    });
    nested.getFileHandle = vi.fn(async () => nestedFile as unknown as FileSystemFileHandle);

    const gateway = createBrowserLibraryDirectoryGateway();
    const sources = [];

    for await (const source of gateway!.scanSourceFiles(root)) {
      sources.push(source);
    }

    expect(sources.map((source) => source.relativePath)).toEqual(['nested/photo.jpg', 'root.webp']);
    await expect(gateway?.readSourcePhotograph(root, 'nested/photo.jpg')).resolves.toMatchObject({
      name: 'photo.jpg',
      type: 'image/jpeg',
    });
  });

  it('serializes no-overwrite Export writes so concurrent callers cannot claim one path', async () => {
    let exists = false;
    const writable = {
      abort: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
      write: vi.fn(async () => undefined),
    };
    const file = {
      createWritable: vi.fn(async () => writable),
      getFile: vi.fn(),
      isSameEntry: vi.fn(),
      kind: 'file' as const,
      name: 'frame.jpg',
    } as unknown as FileSystemFileHandle;
    const root = createDirectoryHandle('Export') as unknown as FileSystemDirectoryHandle & {
      getFileHandle: ReturnType<typeof vi.fn>;
    };
    root.getFileHandle = vi.fn(async (_name: string, options?: { create?: boolean }) => {
      if (!options?.create && !exists) {
        throw Object.assign(new Error('Missing'), { name: 'NotFoundError' });
      }
      if (options?.create) exists = true;
      return file;
    });
    const gateway = createBrowserLibraryDirectoryGateway()!;

    const results = await Promise.allSettled([
      gateway.writeExportFile!(root, 'frame.jpg', new Uint8Array([1])),
      gateway.writeExportFile!(root, 'frame.jpg', new Uint8Array([2])),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(writable.write).toHaveBeenCalledOnce();
  });
});
