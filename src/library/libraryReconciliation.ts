import {
  cloneOpenFilmLibraryDocument,
  sortLibraryPhotographRecords,
  type LibraryFileFingerprint,
  type LibraryPhotographRecord,
  type OpenFilmLibraryDocument,
} from './libraryModel';

export interface ReconciliationSource {
  cameraSerial?: string | null;
  captureTime?: string | null;
  fingerprint: LibraryFileFingerprint;
  mimeType: LibraryPhotographRecord['mimeType'];
  orientation?: number | null;
  relativePath: string;
}

export interface ReconciliationResult {
  ambiguous: Array<{ candidatePhotographIds: string[]; newPhotographId: string }>;
  photographs: LibraryPhotographRecord[];
  summary: {
    changed: number;
    missing: number;
    moved: number;
    new: number;
    restored: number;
    unchanged: number;
  };
}

function sameCheapFingerprint(
  first: LibraryFileFingerprint,
  second: LibraryFileFingerprint,
): boolean {
  return first.byteSize === second.byteSize && first.lastModified === second.lastModified;
}

function createRecord(source: ReconciliationSource, id: string): LibraryPhotographRecord {
  return {
    cameraSerial: source.cameraSerial ?? null,
    captureTime: source.captureTime ?? null,
    disposition: 'unmarked',
    fileName: source.relativePath.split('/').at(-1) ?? source.relativePath,
    fingerprint: { ...source.fingerprint },
    id,
    mimeType: source.mimeType,
    orientation: source.orientation ?? null,
    rating: null,
    relativePath: source.relativePath,
    sourceState: 'available',
  };
}

function relink(
  record: LibraryPhotographRecord,
  source: ReconciliationSource,
): LibraryPhotographRecord {
  return {
    ...record,
    cameraSerial: source.cameraSerial ?? record.cameraSerial,
    captureTime: source.captureTime ?? record.captureTime,
    fileName: source.relativePath.split('/').at(-1) ?? source.relativePath,
    fingerprint: { ...source.fingerprint },
    mimeType: source.mimeType,
    orientation: source.orientation ?? record.orientation,
    relativePath: source.relativePath,
    sourceState: 'available',
  };
}

export function reconcileLibrarySources(
  existing: readonly LibraryPhotographRecord[],
  sources: readonly ReconciliationSource[],
  createRecordId: () => string,
): ReconciliationResult {
  const photographs: LibraryPhotographRecord[] = existing.map((record) => ({
    ...record,
    fingerprint: { ...record.fingerprint },
    sourceState: 'missing',
  }));
  const claimed = new Set<string>();
  const ambiguous: ReconciliationResult['ambiguous'] = [];
  const summary = { changed: 0, missing: 0, moved: 0, new: 0, restored: 0, unchanged: 0 };

  for (const source of sources) {
    const samePath = photographs.find(
      (record) => !claimed.has(record.id) && record.relativePath === source.relativePath,
    );
    if (samePath && sameCheapFingerprint(samePath.fingerprint, source.fingerprint)) {
      const wasMissing =
        existing.find((record) => record.id === samePath.id)?.sourceState === 'missing';
      Object.assign(samePath, relink(samePath, source));
      claimed.add(samePath.id);
      if (wasMissing) summary.restored += 1;
      else summary.unchanged += 1;
      continue;
    }

    if (samePath) {
      summary.changed += 1;
      const created = createRecord(source, createRecordId());
      photographs.push(created);
      claimed.add(created.id);
      continue;
    }
    const hash = source.fingerprint.contentHash;
    const moveCandidates = hash
      ? photographs.filter(
          (record) =>
            !claimed.has(record.id) &&
            record.relativePath !== source.relativePath &&
            record.fingerprint.contentHash === hash,
        )
      : [];
    if (moveCandidates.length === 1) {
      Object.assign(moveCandidates[0], relink(moveCandidates[0], source));
      claimed.add(moveCandidates[0].id);
      summary.moved += 1;
      continue;
    }

    const created = createRecord(source, createRecordId());
    photographs.push(created);
    claimed.add(created.id);
    summary.new += 1;
    if (moveCandidates.length > 1) {
      ambiguous.push({
        candidatePhotographIds: moveCandidates.map((record) => record.id),
        newPhotographId: created.id,
      });
    }
  }
  summary.missing = photographs.filter((record) => record.sourceState === 'missing').length;
  return { ambiguous, photographs: sortLibraryPhotographRecords(photographs), summary };
}

export function resolveAmbiguousSource(
  result: ReconciliationResult,
  newPhotographId: string,
  chosenPhotographId: string,
): ReconciliationResult {
  const ambiguity = result.ambiguous.find((item) => item.newPhotographId === newPhotographId);
  if (!ambiguity || !ambiguity.candidatePhotographIds.includes(chosenPhotographId)) {
    throw new Error('Choose one of the recorded Source-identity candidates.');
  }
  const discovered = result.photographs.find((item) => item.id === newPhotographId);
  const chosen = result.photographs.find((item) => item.id === chosenPhotographId);
  if (!discovered || !chosen)
    throw new Error('The reconciliation candidate is no longer available.');

  const relinked: LibraryPhotographRecord = {
    ...chosen,
    cameraSerial: discovered.cameraSerial,
    captureTime: discovered.captureTime,
    fileName: discovered.fileName,
    fingerprint: { ...discovered.fingerprint },
    mimeType: discovered.mimeType,
    orientation: discovered.orientation,
    relativePath: discovered.relativePath,
    sourceState: 'available',
  };
  const photographs = result.photographs
    .filter((item) => item.id !== newPhotographId && item.id !== chosenPhotographId)
    .concat(relinked);
  const summary = {
    ...result.summary,
    missing: photographs.filter((item) => item.sourceState === 'missing').length,
    moved: result.summary.moved + 1,
    new: Math.max(0, result.summary.new - 1),
  };
  return {
    ambiguous: result.ambiguous.filter((item) => item.newPhotographId !== newPhotographId),
    photographs: sortLibraryPhotographRecords(photographs),
    summary,
  };
}

export function resolveLibrarySourceChoice(
  document: OpenFilmLibraryDocument,
  newPhotographId: string,
  chosenPhotographId: string,
): OpenFilmLibraryDocument {
  const discovered = document.photographs.find((item) => item.id === newPhotographId);
  const candidates = Array.isArray(discovered?.reconciliationCandidates)
    ? discovered.reconciliationCandidates.filter((item): item is string => typeof item === 'string')
    : [];
  if (!discovered || !candidates.includes(chosenPhotographId)) {
    throw new Error('Choose one of the recorded Source-identity candidates.');
  }
  const chosen = document.photographs.find((item) => item.id === chosenPhotographId);
  if (!chosen) throw new Error('That Source-identity candidate is no longer available.');
  const next = cloneOpenFilmLibraryDocument(document);
  const resolved: LibraryPhotographRecord = {
    ...next.photographs.find((item) => item.id === chosenPhotographId)!,
    cameraSerial: discovered.cameraSerial,
    captureTime: discovered.captureTime,
    fileName: discovered.fileName,
    fingerprint: { ...discovered.fingerprint },
    mimeType: discovered.mimeType,
    orientation: discovered.orientation,
    relativePath: discovered.relativePath,
    sourceState: 'available',
  };
  delete resolved.reconciliationCandidates;
  next.photographs = sortLibraryPhotographRecords(
    next.photographs
      .filter((item) => item.id !== newPhotographId && item.id !== chosenPhotographId)
      .concat(resolved),
  );
  return next;
}
