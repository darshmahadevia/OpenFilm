import type { ExportFormat } from '../rendering/export';
import { getLibraryEdit } from './libraryReview';
import type { LibraryFileFingerprint, LibraryPhotographRecord } from './libraryModel';

export const EXPORT_RENDERER_VERSION = 'webgl2-openfilm-v2';
export const DOWNLOAD_FALLBACK_LIMIT = 12;

export interface FinalSetExportSettings {
  existingDestinationPaths: ReadonlySet<string>;
  format: ExportFormat;
  preserveSourceFolders: boolean;
  quality: number;
}

export type ExportEntryState = 'cancelled' | 'complete' | 'failed' | 'pending' | 'writing';

export interface FinalSetExportEntry {
  destinationPath: string;
  editRevision: number;
  failure: string | null;
  format: ExportFormat;
  outputChecksum: string | null;
  photographId: string;
  quality: number;
  rendererVersion: string;
  sourceFingerprint: LibraryFileFingerprint;
  sourcePath: string;
  state: ExportEntryState;
}

export interface FinalSetExportManifest {
  entries: FinalSetExportEntry[];
  fidelity: 'sRGB-assumed; metadata stripped; not an archival or print-fidelity export';
  format: 'openfilm.export-manifest';
  renderer: { name: 'OpenFilm WebGL2 renderer'; version: string };
  schemaVersion: 1;
  settings: {
    format: ExportFormat;
    preserveSourceFolders: boolean;
    quality: number;
  };
}

function extensionFor(format: ExportFormat): string {
  return format === 'jpeg' ? 'jpg' : format;
}

function withoutExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function uniqueDestinationPath(preferred: string, reserved: Set<string>): string {
  if (!reserved.has(preferred.toLocaleLowerCase('en-US'))) {
    reserved.add(preferred.toLocaleLowerCase('en-US'));
    return preferred;
  }
  const slash = preferred.lastIndexOf('/');
  const directory = slash >= 0 ? preferred.slice(0, slash + 1) : '';
  const fileName = slash >= 0 ? preferred.slice(slash + 1) : preferred;
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const extension = dot > 0 ? fileName.slice(dot) : '';
  let collision = 2;
  while (reserved.has(`${directory}${base}-${collision}${extension}`.toLocaleLowerCase('en-US'))) {
    collision += 1;
  }
  const path = `${directory}${base}-${collision}${extension}`;
  reserved.add(path.toLocaleLowerCase('en-US'));
  return path;
}

export function createExportPlan(
  photographs: readonly LibraryPhotographRecord[],
  settings: FinalSetExportSettings,
): FinalSetExportManifest {
  const reserved = new Set(
    [...settings.existingDestinationPaths].map((path) => path.toLocaleLowerCase('en-US')),
  );
  const extension = extensionFor(settings.format);
  const entries = photographs.map((photograph): FinalSetExportEntry => {
    const pathParts = photograph.relativePath.split('/');
    const outputName = `${withoutExtension(pathParts.at(-1) ?? photograph.fileName)}.${extension}`;
    const preferred =
      settings.preserveSourceFolders && pathParts.length > 1
        ? `${pathParts.slice(0, -1).join('/')}/${outputName}`
        : outputName;
    return {
      destinationPath: uniqueDestinationPath(preferred, reserved),
      editRevision: getLibraryEdit(photograph).revision,
      failure: null,
      format: settings.format,
      outputChecksum: null,
      photographId: photograph.id,
      quality: Math.min(1, Math.max(0, settings.quality)),
      rendererVersion: EXPORT_RENDERER_VERSION,
      sourceFingerprint: { ...photograph.fingerprint },
      sourcePath: photograph.relativePath,
      state: photograph.sourceState === 'missing' ? 'failed' : 'pending',
    };
  });
  for (const entry of entries) {
    if (entry.state === 'failed') entry.failure = 'The Source photograph is Missing.';
  }
  return {
    entries,
    fidelity: 'sRGB-assumed; metadata stripped; not an archival or print-fidelity export',
    format: 'openfilm.export-manifest',
    renderer: { name: 'OpenFilm WebGL2 renderer', version: EXPORT_RENDERER_VERSION },
    schemaVersion: 1,
    settings: {
      format: settings.format,
      preserveSourceFolders: settings.preserveSourceFolders,
      quality: Math.min(1, Math.max(0, settings.quality)),
    },
  };
}

export function isFinalSetExportManifest(value: unknown): value is FinalSetExportManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const manifest = value as Partial<FinalSetExportManifest>;
  return Boolean(
    manifest.format === 'openfilm.export-manifest' &&
    manifest.schemaVersion === 1 &&
    manifest.fidelity ===
      'sRGB-assumed; metadata stripped; not an archival or print-fidelity export' &&
    manifest.renderer?.name === 'OpenFilm WebGL2 renderer' &&
    manifest.renderer.version === EXPORT_RENDERER_VERSION &&
    manifest.settings &&
    (manifest.settings.format === 'jpeg' ||
      manifest.settings.format === 'png' ||
      manifest.settings.format === 'webp') &&
    typeof manifest.settings.preserveSourceFolders === 'boolean' &&
    typeof manifest.settings.quality === 'number' &&
    manifest.settings.quality >= 0 &&
    manifest.settings.quality <= 1 &&
    Array.isArray(manifest.entries) &&
    manifest.entries.every(
      (entry) =>
        entry &&
        typeof entry.destinationPath === 'string' &&
        typeof entry.photographId === 'string' &&
        typeof entry.sourcePath === 'string' &&
        typeof entry.editRevision === 'number' &&
        Number.isSafeInteger(entry.editRevision) &&
        entry.editRevision >= 0 &&
        (entry.failure === null || typeof entry.failure === 'string') &&
        (entry.format === 'jpeg' || entry.format === 'png' || entry.format === 'webp') &&
        (entry.outputChecksum === null || typeof entry.outputChecksum === 'string') &&
        typeof entry.quality === 'number' &&
        Number.isFinite(entry.quality) &&
        entry.quality >= 0 &&
        entry.quality <= 1 &&
        entry.rendererVersion === EXPORT_RENDERER_VERSION &&
        entry.sourceFingerprint &&
        Number.isSafeInteger(entry.sourceFingerprint.byteSize) &&
        entry.sourceFingerprint.byteSize >= 0 &&
        Number.isFinite(entry.sourceFingerprint.lastModified) &&
        (entry.sourceFingerprint.contentHash === undefined ||
          typeof entry.sourceFingerprint.contentHash === 'string') &&
        (entry.state === 'cancelled' ||
          entry.state === 'complete' ||
          entry.state === 'failed' ||
          entry.state === 'pending' ||
          entry.state === 'writing'),
    ),
  );
}

function sameFingerprint(first: LibraryFileFingerprint, second: LibraryFileFingerprint): boolean {
  return (
    first.byteSize === second.byteSize &&
    first.lastModified === second.lastModified &&
    first.contentHash === second.contentHash
  );
}

export function markExportComplete(
  manifest: FinalSetExportManifest,
  photographId: string,
  outputChecksum: string,
): FinalSetExportManifest {
  return {
    ...manifest,
    entries: manifest.entries.map((entry) =>
      entry.photographId === photographId
        ? { ...entry, failure: null, outputChecksum, state: 'complete' }
        : entry,
    ),
  };
}

export function markExportFailed(
  manifest: FinalSetExportManifest,
  photographId: string,
  failure: string,
): FinalSetExportManifest {
  return {
    ...manifest,
    entries: manifest.entries.map((entry) =>
      entry.photographId === photographId ? { ...entry, failure, state: 'failed' } : entry,
    ),
  };
}

export function reconcileExportManifest(
  manifest: FinalSetExportManifest,
  photographs: readonly LibraryPhotographRecord[],
  destinationChecksums: ReadonlyMap<string, string>,
  currentSettings: FinalSetExportManifest['settings'] = manifest.settings,
): FinalSetExportManifest {
  const reserved = new Set(
    [...destinationChecksums.keys()].map((path) => path.toLocaleLowerCase('en-US')),
  );
  return {
    ...manifest,
    entries: manifest.entries.map((entry) => {
      const photograph = photographs.find((candidate) => candidate.id === entry.photographId);
      const valid = Boolean(
        photograph &&
        manifest.renderer.version === EXPORT_RENDERER_VERSION &&
        entry.format === currentSettings.format &&
        entry.quality === currentSettings.quality &&
        manifest.settings.preserveSourceFolders === currentSettings.preserveSourceFolders &&
        photograph.sourceState === 'available' &&
        sameFingerprint(photograph.fingerprint, entry.sourceFingerprint) &&
        getLibraryEdit(photograph).revision === entry.editRevision &&
        entry.rendererVersion === EXPORT_RENDERER_VERSION &&
        entry.outputChecksum &&
        destinationChecksums.get(entry.destinationPath) === entry.outputChecksum,
      );
      if (valid) return entry;
      const occupied = destinationChecksums.has(entry.destinationPath);
      return {
        ...entry,
        destinationPath: occupied
          ? uniqueDestinationPath(entry.destinationPath, reserved)
          : entry.destinationPath,
        failure: null,
        outputChecksum: null,
        state: 'pending',
      };
    }),
  };
}
