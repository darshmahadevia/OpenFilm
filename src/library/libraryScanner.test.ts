import type { LibraryDirectoryGateway, LibrarySourceFile } from './libraryGateway';
import type { LibraryMetadataExtractor } from './libraryMetadata';
import { scanLibraryFolder } from './libraryScanner';

function createSourceFile(
  relativePath: string,
  options: { lastModified?: number; mimeType?: string; size?: number } = {},
): LibrarySourceFile {
  const fileName = relativePath.split('/').at(-1) ?? relativePath;
  const file = new File([new Uint8Array(options.size ?? 12)], fileName, {
    lastModified: options.lastModified ?? 100,
    type: options.mimeType ?? 'image/jpeg',
  });

  return { file, relativePath };
}

function createGateway(sources: LibrarySourceFile[]): LibraryDirectoryGateway {
  return {
    createFileStore: vi.fn(),
    getPermission: async () => 'granted' as const,
    inspectRecentDirectory: async () => 'available' as const,
    pickDirectory: vi.fn(),
    readSourcePhotograph: vi.fn(async (_root, relativePath) => {
      const source = sources.find((candidate) => candidate.relativePath === relativePath);

      if (!source) {
        throw new Error(`Missing Source photograph: ${relativePath}`);
      }

      return source.file;
    }),
    requestPermission: async () => 'granted' as const,
    async *scanSourceFiles() {
      yield* sources;
    },
  };
}

function createExtractor(
  metadataByFileName: Record<string, string | null>,
): LibraryMetadataExtractor {
  return {
    dispose: vi.fn(),
    extract: vi.fn(async (file) => ({
      cameraSerial: null,
      captureTime: metadataByFileName[file.name] ?? null,
      orientation: null,
    })),
  };
}

describe('Library folder scanner', () => {
  it('reports unsupported files, creates cheap fingerprints, orders records, and preserves IDs', async () => {
    const sources = [
      createSourceFile('notes.txt', { mimeType: 'text/plain' }),
      createSourceFile('first.webp', { lastModified: 101, mimeType: 'image/webp' }),
      createSourceFile('nested/later.jpg', { lastModified: 102 }),
      createSourceFile('unknown.png', { lastModified: 103, mimeType: 'image/png' }),
    ];
    const extractor = createExtractor({
      'first.webp': '2024-03-05T14:00:00',
      'later.jpg': '2024-03-05T15:00:00',
    });
    const progressStatuses: string[] = [];
    const first = await scanLibraryFolder({} as FileSystemDirectoryHandle, createGateway(sources), {
      createRecordId: (() => {
        let index = 0;
        return () => `photograph-${++index}`;
      })(),
      metadataExtractor: extractor,
      onProgress: (state) => progressStatuses.push(state.status),
      yieldToBrowser: async () => undefined,
    });

    expect(first.status).toBe('complete');
    expect(first.progress).toMatchObject({
      discoveredFiles: 4,
      processedFiles: 4,
      supportedFiles: 3,
      unsupportedFiles: 1,
    });
    expect(first.unsupportedFiles).toEqual([
      { extension: '.txt', reason: 'unsupported-format', relativePath: 'notes.txt' },
    ]);
    expect(first.photographs.map((record) => record.relativePath)).toEqual([
      'first.webp',
      'nested/later.jpg',
      'unknown.png',
    ]);
    expect(first.photographs[0]).toMatchObject({
      disposition: 'unmarked',
      fingerprint: { byteSize: 12, lastModified: 101 },
      id: 'photograph-1',
      relativePath: 'first.webp',
      sourceState: 'available',
    });
    expect(first.photographs[0]).not.toHaveProperty('source');
    expect(progressStatuses).toContain('scanning');
    expect(progressStatuses.at(-1)).toBe('complete');

    const second = await scanLibraryFolder(
      {} as FileSystemDirectoryHandle,
      createGateway(sources),
      {
        createRecordId: () => 'should-not-be-used',
        existingPhotographs: first.photographs,
        metadataExtractor: createExtractor({
          'first.webp': '2024-03-05T14:00:00',
          'later.jpg': '2024-03-05T15:00:00',
        }),
        yieldToBrowser: async () => undefined,
      },
    );

    expect(second.photographs.map((record) => record.id)).toEqual([
      'photograph-1',
      'photograph-2',
      'photograph-3',
    ]);
  });

  it('keeps a changed path as a Missing photograph and creates a new record', async () => {
    const original = createSourceFile('same.jpg', { lastModified: 100, size: 12 });
    const initial = await scanLibraryFolder(
      {} as FileSystemDirectoryHandle,
      createGateway([original]),
      {
        createRecordId: () => 'old-record',
        metadataExtractor: createExtractor({ 'same.jpg': '2024-03-05T14:00:00' }),
        yieldToBrowser: async () => undefined,
      },
    );
    const changed = createSourceFile('same.jpg', { lastModified: 200, size: 16 });
    const refreshed = await scanLibraryFolder(
      {} as FileSystemDirectoryHandle,
      createGateway([changed]),
      {
        createRecordId: () => 'new-record',
        existingPhotographs: initial.photographs,
        metadataExtractor: createExtractor({ 'same.jpg': '2024-03-06T14:00:00' }),
        yieldToBrowser: async () => undefined,
      },
    );

    expect(refreshed.photographs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'new-record', sourceState: 'available' }),
        expect.objectContaining({ id: 'old-record', sourceState: 'missing' }),
      ]),
    );
  });

  it('relinks a moved Source only after an explicit refresh has cached one unique content hash', async () => {
    const initial = await scanLibraryFolder(
      {} as FileSystemDirectoryHandle,
      createGateway([createSourceFile('before.jpg', { lastModified: 100, size: 12 })]),
      {
        cacheContentHashes: true,
        createRecordId: () => 'stable-record',
        metadataExtractor: createExtractor({}),
        yieldToBrowser: async () => undefined,
      },
    );
    expect(initial.photographs[0].fingerprint.contentHash).toMatch(/^[a-f0-9]{64}$/);

    const moved = await scanLibraryFolder(
      {} as FileSystemDirectoryHandle,
      createGateway([createSourceFile('after.jpg', { lastModified: 200, size: 12 })]),
      {
        cacheContentHashes: true,
        createRecordId: () => 'should-not-be-used',
        existingPhotographs: initial.photographs,
        metadataExtractor: createExtractor({}),
        yieldToBrowser: async () => undefined,
      },
    );
    expect(moved.photographs).toMatchObject([
      { id: 'stable-record', relativePath: 'after.jpg', sourceState: 'available' },
    ]);
  });

  it('returns a cancellable partial result while the scan is in progress', async () => {
    const controller = new AbortController();
    const sources = [
      createSourceFile('one.jpg'),
      createSourceFile('two.jpg'),
      createSourceFile('three.jpg'),
    ];
    const statuses: string[] = [];
    const result = await scanLibraryFolder(
      {} as FileSystemDirectoryHandle,
      createGateway(sources),
      {
        createRecordId: (() => {
          let index = 0;
          return () => `record-${++index}`;
        })(),
        metadataExtractor: createExtractor({}),
        onProgress: (state) => {
          statuses.push(state.status);

          if (state.progress.processedFiles === 1) {
            controller.abort();
          }
        },
        signal: controller.signal,
        yieldToBrowser: async () => undefined,
      },
    );

    expect(result.status).toBe('cancelled');
    expect(result.photographs).toHaveLength(1);
    expect(statuses.at(-1)).toBe('cancelled');
  });
});
