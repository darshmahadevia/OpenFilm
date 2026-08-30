import { createEmptyLibraryDocument, type LibraryPhotographRecord } from './libraryModel';
import { createExportPlan } from './libraryExportSet';
import { createFinalSetExport, type FinalSetExportFolder } from './libraryFinalSetExport';

function photograph(id: string, disposition: LibraryPhotographRecord['disposition'] = 'pick') {
  return {
    cameraSerial: null,
    captureTime: null,
    disposition,
    edit: {
      adjustments: { exposure: 1 },
      geometry: { rotation: 0 },
      grainSeed: 7,
      revision: 2,
    },
    fileName: `${id}.jpg`,
    fingerprint: { byteSize: 6, lastModified: 10 },
    id,
    mimeType: 'image/jpeg' as const,
    orientation: null,
    rating: null,
    relativePath: `${id}.jpg`,
    sourceState: 'available' as const,
  } satisfies LibraryPhotographRecord;
}

function libraryWith(...photographs: LibraryPhotographRecord[]) {
  return { ...createEmptyLibraryDocument('Shoot'), photographs };
}

function memoryFolder(paths: string[] = []): FinalSetExportFolder & { files: Map<string, Blob> } {
  const files = new Map<string, Blob>();
  return {
    files,
    paths,
    async read(path) {
      return files.get(path) ?? null;
    },
    async write(path, bytes, options) {
      if (!options.overwrite && files.has(path)) throw new Error(`${path} already exists.`);
      files.set(
        path,
        bytes instanceof Blob ? bytes : new Blob([bytes.slice().buffer as ArrayBuffer]),
      );
    },
  };
}

describe('Final-set Export module', () => {
  it('freezes a Selection and reports browser handoffs without claiming completion', async () => {
    let library = libraryWith(photograph('one', 'unmarked'), photograph('two', 'unmarked'));
    const renderedEdits: unknown[] = [];
    const downloads: string[] = [];
    const finalSetExport = createFinalSetExport({
      chooseFolder: async () => memoryFolder(),
      getLibrary: () => library,
      readSourcePhotograph: async (path) =>
        new File(['source'], path, { lastModified: 10, type: 'image/jpeg' }),
      render: async (_file, frozenPhotograph) => {
        renderedEdits.push(frozenPhotograph.edit);
        return new Blob(['rendered'], { type: 'image/jpeg' });
      },
      requestDownload: async (_bytes, fileName) => {
        downloads.push(fileName);
      },
    });

    const resultPromise = finalSetExport.start({
      format: 'jpeg',
      quality: 0.92,
      source: { kind: 'selection', photographIds: ['two', 'one'] },
      target: 'browser-downloads',
    });

    await vi.waitFor(() =>
      expect(finalSetExport.getSnapshot()).toMatchObject({
        phase: 'awaiting-confirmation',
        entries: [{ photographId: 'two' }, { photographId: 'one' }],
      }),
    );

    library = libraryWith(
      { ...photograph('one', 'unmarked'), edit: { revision: 99 } },
      { ...photograph('two', 'unmarked'), edit: { revision: 99 } },
    );
    finalSetExport.confirm();

    await expect(resultPromise).resolves.toMatchObject({ outcome: 'completed' });
    expect(downloads).toEqual(['two.jpg', 'one.jpg']);
    expect(renderedEdits).toEqual([
      expect.objectContaining({ revision: 2 }),
      expect.objectContaining({ revision: 2 }),
    ]);
    expect(finalSetExport.getSnapshot()).toMatchObject({
      phase: 'completed',
      entries: [
        { photographId: 'two', state: 'download-requested' },
        { photographId: 'one', state: 'download-requested' },
      ],
    });
  });

  it('fails a changed Source photograph and continues the run', async () => {
    const downloads: string[] = [];
    const finalSetExport = createFinalSetExport({
      chooseFolder: async () => memoryFolder(),
      getLibrary: () => libraryWith(photograph('changed'), photograph('stable')),
      readSourcePhotograph: async (path) =>
        new File([path === 'changed.jpg' ? 'changed' : 'source'], path, {
          lastModified: 10,
          type: 'image/jpeg',
        }),
      render: async () => new Blob(['rendered'], { type: 'image/jpeg' }),
      requestDownload: async (_bytes, fileName) => {
        downloads.push(fileName);
      },
    });

    const resultPromise = finalSetExport.start({
      format: 'jpeg',
      quality: 0.92,
      source: { kind: 'picks' },
      target: 'browser-downloads',
    });
    await vi.waitFor(() =>
      expect(finalSetExport.getSnapshot().phase).toBe('awaiting-confirmation'),
    );
    finalSetExport.confirm();

    await expect(resultPromise).resolves.toMatchObject({ outcome: 'completed' });
    expect(downloads).toEqual(['stable.jpg']);
    expect(finalSetExport.getSnapshot()).toMatchObject({
      phase: 'completed-with-failures',
      entries: [
        {
          failure: 'The Source photograph changed after Final-set Export started.',
          photographId: 'changed',
          state: 'failed',
        },
        { photographId: 'stable', state: 'download-requested' },
      ],
    });
  });

  it('pauses on a manifest checkpoint failure and retries the frozen run', async () => {
    const folder = memoryFolder();
    let failManifest = true;
    const write = folder.write.bind(folder);
    folder.write = async (path, bytes, options) => {
      if (path === 'openfilm-export-manifest.json' && failManifest) {
        failManifest = false;
        throw new Error('Injected manifest failure.');
      }
      await write(path, bytes, options);
    };
    const finalSetExport = createFinalSetExport({
      chooseFolder: async () => folder,
      getLibrary: () => libraryWith(photograph('one')),
      readSourcePhotograph: async (path) =>
        new File(['source'], path, { lastModified: 10, type: 'image/jpeg' }),
      render: async () => new Blob(['rendered'], { type: 'image/jpeg' }),
      requestDownload: async () => undefined,
    });

    const resultPromise = finalSetExport.start({
      format: 'jpeg',
      quality: 0.92,
      source: { kind: 'picks' },
      target: 'folder',
    });
    await vi.waitFor(() =>
      expect(finalSetExport.getSnapshot().phase).toBe('awaiting-confirmation'),
    );
    finalSetExport.confirm();

    await expect(resultPromise).resolves.toMatchObject({ outcome: 'paused' });
    expect(finalSetExport.getSnapshot()).toMatchObject({ phase: 'paused', canRetry: true });

    await expect(finalSetExport.retry()).resolves.toMatchObject({ outcome: 'completed' });
    expect([...folder.files.keys()].sort()).toEqual(['one.jpg', 'openfilm-export-manifest.json']);
    expect(finalSetExport.getSnapshot()).toMatchObject({
      phase: 'completed',
      entries: [{ photographId: 'one', state: 'complete' }],
    });
  });

  it('starts folder resume from current Edits even when the current source set is empty', async () => {
    const previous = photograph('one');
    const manifest = createExportPlan([previous], {
      existingDestinationPaths: new Set(),
      format: 'jpeg',
      preserveSourceFolders: true,
      quality: 0.92,
    });
    const folder = memoryFolder(['openfilm-export-manifest.json']);
    folder.files.set(
      'openfilm-export-manifest.json',
      new Blob([JSON.stringify(manifest)], { type: 'application/json' }),
    );
    const current = {
      ...photograph('one', 'unmarked'),
      edit: { revision: 99 },
    } satisfies LibraryPhotographRecord;
    const renderedRevisions: unknown[] = [];
    const finalSetExport = createFinalSetExport({
      chooseFolder: async () => folder,
      getLibrary: () => libraryWith(current),
      readSourcePhotograph: async (path) =>
        new File(['source'], path, { lastModified: 10, type: 'image/jpeg' }),
      render: async (_file, frozenPhotograph) => {
        renderedRevisions.push((frozenPhotograph.edit as { revision: number }).revision);
        return new Blob(['rendered'], { type: 'image/jpeg' });
      },
      requestDownload: async () => undefined,
    });

    const resultPromise = finalSetExport.start({
      format: 'jpeg',
      quality: 0.92,
      source: { kind: 'picks' },
      target: 'folder',
    });
    await vi.waitFor(() =>
      expect(finalSetExport.getSnapshot().phase).toBe('awaiting-confirmation'),
    );
    finalSetExport.confirm();

    await expect(resultPromise).resolves.toMatchObject({ outcome: 'completed' });
    expect(renderedRevisions).toEqual([99]);
  });

  it('cancels rendering and persists cancellation at a safe checkpoint', async () => {
    const folder = memoryFolder();
    const finalSetExport = createFinalSetExport({
      chooseFolder: async () => folder,
      getLibrary: () => libraryWith(photograph('one'), photograph('two')),
      readSourcePhotograph: async (path) =>
        new File(['source'], path, { lastModified: 10, type: 'image/jpeg' }),
      render: async (_file, _photograph, _options, signal) =>
        await new Promise<Blob>((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Cancelled.', 'AbortError')),
            { once: true },
          );
        }),
      requestDownload: async () => undefined,
    });

    const resultPromise = finalSetExport.start({
      format: 'jpeg',
      quality: 0.92,
      source: { kind: 'picks' },
      target: 'folder',
    });
    await vi.waitFor(() =>
      expect(finalSetExport.getSnapshot().phase).toBe('awaiting-confirmation'),
    );
    finalSetExport.confirm();
    await vi.waitFor(() =>
      expect(finalSetExport.getSnapshot().entries[0]?.state).toBe('rendering'),
    );
    finalSetExport.cancel();

    await expect(resultPromise).resolves.toMatchObject({ outcome: 'cancelled' });
    expect(finalSetExport.getSnapshot()).toMatchObject({
      phase: 'cancelled',
      entries: [
        { photographId: 'one', state: 'cancelled' },
        { photographId: 'two', state: 'cancelled' },
      ],
    });
    const stored = JSON.parse(await folder.files.get('openfilm-export-manifest.json')!.text()) as {
      entries: { state: string }[];
    };
    expect(stored.entries.map((entry) => entry.state)).toEqual(['cancelled', 'cancelled']);
  });
});
