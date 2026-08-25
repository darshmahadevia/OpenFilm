import { neutralAdjustments, type AdjustmentValues } from '../editor/adjustments';
import { DEFAULT_GRAIN_SEED } from '../editor/grain';
import { neutralGeometry, type GeometryValues } from '../editor/geometry';
import type { JsonValue } from './libraryFile';
import {
  cloneOpenFilmLibraryDocument,
  type LibraryPhotographDisposition,
  type LibraryPhotographRecord,
  type OpenFilmLibraryDocument,
} from './libraryModel';

export type LibraryMode = 'comparison' | 'grid' | 'loupe';
export type LibraryOrdering = 'capture-ascending' | 'capture-descending';

export interface LibraryFilter {
  analysisComplete?: boolean;
  disposition?: LibraryPhotographDisposition;
  minimumRating?: number;
  sourceState?: LibraryPhotographRecord['sourceState'];
  unsupportedOnly?: boolean;
}

export interface LibraryReviewContext {
  activePhotographId: string | null;
  autoAdvance: boolean;
  filter: LibraryFilter;
  mode: LibraryMode;
  ordering: LibraryOrdering;
  scrollAnchorPhotographId: string | null;
  selection: string[];
}

export interface LibraryEdit {
  adjustments: AdjustmentValues;
  geometry: GeometryValues;
  grainSeed: number;
  revision: number;
}

export type ReviewCommand =
  | { kind: 'rate'; rating: number | null }
  | { disposition: LibraryPhotographDisposition; kind: 'set-disposition' };

export interface ReviewCommandResult {
  context: LibraryReviewContext;
  document: OpenFilmLibraryDocument;
  message: string;
  previous: { context: LibraryReviewContext; document: OpenFilmLibraryDocument };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasAnalysis(record: LibraryPhotographRecord): boolean {
  return isRecord(record.analysis) && record.analysis.status === 'complete';
}

export function filterLibraryPhotographs(
  photographs: readonly LibraryPhotographRecord[],
  filter: LibraryFilter,
  ordering: LibraryOrdering = 'capture-ascending',
): LibraryPhotographRecord[] {
  const visible = photographs.filter((photograph) => {
    if (filter.unsupportedOnly) return false;
    if (filter.disposition && photograph.disposition !== filter.disposition) return false;
    if (filter.sourceState && photograph.sourceState !== filter.sourceState) return false;
    if (filter.minimumRating !== undefined && (photograph.rating ?? 0) < filter.minimumRating) {
      return false;
    }
    if (
      filter.analysisComplete !== undefined &&
      hasAnalysis(photograph) !== filter.analysisComplete
    ) {
      return false;
    }
    return true;
  });

  return ordering === 'capture-descending' ? visible.reverse() : visible;
}

export function createLibraryReviewContext(
  photographs: readonly LibraryPhotographRecord[],
): LibraryReviewContext {
  return {
    activePhotographId: photographs[0]?.id ?? null,
    autoAdvance: true,
    filter: {},
    mode: 'grid',
    ordering: 'capture-ascending',
    scrollAnchorPhotographId: photographs[0]?.id ?? null,
    selection: [],
  };
}

export function navigateLibraryReview(
  context: LibraryReviewContext,
  photographs: readonly LibraryPhotographRecord[],
  direction: -1 | 1,
  extendSelection = false,
): LibraryReviewContext {
  const ordered = filterLibraryPhotographs(photographs, context.filter, context.ordering);
  const currentIndex = Math.max(
    0,
    ordered.findIndex((photograph) => photograph.id === context.activePhotographId),
  );
  const next = ordered[Math.min(ordered.length - 1, Math.max(0, currentIndex + direction))];

  if (!next) return context;

  const selection = extendSelection
    ? Array.from(
        new Set([...context.selection, ordered[currentIndex]?.id, next.id].filter(Boolean)),
      )
    : context.selection;

  return { ...context, activePhotographId: next.id, selection };
}

export function toggleLibrarySelection(
  context: LibraryReviewContext,
  photographId: string,
): LibraryReviewContext {
  const selection = context.selection.includes(photographId)
    ? context.selection.filter((id) => id !== photographId)
    : [...context.selection, photographId];
  return { ...context, selection };
}

export function applyLibraryReviewCommand(
  document: OpenFilmLibraryDocument,
  context: LibraryReviewContext,
  command: ReviewCommand,
): ReviewCommandResult {
  const activeId = context.activePhotographId;
  const active = document.photographs.find((photograph) => photograph.id === activeId);
  if (!active) throw new Error('Choose an Active photograph before changing review state.');

  const beforeOrdering = filterLibraryPhotographs(
    document.photographs,
    context.filter,
    context.ordering,
  );
  const beforeIndex = beforeOrdering.findIndex((photograph) => photograph.id === active.id);
  const nextDocument = cloneOpenFilmLibraryDocument(document);
  const nextActive = nextDocument.photographs.find((photograph) => photograph.id === active.id)!;

  if (command.kind === 'rate') {
    if (
      command.rating !== null &&
      (!Number.isInteger(command.rating) || command.rating < 0 || command.rating > 5)
    ) {
      throw new Error('Rating must be zero through five stars.');
    }
    nextActive.rating = command.rating;
  } else {
    nextActive.disposition = command.disposition;
  }

  let nextContext = { ...context };
  const afterOrdering = filterLibraryPhotographs(
    nextDocument.photographs,
    context.filter,
    context.ordering,
  );
  if (context.autoAdvance) {
    const preferred = beforeOrdering[beforeIndex + 1] ?? beforeOrdering[beforeIndex - 1];
    const nextVisible =
      preferred && afterOrdering.some((item) => item.id === preferred.id)
        ? preferred
        : afterOrdering[Math.min(beforeIndex, Math.max(0, afterOrdering.length - 1))];
    nextContext = {
      ...nextContext,
      activePhotographId: nextVisible?.id ?? null,
      scrollAnchorPhotographId: context.scrollAnchorPhotographId ?? active.id,
    };
  }

  const state =
    command.kind === 'rate'
      ? command.rating === null
        ? 'Unrated'
        : `${command.rating} stars`
      : command.disposition[0].toUpperCase() + command.disposition.slice(1);

  return {
    context: nextContext,
    document: nextDocument,
    message: `${active.fileName}: ${state}.`,
    previous: { context, document },
  };
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function getLibraryEdit(record: LibraryPhotographRecord): LibraryEdit {
  const value = isRecord(record.edit) ? record.edit : {};
  const rawAdjustments = isRecord(value.adjustments) ? value.adjustments : {};
  const rawGeometry = isRecord(value.geometry) ? value.geometry : {};

  return {
    adjustments: { ...neutralAdjustments, ...rawAdjustments } as AdjustmentValues,
    geometry: { ...neutralGeometry, ...rawGeometry } as GeometryValues,
    grainSeed: numberValue(value.grainSeed, DEFAULT_GRAIN_SEED),
    revision: Math.max(0, Math.floor(numberValue(value.revision, 0))),
  };
}

function editAsJson(edit: LibraryEdit): JsonValue {
  return JSON.parse(JSON.stringify(edit)) as JsonValue;
}

export function updateLibraryEdit(
  document: OpenFilmLibraryDocument,
  photographId: string,
  update: (edit: LibraryEdit) => LibraryEdit,
): OpenFilmLibraryDocument {
  const next = cloneOpenFilmLibraryDocument(document);
  const photograph = next.photographs.find((candidate) => candidate.id === photographId);
  if (!photograph) throw new Error('The Active photograph is no longer in this Library.');
  const current = getLibraryEdit(photograph);
  photograph.edit = editAsJson({ ...update(current), revision: current.revision + 1 });
  return next;
}

export function copyActiveLookToSelection(
  document: OpenFilmLibraryDocument,
  activePhotographId: string | null,
  selection: readonly string[],
): OpenFilmLibraryDocument {
  const active = document.photographs.find((photograph) => photograph.id === activePhotographId);
  if (!active) throw new Error('Choose an Active photograph with a Look first.');
  if (selection.length === 0) throw new Error('Select at least one photograph to copy this Look.');
  const selected = selection.map((id) =>
    document.photographs.find((photograph) => photograph.id === id),
  );
  if (selected.some((photograph) => !photograph)) {
    throw new Error('The Selection contains a photograph that is no longer in this Library.');
  }

  const look = getLibraryEdit(active).adjustments;
  const next = cloneOpenFilmLibraryDocument(document);
  for (const photograph of next.photographs) {
    if (!selection.includes(photograph.id)) continue;
    const edit = getLibraryEdit(photograph);
    photograph.edit = editAsJson({
      ...edit,
      adjustments: JSON.parse(JSON.stringify(look)) as AdjustmentValues,
      revision: edit.revision + 1,
    });
  }
  return next;
}
