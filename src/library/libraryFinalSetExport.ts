import type { ExportFormat } from '../rendering/export';
import {
  DOWNLOAD_FALLBACK_LIMIT,
  createExportPlan,
  isFinalSetExportManifest,
  markExportComplete,
  markExportFailed,
  reconcileExportManifest,
  type FinalSetExportManifest,
} from './libraryExportSet';
import {
  cloneOpenFilmLibraryDocument,
  type LibraryPhotographRecord,
  type OpenFilmLibraryDocument,
} from './libraryModel';

const EXPORT_MANIFEST_PATH = 'openfilm-export-manifest.json';

export type FinalSetExportTarget = 'browser-downloads' | 'folder';
export type FinalSetExportSource =
  { kind: 'picks' } | { kind: 'selection'; photographIds: readonly string[] };

export interface FinalSetExportRequest {
  format: ExportFormat;
  quality: number;
  source: FinalSetExportSource;
  target: FinalSetExportTarget;
}

export type FinalSetExportEntryState =
  'cancelled' | 'complete' | 'download-requested' | 'failed' | 'pending' | 'rendering' | 'writing';

export interface FinalSetExportEntrySnapshot {
  destinationPath: string;
  failure: string | null;
  photographId: string;
  state: FinalSetExportEntryState;
}

export type FinalSetExportPhase =
  | 'awaiting-confirmation'
  | 'cancelled'
  | 'completed'
  | 'completed-with-failures'
  | 'failed'
  | 'idle'
  | 'paused'
  | 'preparing'
  | 'running';

export interface FinalSetExportSnapshot {
  canConfirm: boolean;
  canRetry: boolean;
  entries: readonly FinalSetExportEntrySnapshot[];
  message: string;
  phase: FinalSetExportPhase;
  source: FinalSetExportSource | null;
  target: FinalSetExportTarget | null;
}

export interface FinalSetExportResult {
  outcome: 'cancelled' | 'completed' | 'failed' | 'paused';
  snapshot: FinalSetExportSnapshot;
}

export interface FinalSetExport {
  cancel(): void;
  close(): Promise<void>;
  confirm(): void;
  getSnapshot(): FinalSetExportSnapshot;
  retry(): Promise<FinalSetExportResult>;
  start(request: FinalSetExportRequest): Promise<FinalSetExportResult>;
  subscribe(listener: () => void): () => void;
}

export interface FinalSetExportFolder {
  readonly paths: readonly string[];
  read(relativePath: string): Promise<Blob | null>;
  write(
    relativePath: string,
    bytes: Blob | Uint8Array,
    options: { overwrite: boolean },
  ): Promise<void>;
}

export interface FinalSetExportDependencies {
  chooseFolder(): Promise<FinalSetExportFolder>;
  getLibrary(): OpenFilmLibraryDocument | null;
  readSourcePhotograph(relativePath: string, signal: AbortSignal): Promise<File>;
  render(
    file: File,
    photograph: LibraryPhotographRecord,
    options: { format: ExportFormat; quality: number },
    signal: AbortSignal,
  ): Promise<Blob>;
  requestDownload(bytes: Blob, fileName: string): Promise<void>;
  checksum?(bytes: Blob): Promise<string>;
}

interface ActiveRun {
  abortController: AbortController;
  cancellationRequested: boolean;
  confirmation: ((confirmed: boolean) => void) | null;
  downloadRequested: Set<string>;
  folder: FinalSetExportFolder | null;
  frozenPhotographs: Map<string, LibraryPhotographRecord>;
  manifest: FinalSetExportManifest;
  manifestExists: boolean;
  renderingPhotographId: string | null;
  request: FinalSetExportRequest;
}

function initialSnapshot(): FinalSetExportSnapshot {
  return {
    canConfirm: false,
    canRetry: false,
    entries: [],
    message: 'Choose photographs and a destination for Final-set Export.',
    phase: 'idle',
    source: null,
    target: null,
  };
}

async function sha256(bytes: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await bytes.arrayBuffer());
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

function frozenPhotographs(
  library: OpenFilmLibraryDocument,
  source: FinalSetExportSource,
): LibraryPhotographRecord[] {
  let selected: LibraryPhotographRecord[];
  if (source.kind === 'picks') {
    selected = library.photographs.filter((photograph) => photograph.disposition === 'pick');
    if (selected.length === 0) throw new Error('This Library has no Picks to Export.');
  } else {
    if (source.photographIds.length === 0) throw new Error('The Selection is empty.');
    if (new Set(source.photographIds).size !== source.photographIds.length) {
      throw new Error('The Selection contains the same Photograph record more than once.');
    }
    selected = source.photographIds.map((id) => {
      const photograph = library.photographs.find((candidate) => candidate.id === id);
      if (!photograph) throw new Error('The Selection contains an unavailable Photograph record.');
      return photograph;
    });
  }
  const frozenLibrary = cloneOpenFilmLibraryDocument({ ...library, photographs: selected });
  return frozenLibrary.photographs;
}

function markEntriesCancelled(manifest: FinalSetExportManifest): FinalSetExportManifest {
  return {
    ...manifest,
    entries: manifest.entries.map((entry) =>
      entry.state === 'pending' || entry.state === 'writing'
        ? { ...entry, state: 'cancelled' }
        : entry,
    ),
  };
}

function resetRetryableEntries(manifest: FinalSetExportManifest): FinalSetExportManifest {
  return {
    ...manifest,
    entries: manifest.entries.map((entry) =>
      entry.state === 'failed' || entry.state === 'cancelled' || entry.state === 'writing'
        ? { ...entry, failure: null, outputChecksum: null, state: 'pending' }
        : entry,
    ),
  };
}

function sourceMatches(file: File, photograph: LibraryPhotographRecord): boolean {
  return (
    file.size === photograph.fingerprint.byteSize &&
    file.lastModified === photograph.fingerprint.lastModified
  );
}

export function createFinalSetExport(dependencies: FinalSetExportDependencies): FinalSetExport {
  let snapshot = initialSnapshot();
  let run: ActiveRun | null = null;
  let activePromise: Promise<FinalSetExportResult> | null = null;
  let closed = false;
  const listeners = new Set<() => void>();
  const checksum = dependencies.checksum ?? sha256;

  function entrySnapshots(active: ActiveRun): FinalSetExportEntrySnapshot[] {
    return active.manifest.entries.map((entry) => ({
      destinationPath: entry.destinationPath,
      failure: entry.failure,
      photographId: entry.photographId,
      state:
        active.renderingPhotographId === entry.photographId
          ? 'rendering'
          : active.request.target === 'browser-downloads' &&
              active.downloadRequested.has(entry.photographId)
            ? 'download-requested'
            : entry.state,
    }));
  }

  function publish(
    phase: FinalSetExportPhase,
    message: string,
    options: { canConfirm?: boolean; canRetry?: boolean } = {},
  ): void {
    snapshot = {
      canConfirm: options.canConfirm ?? false,
      canRetry: options.canRetry ?? false,
      entries: run ? entrySnapshots(run) : [],
      message,
      phase,
      source: run?.request.source ?? null,
      target: run?.request.target ?? null,
    };
    for (const listener of listeners) listener();
  }

  async function persistManifest(active: ActiveRun): Promise<void> {
    if (!active.folder) return;
    await active.folder.write(
      EXPORT_MANIFEST_PATH,
      new TextEncoder().encode(JSON.stringify(active.manifest, null, 2)),
      { overwrite: active.manifestExists },
    );
    active.manifestExists = true;
  }

  async function pauseForCheckpoint(error: unknown): Promise<FinalSetExportResult> {
    const message =
      error instanceof Error
        ? `Final-set Export paused because its manifest did not save. ${error.message}`
        : 'Final-set Export paused because its manifest did not save.';
    publish('paused', message, { canRetry: true });
    return { outcome: 'paused', snapshot };
  }

  async function cancelAtCheckpoint(active: ActiveRun): Promise<FinalSetExportResult> {
    active.manifest = markEntriesCancelled(active.manifest);
    try {
      await persistManifest(active);
    } catch (error) {
      return await pauseForCheckpoint(error);
    }
    publish('cancelled', 'Final-set Export cancelled at a safe checkpoint.', { canRetry: true });
    return { outcome: 'cancelled', snapshot };
  }

  async function checkpoint(active: ActiveRun): Promise<FinalSetExportResult | null> {
    try {
      await persistManifest(active);
      return null;
    } catch (error) {
      return await pauseForCheckpoint(error);
    }
  }

  async function runEntries(active: ActiveRun): Promise<FinalSetExportResult> {
    publish('running', 'Final-set Export is running.');
    const initialCheckpoint = await checkpoint(active);
    if (initialCheckpoint) return initialCheckpoint;

    for (const plannedEntry of active.manifest.entries) {
      const entry = active.manifest.entries.find(
        (candidate) => candidate.photographId === plannedEntry.photographId,
      );
      if (!entry || entry.state === 'complete') continue;
      if (active.cancellationRequested || closed) return await cancelAtCheckpoint(active);

      const photograph = active.frozenPhotographs.get(entry.photographId);
      if (!photograph || photograph.sourceState === 'missing') {
        active.manifest = markExportFailed(
          active.manifest,
          entry.photographId,
          'The Source photograph is Missing.',
        );
        publish('running', 'Final-set Export is running.');
        const failedCheckpoint = await checkpoint(active);
        if (failedCheckpoint) return failedCheckpoint;
        continue;
      }

      active.manifest = {
        ...active.manifest,
        entries: active.manifest.entries.map((candidate) =>
          candidate.photographId === entry.photographId
            ? { ...candidate, failure: null, state: 'writing' }
            : candidate,
        ),
      };
      const writingCheckpoint = await checkpoint(active);
      if (writingCheckpoint) return writingCheckpoint;

      try {
        const file = await dependencies.readSourcePhotograph(
          photograph.relativePath,
          active.abortController.signal,
        );
        if (!sourceMatches(file, photograph)) {
          throw new Error('The Source photograph changed after Final-set Export started.');
        }
        if (
          typeof photograph.fingerprint.contentHash === 'string' &&
          (await checksum(file)) !== photograph.fingerprint.contentHash
        ) {
          throw new Error('The Source photograph changed after Final-set Export started.');
        }
        active.renderingPhotographId = photograph.id;
        publish('running', `Rendering ${photograph.fileName}.`);
        const rendered = await dependencies.render(
          file,
          photograph,
          { format: entry.format, quality: entry.quality },
          active.abortController.signal,
        );
        active.renderingPhotographId = null;

        if (active.cancellationRequested || closed || active.abortController.signal.aborted) {
          return await cancelAtCheckpoint(active);
        }

        if (active.folder) {
          await active.folder.write(entry.destinationPath, rendered, { overwrite: false });
        } else {
          await dependencies.requestDownload(
            rendered,
            entry.destinationPath.split('/').at(-1) ?? entry.destinationPath,
          );
          active.downloadRequested.add(entry.photographId);
        }
        active.manifest = markExportComplete(
          active.manifest,
          entry.photographId,
          await checksum(rendered),
        );
      } catch (error) {
        active.renderingPhotographId = null;
        if (active.cancellationRequested || closed || active.abortController.signal.aborted) {
          return await cancelAtCheckpoint(active);
        }
        active.manifest = markExportFailed(
          active.manifest,
          entry.photographId,
          error instanceof Error ? error.message : 'Final-set Export failed for this photograph.',
        );
      }

      publish('running', 'Final-set Export is running.');
      const completedCheckpoint = await checkpoint(active);
      if (completedCheckpoint) return completedCheckpoint;
      if (active.cancellationRequested || closed) return await cancelAtCheckpoint(active);
    }

    const failed = active.manifest.entries.filter((entry) => entry.state === 'failed').length;
    publish(
      failed ? 'completed-with-failures' : 'completed',
      failed
        ? `Final-set Export finished with ${failed} failed photograph${failed === 1 ? '' : 's'}.`
        : active.request.target === 'browser-downloads'
          ? 'OpenFilm requested every browser download.'
          : 'Final-set Export completed.',
      { canRetry: failed > 0 },
    );
    return { outcome: 'completed', snapshot };
  }

  async function prepare(request: FinalSetExportRequest): Promise<ActiveRun> {
    const library = dependencies.getLibrary();
    if (!library) throw new Error('Open a Library before starting Final-set Export.');
    if (!Number.isFinite(request.quality) || request.quality < 0 || request.quality > 1) {
      throw new Error('Final-set Export quality must be between zero and one.');
    }
    let photographs: LibraryPhotographRecord[] = [];
    let folder: FinalSetExportFolder | null = null;
    let manifestExists = false;
    let manifest: FinalSetExportManifest;
    if (request.target === 'folder') {
      folder = await dependencies.chooseFolder();
      const storedManifestPath = folder.paths.find(
        (path) => path.toLocaleLowerCase('en-US') === EXPORT_MANIFEST_PATH,
      );
      manifestExists = Boolean(storedManifestPath);
      if (storedManifestPath) {
        const stored = await folder.read(storedManifestPath);
        const parsed: unknown = stored ? JSON.parse(await stored.text()) : null;
        if (!isFinalSetExportManifest(parsed)) {
          throw new Error('The destination contains an unsupported OpenFilm Export manifest.');
        }
        const destinationChecksums = new Map<string, string>();
        for (const entry of parsed.entries) {
          const output = await folder.read(entry.destinationPath);
          if (output) destinationChecksums.set(entry.destinationPath, await checksum(output));
        }
        manifest = reconcileExportManifest(parsed, library.photographs, destinationChecksums, {
          format: request.format,
          preserveSourceFolders: true,
          quality: request.quality,
        });
      } else {
        photographs = frozenPhotographs(library, request.source);
        manifest = createExportPlan(photographs, {
          existingDestinationPaths: new Set(folder.paths),
          format: request.format,
          preserveSourceFolders: true,
          quality: request.quality,
        });
      }
    } else {
      photographs = frozenPhotographs(library, request.source);
      if (photographs.length > DOWNLOAD_FALLBACK_LIMIT) {
        throw new Error(`Browser downloads are limited to ${DOWNLOAD_FALLBACK_LIMIT} photographs.`);
      }
      manifest = createExportPlan(photographs, {
        existingDestinationPaths: new Set(),
        format: request.format,
        preserveSourceFolders: false,
        quality: request.quality,
      });
    }

    const records = new Map(photographs.map((photograph) => [photograph.id, photograph]));
    for (const entry of manifest.entries) {
      if (records.has(entry.photographId)) continue;
      const current = library.photographs.find(
        (photograph) => photograph.id === entry.photographId,
      );
      if (current) {
        records.set(
          current.id,
          cloneOpenFilmLibraryDocument({ ...library, photographs: [current] }).photographs[0]!,
        );
      }
    }
    return {
      abortController: new AbortController(),
      cancellationRequested: false,
      confirmation: null,
      downloadRequested: new Set(),
      folder,
      frozenPhotographs: records,
      manifest,
      manifestExists,
      renderingPhotographId: null,
      request,
    };
  }

  async function startNew(request: FinalSetExportRequest): Promise<FinalSetExportResult> {
    publish('preparing', 'Preparing Final-set Export.');
    try {
      run = await prepare(request);
      if (closed || run.cancellationRequested) return await cancelAtCheckpoint(run);
      publish(
        'awaiting-confirmation',
        'Review the planned outputs, then confirm Final-set Export.',
        {
          canConfirm: true,
        },
      );
      const confirmed = await new Promise<boolean>((resolve) => {
        if (!run) return resolve(false);
        run.confirmation = resolve;
      });
      if (!run || !confirmed || run.cancellationRequested || closed) {
        return run ? await cancelAtCheckpoint(run) : { outcome: 'cancelled', snapshot };
      }
      run.confirmation = null;
      return await runEntries(run);
    } catch (error) {
      publish(
        'failed',
        error instanceof Error ? error.message : 'OpenFilm could not prepare Final-set Export.',
        { canRetry: false },
      );
      return { outcome: 'failed', snapshot };
    }
  }

  function track(task: Promise<FinalSetExportResult>): Promise<FinalSetExportResult> {
    activePromise = task;
    void task.finally(() => {
      if (activePromise === task) activePromise = null;
    });
    return task;
  }

  return {
    cancel() {
      if (!run) return;
      run.cancellationRequested = true;
      run.abortController.abort();
      run.confirmation?.(false);
      run.confirmation = null;
    },
    async close() {
      closed = true;
      this.cancel();
      if (snapshot.phase === 'preparing') return;
      await activePromise;
    },
    confirm() {
      if (!run || snapshot.phase !== 'awaiting-confirmation') return;
      run.confirmation?.(true);
      run.confirmation = null;
    },
    getSnapshot() {
      return snapshot;
    },
    async retry() {
      if (!run || !snapshot.canRetry || activePromise) {
        return { outcome: 'failed', snapshot };
      }
      run.manifest = resetRetryableEntries(run.manifest);
      run.abortController = new AbortController();
      run.cancellationRequested = false;
      run.renderingPhotographId = null;
      return await track(runEntries(run));
    },
    async start(request) {
      if (closed) {
        publish('failed', 'Open a Library before starting Final-set Export.');
        return { outcome: 'failed', snapshot };
      }
      if (activePromise) return { outcome: 'failed', snapshot };
      run = null;
      return await track(startNew(request));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
