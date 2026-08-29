import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import {
  adjustmentDefinitions,
  neutralAdjustments,
  type AdjustmentKey,
} from '../editor/adjustments';
import { neutralGeometry, type GeometryRotation } from '../editor/geometry';
import { interpolateToneCurve } from '../editor/toneCurve';
import { createRenderer, neutralRendererAdjustments } from '../rendering/renderer';
import { Button, Select } from '../ui/components';
import type { ExportFormat } from '../rendering/export';
import { LibraryGrid } from './LibraryGrid';
import { LibraryPhotoView } from './LibraryPhotoView';
import {
  createComparisonState,
  mapSourceFocalPointToPane,
  removeComparisonPane,
  setComparisonZoom,
  toggleComparisonPaneLink,
  type LibraryComparisonState,
} from './libraryComparison';
import {
  DOWNLOAD_FALLBACK_LIMIT,
  createExportPlan,
  isFinalSetExportManifest,
  markExportComplete,
  markExportFailed,
  reconcileExportManifest,
  type FinalSetExportManifest,
} from './libraryExportSet';
import { LIBRARY_GRID_DENSITIES, type LibraryGridDensity } from './libraryGridModel';
import type { LibraryThumbnail } from './libraryThumbnail';
import type { LibraryWorkspaceSnapshot } from './libraryApplication';
import type { LibraryPhotographRecord, OpenFilmLibraryDocument } from './libraryModel';
import {
  acceptReviewProposal,
  dismissReviewProposal,
  dissolveReviewGroup,
  getReviewGroups,
  mergeReviewGroups,
  proposeBurstGroups,
  splitReviewGroup,
  toggleReviewGroup,
} from './libraryReviewGroups';
import {
  applyLibraryReviewCommand,
  copyActiveLookToSelection,
  createLibraryReviewContext,
  filterLibraryPhotographs,
  getLibraryEdit,
  navigateLibraryReview,
  toggleLibrarySelection,
  updateLibraryEdit,
  type LibraryFilter,
  type LibraryReviewContext,
  type ReviewCommand,
} from './libraryReview';
import { resolveLibrarySourceChoice } from './libraryReconciliation';
import type { StoredLook } from '../storage/browserStorage';

export interface AdaptiveLibraryWorkspaceProps {
  customLooks: readonly StoredLook[];
  feedback: string | null;
  historyStatus: { canRedo: boolean; canUndo: boolean };
  onCancelScan: () => void;
  onClose: () => void;
  onCommit: (document: OpenFilmLibraryDocument, message: string) => Promise<boolean>;
  onDownloadLibraryBackup: () => void;
  onLoadSource: (relativePath: string, signal?: AbortSignal) => Promise<File>;
  onLoadComparisonThumbnail: (
    relativePath: string,
    maxWidth: number,
    signal?: AbortSignal,
    cacheRevision?: string,
  ) => Promise<LibraryThumbnail>;
  onLoadThumbnail: (
    relativePath: string,
    maxWidth: number,
    signal?: AbortSignal,
    cacheRevision?: string,
  ) => Promise<LibraryThumbnail>;
  onPickExportDestination: () => Promise<{ handle: FileSystemDirectoryHandle; paths: string[] }>;
  onReadExportFile: (
    destination: FileSystemDirectoryHandle,
    relativePath: string,
  ) => Promise<File | null>;
  onRenderExport: (
    photograph: LibraryPhotographRecord,
    options: { format: ExportFormat; quality: number },
    signal?: AbortSignal,
  ) => Promise<Blob>;
  onReauthorize: () => void;
  onReauthorizeScan: () => Promise<void>;
  onRedo: () => Promise<boolean>;
  onRefresh: () => void;
  onRevert: () => void;
  onRetry: () => void;
  onSaveCopy: () => void;
  onUndo: () => Promise<boolean>;
  onWriteExportFile: (
    destination: FileSystemDirectoryHandle,
    relativePath: string,
    bytes: Blob | Uint8Array,
    options?: { overwrite?: boolean },
  ) => Promise<void>;
  snapshot: LibraryWorkspaceSnapshot;
}

const editSections = ['light', 'color', 'curve', 'finish', 'geometry', 'looks'] as const;
const EXPORT_MANIFEST_PATH = 'openfilm-export-manifest.json';
const HISTORY_LIMIT = 50;
const FILMSTRIP_WINDOW = 21;
type EditSection = (typeof editSections)[number];
interface ReviewHistoryEntry {
  context: LibraryReviewContext;
  gridScrollTop: number;
}
const sectionLabels: Record<EditSection, string> = {
  color: 'Color',
  curve: 'Curve',
  finish: 'Finish',
  geometry: 'Geometry',
  light: 'Light',
  looks: 'Looks',
};
const sectionAdjustments: Partial<Record<EditSection, AdjustmentKey[]>> = {
  light: ['exposure', 'contrast', 'fade'],
  color: ['temperature', 'tint', 'saturation'],
  finish: ['vignetteAmount', 'vignetteSoftness', 'grainAmount', 'grainSize'],
};

function editableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        'input, textarea, select, a, button:not(.library-grid__photograph), [contenteditable="true"]',
      ),
    )
  );
}

function statusLabel(status: LibraryWorkspaceSnapshot['status']): string {
  if (status === 'read-only') return 'Read-only';
  if (status === 'saving') return 'Saving';
  if (status === 'unsaved') return 'Unsaved';
  return 'Saved';
}

function ScanSummary({
  snapshot,
  onCancel,
  onRefresh,
  onReauthorize,
}: {
  snapshot: LibraryWorkspaceSnapshot;
  onCancel: () => void;
  onRefresh: () => void;
  onReauthorize: () => void;
}) {
  const { progress, status, unsupportedFiles } = snapshot.scan;
  const photographCount = progress.supportedFiles;
  const photographLabel = `${photographCount.toLocaleString()} photograph${photographCount === 1 ? '' : 's'}`;

  if (status === 'complete' && unsupportedFiles.length === 0) {
    return (
      <span aria-label="Background jobs: complete" className="workstation-count">
        {photographLabel}
      </span>
    );
  }

  return (
    <details
      className="workstation-jobs"
      data-workstation-popover="true"
      open={status === 'failed'}
    >
      <summary aria-label={`Background jobs: ${status}`}>
        {status === 'scanning'
          ? `Reading folder · ${photographLabel}`
          : status === 'failed'
            ? 'Scan stopped'
            : `${photographLabel} · ${progress.unsupportedFiles.toLocaleString()} skipped`}
      </summary>
      <div className="workstation-jobs__details">
        <span role="status">
          {snapshot.scan.error ?? snapshot.scan.message ?? 'No background work.'}
        </span>
        {status === 'scanning' ? (
          <Button onClick={onCancel} size="small" variant="quiet">
            Cancel
          </Button>
        ) : null}
        {status === 'failed' && snapshot.scan.error?.toLowerCase().includes('permission') ? (
          <Button onClick={onReauthorize} size="small" variant="primary">
            Reauthorize and resume
          </Button>
        ) : status === 'failed' || status === 'cancelled' ? (
          <Button onClick={onRefresh} size="small" variant="quiet">
            Retry scan
          </Button>
        ) : null}
        {unsupportedFiles.length ? (
          <>
            <ul>
              {unsupportedFiles.slice(0, 20).map((file) => (
                <li key={file.relativePath}>{file.relativePath}</li>
              ))}
            </ul>
            {unsupportedFiles.length > 20 ? (
              <span>{unsupportedFiles.length - 20} more unsupported files</span>
            ) : null}
          </>
        ) : null}
      </div>
    </details>
  );
}

function ComparisonPreview({
  photograph,
  onLoadThumbnail,
  sourceView,
  renderGeneration,
}: {
  photograph: LibraryPhotographRecord;
  onLoadThumbnail: AdaptiveLibraryWorkspaceProps['onLoadThumbnail'];
  sourceView: boolean;
  renderGeneration: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [message, setMessage] = useState('Reading derivative');
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controller = new AbortController();
    let current: LibraryThumbnail | null = null;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setMessage('Graphics context lost');
    };
    const handleContextRestored = () => setMessage('');
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    const renderer = createRenderer(canvas, {
      onError: (error) => setMessage(error.message),
      onStatusChange: (status) => {
        if (status === 'context-lost') setMessage('Graphics context lost');
        else if (status === 'available') setMessage('');
      },
    });
    if (!renderer) {
      setMessage('WebGL2 unavailable');
      return () => {
        controller.abort();
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      };
    }
    const resize = () => renderer.resize(canvas.clientWidth, canvas.clientHeight, 1);
    resize();
    window.addEventListener('resize', resize);
    const edit = getLibraryEdit(photograph);
    renderer.setAdjustments(sourceView ? neutralRendererAdjustments : edit.adjustments);
    renderer.setGeometry(sourceView ? neutralGeometry : edit.geometry);
    renderer.setGrainSeed(edit.grainSeed);
    void onLoadThumbnail(
      photograph.relativePath,
      640,
      controller.signal,
      `${photograph.fingerprint.byteSize}:${photograph.fingerprint.lastModified}`,
    )
      .then(async (loaded) => {
        current = loaded;
        const dimensions = await new Promise<{ height: number; width: number }>(
          (resolve, reject) => {
            const image = new Image();
            image.onload = () =>
              resolve({ height: image.naturalHeight, width: image.naturalWidth });
            image.onerror = () => reject(new Error('Derivative unavailable'));
            image.src = loaded.url;
          },
        );
        if (controller.signal.aborted) return;
        await renderer.replaceImage({ ...dimensions, objectUrl: loaded.url });
        if (!controller.signal.aborted) setMessage('');
      })
      .catch(() => {
        if (!controller.signal.aborted) setMessage('Derivative unavailable');
      });
    return () => {
      controller.abort();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      renderer.dispose();
      current?.dispose();
    };
  }, [onLoadThumbnail, photograph, renderGeneration, sourceView]);
  return (
    <>
      <canvas aria-hidden="true" ref={canvasRef} />
      {message ? <span role="status">{message}</span> : null}
    </>
  );
}

function EditInspector({
  active,
  canMutate,
  document,
  customLooks,
  expanded,
  onChange,
  onClose,
  onCopy,
  onExpand,
  selectionCount,
}: {
  active: LibraryPhotographRecord;
  canMutate: boolean;
  document: OpenFilmLibraryDocument;
  customLooks: readonly StoredLook[];
  expanded: EditSection;
  onChange: (next: OpenFilmLibraryDocument) => void;
  onClose: () => void;
  onCopy: () => void;
  onExpand: (section: EditSection) => void;
  selectionCount: number;
}) {
  const edit = getLibraryEdit(active);
  const midtoneOutput = interpolateToneCurve(edit.adjustments.toneCurve, 0.5);
  return (
    <aside
      aria-label="Edit inspector"
      aria-modal="true"
      className="edit-inspector"
      data-openfilm-modal="true"
      role="dialog"
    >
      <header>
        <div>
          <span>Edit</span>
          <strong>{active.fileName}</strong>
        </div>
        <Button onClick={onClose} size="small" variant="quiet">
          Close
        </Button>
      </header>
      {editSections.map((section) => (
        <section className="edit-inspector__section" key={section}>
          <button
            aria-expanded={expanded === section}
            onClick={() => onExpand(section)}
            type="button"
          >
            {sectionLabels[section]}
          </button>
          {expanded === section ? (
            <div className="edit-inspector__controls">
              {(sectionAdjustments[section] ?? []).map((key) => {
                const definition = adjustmentDefinitions[key];
                const value = edit.adjustments[key];
                return (
                  <label className="edit-inspector__control" key={key}>
                    <span>
                      {definition.label}
                      <output>{value.toFixed(2)}</output>
                    </span>
                    <input
                      aria-label={definition.label}
                      disabled={!canMutate}
                      max={definition.max}
                      min={definition.min}
                      onChange={(event) =>
                        onChange(
                          updateLibraryEditFromRecord(
                            document,
                            active,
                            key,
                            Number(event.currentTarget.value),
                          ),
                        )
                      }
                      step={definition.step}
                      type="range"
                      value={value}
                    />
                    <span className="edit-inspector__number-row">
                      <input
                        aria-label={`${definition.label} numeric value`}
                        disabled={!canMutate}
                        max={definition.max}
                        min={definition.min}
                        onChange={(event) =>
                          onChange(
                            updateLibraryEditFromRecord(
                              document,
                              active,
                              key,
                              Number(event.currentTarget.value),
                            ),
                          )
                        }
                        step={definition.step}
                        type="number"
                        value={value}
                      />
                      <button
                        disabled={!canMutate || value === definition.neutral}
                        onClick={() =>
                          onChange(
                            updateLibraryEditFromRecord(document, active, key, definition.neutral),
                          )
                        }
                        type="button"
                      >
                        Reset
                      </button>
                    </span>
                  </label>
                );
              })}
              {section === 'curve' ? (
                <label className="edit-inspector__control">
                  <span>
                    Midtone output
                    <output>{Math.round(midtoneOutput * 100)}</output>
                  </span>
                  <input
                    aria-label="Midtone output"
                    disabled={!canMutate}
                    max="1"
                    min="0"
                    onChange={(event) =>
                      onChange(
                        updateLibraryCurve(document, active, Number(event.currentTarget.value)),
                      )
                    }
                    step="0.01"
                    type="range"
                    value={midtoneOutput}
                  />
                  <span className="edit-inspector__number-row">
                    <input
                      aria-label="Midtone output numeric value"
                      disabled={!canMutate}
                      max="1"
                      min="0"
                      onChange={(event) =>
                        onChange(
                          updateLibraryCurve(document, active, Number(event.currentTarget.value)),
                        )
                      }
                      step="0.01"
                      type="number"
                      value={midtoneOutput}
                    />
                    <button
                      disabled={!canMutate || midtoneOutput === 0.5}
                      onClick={() => onChange(updateLibraryCurve(document, active, 0.5))}
                      type="button"
                    >
                      Reset
                    </button>
                  </span>
                </label>
              ) : null}
              {section === 'geometry' ? (
                <div
                  className="edit-inspector__geometry"
                  role="group"
                  aria-label="Geometry controls"
                >
                  <span>Rotation {edit.geometry.rotation}°</span>
                  <Button
                    disabled={!canMutate}
                    onClick={() => onChange(updateLibraryRotation(document, active, -90))}
                    size="small"
                    variant="outline"
                  >
                    Rotate left
                  </Button>
                  <Button
                    disabled={!canMutate}
                    onClick={() => onChange(updateLibraryRotation(document, active, 90))}
                    size="small"
                    variant="outline"
                  >
                    Rotate right
                  </Button>
                  <Button
                    aria-pressed={edit.geometry.flipHorizontal}
                    disabled={!canMutate}
                    onClick={() =>
                      onChange(
                        updateLibraryGeometry(document, active, {
                          flipHorizontal: !edit.geometry.flipHorizontal,
                        }),
                      )
                    }
                    size="small"
                    variant="quiet"
                  >
                    Flip horizontal
                  </Button>
                  <Button
                    aria-pressed={edit.geometry.flipVertical}
                    disabled={!canMutate}
                    onClick={() =>
                      onChange(
                        updateLibraryGeometry(document, active, {
                          flipVertical: !edit.geometry.flipVertical,
                        }),
                      )
                    }
                    size="small"
                    variant="quiet"
                  >
                    Flip vertical
                  </Button>
                  <Button
                    disabled={
                      !canMutate ||
                      JSON.stringify(edit.geometry) === JSON.stringify(neutralGeometry)
                    }
                    onClick={() =>
                      onChange(
                        updateLibraryEdit(document, active.id, (current) => ({
                          ...current,
                          geometry: { ...neutralGeometry, crop: { ...neutralGeometry.crop } },
                        })),
                      )
                    }
                    size="small"
                    variant="quiet"
                  >
                    Reset geometry
                  </Button>
                </div>
              ) : null}
              {section === 'looks' ? (
                <div className="edit-inspector__look-actions">
                  <Button
                    disabled={!canMutate}
                    onClick={() =>
                      onChange(updateLibraryEditFromRecord(document, active, null, null))
                    }
                    size="small"
                    variant="outline"
                  >
                    Neutral Look
                  </Button>
                  {customLooks.map((look) => (
                    <Button
                      disabled={!canMutate}
                      key={look.id}
                      onClick={() =>
                        onChange(
                          updateLibraryEdit(document, active.id, (current) => ({
                            ...current,
                            adjustments: JSON.parse(JSON.stringify(look.adjustments)),
                          })),
                        )
                      }
                      size="small"
                      variant="outline"
                    >
                      {look.title}
                    </Button>
                  ))}
                  <Button
                    disabled={!canMutate || selectionCount === 0 || !active.edit}
                    onClick={onCopy}
                    size="small"
                    variant="primary"
                  >
                    Copy Look to {selectionCount} selected
                  </Button>
                  {selectionCount === 0 || !active.edit ? (
                    <p className="edit-inspector__requirement">
                      Select photographs and change this Edit before copying its Look.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ))}
    </aside>
  );
}

function ActiveReviewRail({
  active,
  canMutate,
  context,
  children,
  onReview,
  onToggleSelection,
}: {
  active: LibraryPhotographRecord;
  canMutate: boolean;
  context: LibraryReviewContext;
  children?: ReactNode;
  onReview: (command: ReviewCommand) => void;
  onToggleSelection: () => void;
}) {
  const isSelected = context.selection.includes(active.id);
  const sourceStatus = active.sourceState === 'missing' ? 'Missing Source' : 'Source ready';
  const disposition =
    active.disposition === 'pick'
      ? 'Pick'
      : active.disposition === 'reject'
        ? 'Reject'
        : 'Unmarked';

  return (
    <div
      aria-label="Active photograph controls"
      className="workstation-context-bar"
      data-workstation-background
    >
      <div className="workstation-context-bar__identity">
        <strong title={active.relativePath}>{active.fileName}</strong>
        <span className="workstation-context-bar__state">
          {disposition}
          {active.rating === null ? ' · Unrated' : ` · ${active.rating}/5`}
          {active.sourceState === 'missing' ? ` · ${sourceStatus}` : ''}
        </span>
      </div>
      <div className="workstation-context-bar__actions">
        <div
          aria-label="Review Active photograph"
          className="workstation-action-group"
          role="group"
        >
          <div className="workstation-review-actions">
            <Button
              aria-pressed={active.disposition === 'pick'}
              className="workstation-review-action workstation-review-action--pick"
              disabled={!canMutate}
              onClick={() => onReview({ kind: 'set-disposition', disposition: 'pick' })}
              size="small"
              variant="outline"
            >
              Pick
            </Button>
            <Button
              aria-pressed={active.disposition === 'reject'}
              className="workstation-review-action workstation-review-action--reject"
              disabled={!canMutate}
              onClick={() => onReview({ kind: 'set-disposition', disposition: 'reject' })}
              size="small"
              variant="outline"
            >
              Reject
            </Button>
          </div>
          <div className="workstation-rating-control">
            <span>Rating</span>
            <Select
              disabled={!canMutate}
              label={`Rating for ${active.fileName}`}
              onValueChange={(value) =>
                onReview({
                  kind: 'rate',
                  rating: value ? Number(value) : null,
                })
              }
              options={[
                { label: 'Unrated', value: '' },
                ...[1, 2, 3, 4, 5].map((rating) => ({
                  label: `${rating} stars`,
                  value: String(rating),
                })),
              ]}
              value={String(active.rating ?? '')}
            />
          </div>
          <Button
            aria-pressed={isSelected}
            className="workstation-selection-toggle"
            onClick={onToggleSelection}
            size="small"
            variant="outline"
          >
            {isSelected ? 'Remove from Selection' : 'Add to Selection'}
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function updateLibraryEditFromRecord(
  document: OpenFilmLibraryDocument,
  active: LibraryPhotographRecord,
  key: AdjustmentKey | null,
  value: number | null,
): OpenFilmLibraryDocument {
  return updateLibraryEdit(document, active.id, (edit) => ({
    ...edit,
    adjustments: key ? { ...edit.adjustments, [key]: value! } : { ...neutralAdjustments },
  }));
}

function updateLibraryCurve(
  document: OpenFilmLibraryDocument,
  active: LibraryPhotographRecord,
  midtone: number,
): OpenFilmLibraryDocument {
  return updateLibraryEdit(document, active.id, (edit) => ({
    ...edit,
    adjustments: {
      ...edit.adjustments,
      toneCurve: [
        { x: 0, y: 0 },
        { x: 0.5, y: Math.min(1, Math.max(0, midtone)) },
        { x: 1, y: 1 },
      ],
    },
  }));
}

function updateLibraryGeometry(
  document: OpenFilmLibraryDocument,
  active: LibraryPhotographRecord,
  geometry: Partial<typeof neutralGeometry>,
): OpenFilmLibraryDocument {
  return updateLibraryEdit(document, active.id, (edit) => ({
    ...edit,
    geometry: { ...edit.geometry, ...geometry },
  }));
}

function updateLibraryRotation(
  document: OpenFilmLibraryDocument,
  active: LibraryPhotographRecord,
  delta: number,
): OpenFilmLibraryDocument {
  const current = getLibraryEdit(active).geometry.rotation;
  const rotation = ((current + delta + 360) % 360) as GeometryRotation;
  return updateLibraryGeometry(document, active, { rotation });
}

async function checksum(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function AdaptiveLibraryWorkspace(props: AdaptiveLibraryWorkspaceProps) {
  const initialDocument = props.snapshot.library;
  const [documentState, setDocumentState] = useState<OpenFilmLibraryDocument | null>(
    initialDocument,
  );
  const [context, setContext] = useState<LibraryReviewContext>(() =>
    createLibraryReviewContext(initialDocument?.photographs ?? []),
  );
  const [density, setDensity] = useState<LibraryGridDensity>('standard');
  const [message, setMessage] = useState(props.snapshot.message);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [editSection, setEditSection] = useState<EditSection>('light');
  const [comparison, setComparison] = useState<LibraryComparisonState | null>(null);
  const [sourceView, setSourceView] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [sourceZoomAvailable, setSourceZoomAvailable] = useState(false);
  const [gridScrollTop, setGridScrollTop] = useState(0);
  const [gridRestoreRevision, setGridRestoreRevision] = useState(0);
  const [renderGeneration, setRenderGeneration] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportMode, setExportMode] = useState<'picks' | 'selection'>('picks');
  const [exportManifest, setExportManifest] = useState<FinalSetExportManifest | null>(null);
  const [exportDestination, setExportDestination] = useState<FileSystemDirectoryHandle | null>(
    null,
  );
  const [exportRunning, setExportRunning] = useState(false);
  const [exportCancelled, setExportCancelled] = useState(false);
  const exportCancelledRef = useRef(false);
  const focusBeforeOverlay = useRef<HTMLElement | null>(null);
  const popoverBeforeOverlay = useRef<HTMLDetailsElement | null>(null);
  const workstationRef = useRef<HTMLElement>(null);
  const contextUndo = useRef<ReviewHistoryEntry[]>([]);
  const contextRedo = useRef<ReviewHistoryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (props.snapshot.library) {
        setDocumentState(props.snapshot.library);
        setContext((current) => {
          const activeStillExists = props.snapshot.library?.photographs.some(
            (photo) => photo.id === current.activePhotographId,
          );
          return activeStillExists
            ? current
            : {
                ...current,
                activePhotographId: props.snapshot.library?.photographs[0]?.id ?? null,
                scrollAnchorPhotographId: props.snapshot.library?.photographs[0]?.id ?? null,
              };
        });
      }
      setMessage(props.snapshot.message);
    });
    return () => {
      cancelled = true;
    };
  }, [props.snapshot.library, props.snapshot.message]);

  const overlayOpen = inspectorOpen || showGroups || showExport || showShortcuts;

  useEffect(() => {
    if (!overlayOpen) return;
    const dialog = globalThis.document.querySelector<HTMLElement>('[data-openfilm-modal="true"]');
    const controls = () =>
      dialog
        ? Array.from(
            dialog.querySelectorAll<HTMLElement>(
              'button, input, select, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((item) => !item.hasAttribute('disabled'))
        : [];
    const background = Array.from(
      globalThis.document.querySelectorAll<HTMLElement>('[data-workstation-background]'),
    );
    for (const element of background) element.inert = true;
    controls()[0]?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      const currentControls = controls();
      if (event.key !== 'Tab' || currentControls.length === 0) return;
      const first = currentControls[0];
      const last = currentControls.at(-1)!;
      if (event.shiftKey && globalThis.document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && globalThis.document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const containFocus = (event: FocusEvent) => {
      if (dialog && event.target instanceof Node && !dialog.contains(event.target)) {
        controls()[0]?.focus();
      }
    };
    globalThis.document.addEventListener('keydown', trapFocus);
    globalThis.document.addEventListener('focusin', containFocus);
    return () => {
      globalThis.document.removeEventListener('keydown', trapFocus);
      globalThis.document.removeEventListener('focusin', containFocus);
      for (const element of background) element.inert = false;
    };
  }, [overlayOpen]);

  useEffect(() => {
    const closePopovers = (except?: HTMLDetailsElement) => {
      globalThis.document
        .querySelectorAll<HTMLDetailsElement>('details[data-workstation-popover][open]')
        .forEach((details) => {
          if (details !== except) details.open = false;
        });
    };
    const handleToggle = (event: Event) => {
      const details = event.target;
      if (
        !(details instanceof HTMLDetailsElement) ||
        !details.matches('[data-workstation-popover]')
      ) {
        return;
      }
      if (details.open) closePopovers(details);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('details[data-workstation-popover]')
      ) {
        return;
      }
      closePopovers();
    };
    globalThis.document.addEventListener('toggle', handleToggle, true);
    globalThis.document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      globalThis.document.removeEventListener('toggle', handleToggle, true);
      globalThis.document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  const document = documentState;
  const photographs = useMemo(() => document?.photographs ?? [], [document]);
  const visible = useMemo(
    () => filterLibraryPhotographs(photographs, context.filter, context.ordering),
    [context.filter, context.ordering, photographs],
  );
  const active =
    photographs.find((photograph) => photograph.id === context.activePhotographId) ??
    visible[0] ??
    null;
  const selectionSet = useMemo(() => new Set(context.selection), [context.selection]);
  const proposals = document ? proposeBurstGroups(document.photographs, document) : [];
  const groups = document ? getReviewGroups(document) : [];
  const ambiguousSources = photographs.filter(
    (photograph) =>
      Array.isArray(photograph.reconciliationCandidates) &&
      photograph.reconciliationCandidates.some((candidate) => typeof candidate === 'string'),
  );
  const saveStatus = statusLabel(props.snapshot.status);
  const statusMessage =
    props.feedback ??
    (message === 'The Library is Saved.' || message === 'Ready.' ? null : message);
  const canMutate = props.snapshot.status === 'saved' || props.snapshot.status === 'saving';
  const comparisonCount = Math.min(4, context.selection.length);
  const comparisonReady = comparisonCount >= 2;
  const showStatusRow =
    photographs.length === 0 &&
    (props.snapshot.scan.status === 'scanning' ||
      props.snapshot.scan.status === 'failed' ||
      props.snapshot.scan.status === 'cancelled' ||
      Boolean(statusMessage));
  const activeFilterCount = [
    context.filter.disposition,
    context.filter.minimumRating,
    context.filter.sourceState,
    context.filter.unsupportedOnly,
    context.filter.analysisComplete,
  ].filter((value) => value !== undefined).length;
  const reviewStatusCounts = photographs.reduce(
    (counts, photograph) => {
      counts[photograph.disposition] += 1;
      return counts;
    },
    { pick: 0, reject: 0, unmarked: 0 },
  );
  const exportCounts = exportManifest?.entries.reduce(
    (counts, entry) => {
      counts[entry.state] += 1;
      return counts;
    },
    { cancelled: 0, complete: 0, failed: 0, pending: 0, writing: 0 },
  );
  async function commit(
    next: OpenFilmLibraryDocument,
    nextMessage: string,
    rememberContext = true,
  ) {
    if (!canMutate) {
      setMessage('Resolve the current Library recovery state before making another change.');
      return;
    }
    if (rememberContext) {
      contextUndo.current.push({ context, gridScrollTop });
      contextUndo.current.splice(0, Math.max(0, contextUndo.current.length - HISTORY_LIMIT));
      contextRedo.current = [];
    }
    setDocumentState(next);
    setMessage(nextMessage);
    if (await props.onCommit(next, nextMessage)) {
      setRenderGeneration((current) => current + 1);
    }
  }

  function review(command: Parameters<typeof applyLibraryReviewCommand>[2], photographId?: string) {
    if (!document) return;
    if (!canMutate) {
      setMessage('Resolve the current Library recovery state before changing review state.');
      return;
    }
    try {
      const reviewContext = photographId
        ? { ...context, activePhotographId: photographId, autoAdvance: false }
        : context;
      const result = applyLibraryReviewCommand(document, reviewContext, command);
      contextUndo.current.push({ context, gridScrollTop });
      contextUndo.current.splice(0, Math.max(0, contextUndo.current.length - HISTORY_LIMIT));
      contextRedo.current = [];
      setContext(result.context);
      setDocumentState(result.document);
      setMessage(result.message);
      void props.onCommit(result.document, result.message).then((saved) => {
        if (saved) setRenderGeneration((current) => current + 1);
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'OpenFilm could not change review state.',
      );
    }
  }

  async function undo() {
    if (!canMutate) return;
    const previous = contextUndo.current.pop();
    if (previous) {
      contextRedo.current.push({ context, gridScrollTop });
      contextRedo.current.splice(0, Math.max(0, contextRedo.current.length - HISTORY_LIMIT));
      setContext(previous.context);
      setGridScrollTop(previous.gridScrollTop);
      setGridRestoreRevision((current) => current + 1);
    }
    if (await props.onUndo()) setRenderGeneration((current) => current + 1);
  }

  async function redo() {
    if (!canMutate) return;
    const next = contextRedo.current.pop();
    if (next) {
      contextUndo.current.push({ context, gridScrollTop });
      contextUndo.current.splice(0, Math.max(0, contextUndo.current.length - HISTORY_LIMIT));
      setContext(next.context);
      setGridScrollTop(next.gridScrollTop);
      setGridRestoreRevision((current) => current + 1);
    }
    if (await props.onRedo()) setRenderGeneration((current) => current + 1);
  }

  function rememberOverlayFocus() {
    const activeElement = globalThis.document.activeElement as HTMLElement | null;
    focusBeforeOverlay.current = activeElement;
    popoverBeforeOverlay.current =
      activeElement?.closest<HTMLDetailsElement>('details[data-workstation-popover]') ?? null;
    globalThis.document
      .querySelectorAll<HTMLDetailsElement>('details[data-workstation-popover][open]')
      .forEach((details) => {
        details.open = false;
      });
  }

  function restoreOverlayFocus() {
    const popover = popoverBeforeOverlay.current;
    if (popover) popover.open = true;
    requestAnimationFrame(() => focusBeforeOverlay.current?.focus());
  }

  function openInspector() {
    rememberOverlayFocus();
    setShowGroups(false);
    setShowExport(false);
    setShowShortcuts(false);
    setInspectorOpen(true);
  }

  function closeInspector() {
    setInspectorOpen(false);
    restoreOverlayFocus();
  }

  function openSheet(open: () => void) {
    rememberOverlayFocus();
    setInspectorOpen(false);
    setShowGroups(false);
    setShowExport(false);
    setShowShortcuts(false);
    open();
  }

  function closeSheet(close: () => void) {
    close();
    restoreOverlayFocus();
  }

  function enterComparison() {
    try {
      globalThis.document
        .querySelectorAll<HTMLDetailsElement>('details[data-workstation-popover][open]')
        .forEach((details) => {
          details.open = false;
        });
      const comparisonIds = context.selection.slice(0, 4);
      const state = createComparisonState(comparisonIds);
      setComparison(state);
      setContext((current) => ({ ...current, mode: 'comparison' }));
      setMessage(
        context.selection.length > 4
          ? `Comparing the first 4 of ${context.selection.length} selected photographs.`
          : `Comparing ${comparisonIds.length} selected photographs.`,
      );
      requestAnimationFrame(() => workstationRef.current?.focus());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Comparison needs two to four selected photographs.',
      );
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (editableTarget(event.target) && event.key !== 'Escape') return;
    const key = event.key.toLowerCase();
    if (overlayOpen && event.key !== 'Escape') return;
    if (event.key === 'Escape' && !overlayOpen) {
      const openPopovers = globalThis.document.querySelectorAll<HTMLDetailsElement>(
        'details[data-workstation-popover][open]',
      );
      if (openPopovers.length) {
        event.preventDefault();
        openPopovers.forEach((details) => {
          details.open = false;
        });
        return;
      }
    }
    if ((event.metaKey || event.ctrlKey) && key === 'z') {
      event.preventDefault();
      void (event.shiftKey ? redo() : undo());
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      setContext((current) =>
        navigateLibraryReview(current, visible, event.key === 'ArrowLeft' ? -1 : 1, event.shiftKey),
      );
    } else if (/^[0-5]$/.test(event.key)) {
      event.preventDefault();
      review({ kind: 'rate', rating: event.key === '0' ? null : Number(event.key) });
    } else if (key === 'p' || key === 'x' || key === 'u') {
      event.preventDefault();
      review({
        kind: 'set-disposition',
        disposition: key === 'p' ? 'pick' : key === 'x' ? 'reject' : 'unmarked',
      });
    } else if (event.key === 'Enter' && active) {
      event.preventDefault();
      setContext((current) => ({ ...current, mode: 'loupe' }));
      setMessage(`Loupe · ${active.fileName}`);
      requestAnimationFrame(() => workstationRef.current?.focus());
    } else if (key === 'c') {
      event.preventDefault();
      enterComparison();
    } else if (key === 'e' && active) {
      event.preventDefault();
      if (!canMutate) {
        setMessage('Resolve the current Library recovery state before editing.');
        return;
      }
      if (inspectorOpen) closeInspector();
      else openInspector();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (inspectorOpen) closeInspector();
      else if (showExport) closeSheet(() => setShowExport(false));
      else if (showGroups) closeSheet(() => setShowGroups(false));
      else if (showShortcuts) closeSheet(() => setShowShortcuts(false));
      else {
        setComparison(null);
        setContext((current) => ({ ...current, mode: 'grid' }));
        requestAnimationFrame(() =>
          globalThis.document
            .querySelector<HTMLElement>('.library-grid__photograph[aria-current="true"]')
            ?.focus(),
        );
      }
    } else if (event.key === ' ') {
      event.preventDefault();
      if (context.mode === 'grid' && active) {
        setContext((current) => toggleLibrarySelection(current, active.id));
      } else {
        setZoomScale(2);
      }
    } else if (key === 'z') {
      event.preventDefault();
      setZoomScale((current) => (current === 1 ? 2 : 1));
    } else if (event.key === '?') {
      event.preventDefault();
      openSheet(() => setShowShortcuts(true));
    }
  }

  useEffect(() => {
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ') setZoomScale(1);
    };
    globalThis.document.addEventListener('keydown', handleKeyDown);
    globalThis.document.addEventListener('keyup', handleKeyUp);
    return () => {
      globalThis.document.removeEventListener('keydown', handleKeyDown);
      globalThis.document.removeEventListener('keyup', handleKeyUp);
    };
  });

  function setFilter(update: Partial<LibraryFilter>) {
    setContext((current) => ({ ...current, filter: { ...current.filter, ...update } }));
  }

  function exportPhotographs(): LibraryPhotographRecord[] {
    const selectedRecords =
      exportMode === 'selection'
        ? (context.selection
            .map((id) => photographs.find((photo) => photo.id === id))
            .filter(Boolean) as LibraryPhotographRecord[])
        : photographs.filter((photo) => photo.disposition === 'pick');
    if (selectedRecords.length === 0) {
      throw new Error(
        exportMode === 'selection'
          ? 'The Selection is empty.'
          : 'This Library has no Picks to Export.',
      );
    }
    return selectedRecords;
  }

  async function persistExportManifest(
    destination: FileSystemDirectoryHandle,
    manifest: FinalSetExportManifest,
    overwrite: boolean,
  ) {
    await props.onWriteExportFile(
      destination,
      EXPORT_MANIFEST_PATH,
      new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
      { overwrite },
    );
  }

  async function prepareExport() {
    if (!document) return;
    try {
      const destination = await props.onPickExportDestination();
      const storedManifestPath = destination.paths.find(
        (path) => path.toLocaleLowerCase('en-US') === EXPORT_MANIFEST_PATH,
      );
      setExportDestination(destination.handle);
      if (storedManifestPath) {
        const storedFile = await props.onReadExportFile(destination.handle, storedManifestPath);
        const parsed: unknown = storedFile ? JSON.parse(await storedFile.text()) : null;
        if (!isFinalSetExportManifest(parsed)) {
          throw new Error('The destination contains an unsupported OpenFilm Export manifest.');
        }
        const destinationChecksums = new Map<string, string>();
        for (const entry of parsed.entries) {
          const output = await props.onReadExportFile(destination.handle, entry.destinationPath);
          if (output) destinationChecksums.set(entry.destinationPath, await checksum(output));
        }
        const reconciled = reconcileExportManifest(parsed, photographs, destinationChecksums);
        await persistExportManifest(destination.handle, reconciled, true);
        setExportManifest(reconciled);
        setMessage(
          `Resumed ${reconciled.entries.length} Export entries; checksum-valid outputs will be skipped.`,
        );
        return;
      }
      const selectedRecords = exportPhotographs();
      const manifest = createExportPlan(selectedRecords, {
        existingDestinationPaths: new Set(destination.paths),
        format: 'jpeg',
        preserveSourceFolders: true,
        quality: 0.92,
      });
      await persistExportManifest(destination.handle, manifest, false);
      setExportManifest(manifest);
      setMessage(`Prepared ${selectedRecords.length} collision-safe Export names.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'OpenFilm could not prepare the Export folder.',
      );
    }
  }

  function prepareDownloadFallback() {
    try {
      const selectedRecords = exportPhotographs();
      if (selectedRecords.length > DOWNLOAD_FALLBACK_LIMIT) {
        throw new Error(`Download fallback is limited to ${DOWNLOAD_FALLBACK_LIMIT} photographs.`);
      }
      setExportDestination(null);
      setExportManifest(
        createExportPlan(selectedRecords, {
          existingDestinationPaths: new Set(),
          format: 'jpeg',
          preserveSourceFolders: false,
          quality: 0.92,
        }),
      );
      setMessage(
        `Prepared ${selectedRecords.length} browser downloads. This fallback cannot resume.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'OpenFilm could not prepare downloads.');
    }
  }

  async function runExport(folder: boolean) {
    if (!document || !exportManifest || (folder && !exportDestination)) return;
    setExportRunning(true);
    setExportCancelled(false);
    exportCancelledRef.current = false;
    let manifest = exportManifest;
    for (const entry of manifest.entries) {
      if (exportCancelledRef.current) break;
      if (entry.state === 'complete') continue;
      const photograph = photographs.find((candidate) => candidate.id === entry.photographId);
      if (!photograph || photograph.sourceState === 'missing') {
        manifest = markExportFailed(
          manifest,
          entry.photographId,
          'The Source photograph is Missing.',
        );
        setExportManifest(manifest);
        if (folder && exportDestination) {
          try {
            await persistExportManifest(exportDestination, manifest, true);
          } catch (error) {
            setExportRunning(false);
            setMessage(
              error instanceof Error
                ? `Export paused because its manifest did not save. ${error.message}`
                : 'Export paused because its manifest did not save.',
            );
            return;
          }
        }
        continue;
      }
      try {
        manifest = {
          ...manifest,
          entries: manifest.entries.map((candidate) =>
            candidate.photographId === entry.photographId
              ? { ...candidate, failure: null, state: 'writing' }
              : candidate,
          ),
        };
        setExportManifest(manifest);
        if (folder && exportDestination) {
          await persistExportManifest(exportDestination, manifest, true);
        }
        const blob = await props.onRenderExport(photograph, {
          format: entry.format,
          quality: entry.quality,
        });
        if (folder) await props.onWriteExportFile(exportDestination!, entry.destinationPath, blob);
        else download(blob, entry.destinationPath.split('/').at(-1) ?? entry.destinationPath);
        manifest = markExportComplete(manifest, entry.photographId, await checksum(blob));
      } catch (error) {
        manifest = markExportFailed(
          manifest,
          entry.photographId,
          error instanceof Error ? error.message : 'Export failed.',
        );
      }
      setExportManifest(manifest);
      if (folder && exportDestination) {
        try {
          await persistExportManifest(exportDestination, manifest, true);
        } catch (error) {
          setExportRunning(false);
          setMessage(
            error instanceof Error
              ? `Export paused because its manifest did not save. ${error.message}`
              : 'Export paused because its manifest did not save.',
          );
          return;
        }
      }
    }
    if (exportCancelledRef.current) {
      manifest = {
        ...manifest,
        entries: manifest.entries.map((entry) =>
          entry.state === 'pending' ? { ...entry, state: 'cancelled' } : entry,
        ),
      };
      setExportManifest(manifest);
      if (folder && exportDestination) {
        try {
          await persistExportManifest(exportDestination, manifest, true);
        } catch (error) {
          setMessage(
            error instanceof Error
              ? `Export stopped, but its cancellation state did not save. ${error.message}`
              : 'Export stopped, but its cancellation state did not save.',
          );
        }
      }
    }
    setExportRunning(false);
  }

  if (!document)
    return (
      <main className="library-workspace">
        <p role="alert">This Library file is unavailable.</p>
      </main>
    );

  return (
    <main
      aria-labelledby="library-workspace-title"
      className={`library-workspace library-workstation ${photographs.length === 0 ? (showStatusRow ? 'library-workstation--empty' : 'library-workstation--bare') : 'library-workstation--condensed'}`}
      ref={workstationRef}
      tabIndex={-1}
    >
      <header className="library-workspace__topbar" data-workstation-background>
        <div className="library-workspace__identity">
          <span className="library-start__brand">OpenFilm</span>
          <h1 className="visually-hidden" id="library-workspace-title">
            {props.snapshot.rootName} Library workstation
          </h1>
          <span className="library-workspace__file" title={props.snapshot.rootName}>
            <span className="visually-hidden">Library</span>
            {props.snapshot.rootName} · {photographs.length.toLocaleString()}
            <span className="visually-hidden">
              {' '}
              photograph{photographs.length === 1 ? '' : 's'}
            </span>
          </span>
          <Button
            aria-label="Return to Libraries"
            className="library-workspace__libraries"
            onClick={props.onClose}
            size="small"
            variant="quiet"
          >
            Libraries
          </Button>
        </div>
        <nav aria-label="Workstation modes" className="workstation-modes">
          <button
            aria-label="Grid"
            aria-current={context.mode === 'grid' ? 'page' : undefined}
            onClick={() => setContext((current) => ({ ...current, mode: 'grid' }))}
            type="button"
          >
            <span>Grid</span>
          </button>
          <button
            aria-label="Loupe"
            aria-current={context.mode === 'loupe' ? 'page' : undefined}
            disabled={!active}
            onClick={() => setContext((current) => ({ ...current, mode: 'loupe' }))}
            type="button"
          >
            <span>Loupe</span>
            {!active ? <small>Choose a photograph</small> : null}
          </button>
        </nav>
        <div className="library-workspace__topbar-actions">
          {props.snapshot.status === 'saved' ? (
            <span
              aria-label="Library save state: Saved"
              className="library-save-state library-save-state--saved"
            >
              <span className="visually-hidden">Saved</span>
            </span>
          ) : (
            <span
              aria-label={`Library save state: ${saveStatus}`}
              className={`library-save-state library-save-state--${props.snapshot.status}`}
            >
              {saveStatus}
            </span>
          )}
          {photographs.length > 0 ? (
            <Button
              onClick={() => openSheet(() => setShowExport(true))}
              size="small"
              variant="primary"
            >
              Export
            </Button>
          ) : null}
          <details className="workstation-more" data-workstation-popover="true">
            <summary>Menu</summary>
            <div>
              <strong className="workstation-more__group-label">Library</strong>
              <Button
                disabled={
                  props.snapshot.scan.status === 'scanning' || props.snapshot.status !== 'saved'
                }
                onClick={props.onRefresh}
                size="small"
                variant="quiet"
              >
                Refresh
              </Button>
              {props.snapshot.scan.status === 'scanning' || props.snapshot.status !== 'saved' ? (
                <p className="workstation-more__hint">
                  {props.snapshot.scan.status === 'scanning'
                    ? 'Refresh waits for the current scan.'
                    : 'Resolve Library recovery before refreshing.'}
                </p>
              ) : null}
              <Button
                onClick={() => openSheet(() => setShowGroups(true))}
                size="small"
                variant="quiet"
              >
                Review groups
              </Button>
              <strong className="workstation-more__group-label">View and help</strong>
              <div className="workstation-view workstation-more__view">
                <strong>Sort and layout</strong>
                <div className="workstation-view__panel">
                  <div className="workstation-view__field">
                    <span>Order</span>
                    <Select
                      label="Library ordering"
                      onValueChange={(value) =>
                        setContext((current) => ({
                          ...current,
                          ordering: value as LibraryReviewContext['ordering'],
                        }))
                      }
                      options={[
                        { label: 'Oldest first', value: 'capture-ascending' },
                        { label: 'Newest first', value: 'capture-descending' },
                      ]}
                      value={context.ordering}
                    />
                  </div>
                  <label className="workstation-toggle">
                    <input
                      checked={context.autoAdvance}
                      onChange={(event) =>
                        setContext((current) => ({
                          ...current,
                          autoAdvance: event.currentTarget.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    Auto-advance after review
                  </label>
                  {context.mode === 'grid' ? (
                    <div className="workstation-view__density">
                      <span>Grid size</span>
                      <div className="library-grid-density" role="group" aria-label="Grid density">
                        {LIBRARY_GRID_DENSITIES.map((option) => (
                          <button
                            aria-pressed={density === option}
                            key={option}
                            onClick={() => setDensity(option)}
                            type="button"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <Button
                onClick={() => openSheet(() => setShowShortcuts(true))}
                size="small"
                variant="quiet"
              >
                Keyboard shortcuts
              </Button>
              <strong className="workstation-more__group-label">Recovery</strong>
              {props.historyStatus.canUndo || props.historyStatus.canRedo ? (
                <div className="workstation-history" aria-label="Library history">
                  <Button
                    disabled={!props.historyStatus.canUndo}
                    onClick={() => void undo()}
                    size="small"
                    variant="quiet"
                  >
                    Undo
                  </Button>
                  <Button
                    disabled={!props.historyStatus.canRedo}
                    onClick={() => void redo()}
                    size="small"
                    variant="quiet"
                  >
                    Redo
                  </Button>
                </div>
              ) : null}
              <Button onClick={props.onDownloadLibraryBackup} size="small" variant="quiet">
                Download Library backup
              </Button>
            </div>
          </details>
        </div>
      </header>

      {showStatusRow ? (
        <div className="workstation-status-row" data-workstation-background>
          {statusMessage ? (
            <p aria-live="polite" role="status">
              {statusMessage}
            </p>
          ) : null}
          <ScanSummary
            key={context.mode}
            onCancel={props.onCancelScan}
            onRefresh={props.onRefresh}
            onReauthorize={() => void props.onReauthorizeScan()}
            snapshot={props.snapshot}
          />
        </div>
      ) : null}

      {photographs.length > 0 && active ? (
        <ActiveReviewRail
          active={active}
          canMutate={canMutate}
          context={context}
          onReview={review}
          onToggleSelection={() =>
            setContext((current) => toggleLibrarySelection(current, active.id))
          }
        >
          <details className="workstation-context-tools" data-workstation-popover="true">
            <summary>
              Tools
              <span aria-label={`Selection count: ${context.selection.length}`}>
                {context.selection.length
                  ? `${context.selection.length} selected`
                  : activeFilterCount
                    ? `${activeFilterCount} filtered`
                    : 'Review options'}
              </span>
            </summary>
            <div className="workstation-context-tools__panel workstation-review-tools__panel">
              <div className="workstation-review-tools__actions">
                <Button
                  disabled={!canMutate}
                  onClick={() => (inspectorOpen ? closeInspector() : openInspector())}
                  size="small"
                  variant="primary"
                >
                  Edit
                </Button>
                <Button
                  aria-describedby={!comparisonReady ? 'comparison-requirement' : undefined}
                  disabled={!comparisonReady}
                  onClick={enterComparison}
                  size="small"
                  variant="outline"
                >
                  {comparisonReady ? `Compare ${comparisonCount}` : 'Compare'}
                </Button>
                {active.disposition !== 'unmarked' ? (
                  <Button
                    disabled={!canMutate}
                    onClick={() => review({ kind: 'set-disposition', disposition: 'unmarked' })}
                    size="small"
                    variant="quiet"
                  >
                    Clear mark
                  </Button>
                ) : null}
                {context.selection.length ? (
                  <Button
                    onClick={() => setContext((current) => ({ ...current, selection: [] }))}
                    size="small"
                    variant="quiet"
                  >
                    Clear Selection
                  </Button>
                ) : null}
              </div>
              {!comparisonReady ? (
                <p className="workstation-review-tools__requirement" id="comparison-requirement">
                  Select two to four photographs to compare them.
                </p>
              ) : null}
              <div className="workstation-review-tools__filters">
                <div className="workstation-review-tools__field">
                  <span>Review</span>
                  <Select
                    label="Review status filter"
                    onValueChange={(value) =>
                      setFilter({
                        disposition: value
                          ? (value as LibraryPhotographRecord['disposition'])
                          : undefined,
                      })
                    }
                    options={[
                      { label: `All (${photographs.length})`, value: '' },
                      {
                        label: `Unreviewed (${reviewStatusCounts.unmarked})`,
                        value: 'unmarked',
                      },
                      { label: `Picks (${reviewStatusCounts.pick})`, value: 'pick' },
                      { label: `Rejects (${reviewStatusCounts.reject})`, value: 'reject' },
                    ]}
                    value={context.filter.disposition ?? ''}
                  />
                </div>
                <div className="workstation-review-tools__field">
                  <span>Rating</span>
                  <Select
                    label="Minimum Rating filter"
                    onValueChange={(value) =>
                      setFilter({
                        minimumRating: value ? Number(value) : undefined,
                      })
                    }
                    options={[
                      { label: 'Any', value: '' },
                      ...[1, 2, 3, 4, 5].map((rating) => ({
                        label: `${rating}+ stars`,
                        value: String(rating),
                      })),
                    ]}
                    value={String(context.filter.minimumRating ?? '')}
                  />
                </div>
                <div className="workstation-review-tools__field">
                  <span>Source</span>
                  <Select
                    label="Source state filter"
                    onValueChange={(value) =>
                      setFilter({
                        sourceState:
                          value === 'available' || value === 'missing' ? value : undefined,
                        unsupportedOnly: value === 'unsupported' ? true : undefined,
                      })
                    }
                    options={[
                      { label: 'All', value: '' },
                      { label: 'Available', value: 'available' },
                      { label: 'Missing', value: 'missing' },
                      { label: 'Unsupported scan results', value: 'unsupported' },
                    ]}
                    value={
                      context.filter.unsupportedOnly
                        ? 'unsupported'
                        : (context.filter.sourceState ?? '')
                    }
                  />
                </div>
                <div className="workstation-review-tools__field">
                  <span>Analysis</span>
                  <Select
                    label="Analysis completion filter"
                    onValueChange={(value) =>
                      setFilter({
                        analysisComplete:
                          value === 'complete' ? true : value === 'pending' ? false : undefined,
                      })
                    }
                    options={[
                      { label: 'Any', value: '' },
                      { label: 'Complete', value: 'complete' },
                      { label: 'Not complete', value: 'pending' },
                    ]}
                    value={
                      context.filter.analysisComplete === true
                        ? 'complete'
                        : context.filter.analysisComplete === false
                          ? 'pending'
                          : ''
                    }
                  />
                </div>
              </div>
              {activeFilterCount ? (
                <Button
                  onClick={() =>
                    setContext((current) => ({
                      ...current,
                      filter: {},
                    }))
                  }
                  size="small"
                  variant="quiet"
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
          </details>
          {props.snapshot.scan.status !== 'complete' ||
          props.snapshot.scan.unsupportedFiles.length ? (
            <div className="workstation-scan-summary">
              <ScanSummary
                onCancel={props.onCancelScan}
                onRefresh={props.onRefresh}
                onReauthorize={() => void props.onReauthorizeScan()}
                snapshot={props.snapshot}
              />
            </div>
          ) : null}
          {statusMessage ? (
            <p aria-live="polite" className="workstation-toolbar__message" role="status">
              {statusMessage}
            </p>
          ) : null}
          <span aria-live="polite" className="visually-hidden">
            Background jobs complete. {photographs.length.toLocaleString()} photographs ready.
          </span>
        </ActiveReviewRail>
      ) : null}

      <section
        aria-label="Adaptive Filmstrip Stage"
        className={`adaptive-stage adaptive-stage--${context.mode} ${context.mode === 'grid' && groups.length ? 'adaptive-stage--grouped' : ''} ${context.mode === 'grid' && ambiguousSources.length ? 'adaptive-stage--reconciling' : ''}`}
        data-workstation-background
      >
        {context.mode === 'grid' ? (
          <>
            {ambiguousSources.length ? (
              <section aria-label="Source identity choices" className="reconciliation-banner">
                {ambiguousSources.map((discovered) => (
                  <div key={discovered.id}>
                    <span>
                      {discovered.relativePath} matches more than one Missing Photograph record.
                    </span>
                    {(discovered.reconciliationCandidates as string[]).map((candidateId) => {
                      const candidate = photographs.find((item) => item.id === candidateId);
                      return candidate ? (
                        <Button
                          disabled={!canMutate}
                          key={candidateId}
                          onClick={() =>
                            void commit(
                              resolveLibrarySourceChoice(document, discovered.id, candidateId),
                              `Relinked ${discovered.relativePath} to ${candidate.fileName}.`,
                            )
                          }
                          size="small"
                          variant="outline"
                        >
                          Use state from {candidate.fileName}
                        </Button>
                      ) : null;
                    })}
                  </div>
                ))}
              </section>
            ) : null}
            {groups.length ? (
              <div aria-label="Grid Review group headers" className="review-group-strip">
                {groups.map((group, index) => (
                  <section key={group.id}>
                    <button
                      aria-expanded={group.expanded}
                      onClick={() =>
                        void commit(
                          toggleReviewGroup(document, group.id),
                          `${group.expanded ? 'Collapsed' : 'Expanded'} Review group ${index + 1}.`,
                        )
                      }
                      type="button"
                    >
                      Group {index + 1} · {group.photographIds.length} ·{' '}
                      {group.origin[0].toUpperCase() + group.origin.slice(1)}
                    </button>
                    {group.expanded ? (
                      <div>
                        <span>
                          {group.photographIds
                            .map((id) => photographs.find((photo) => photo.id === id)?.fileName)
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                        <button
                          onClick={() =>
                            setContext((current) => ({
                              ...current,
                              activePhotographId:
                                group.photographIds[0] ?? current.activePhotographId,
                              selection: [...group.photographIds],
                            }))
                          }
                          type="button"
                        >
                          Select group
                        </button>
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>
            ) : null}
            {context.filter.unsupportedOnly ? (
              <div aria-label="Unsupported scan results" className="unsupported-results">
                <h2>Unsupported scan results</h2>
                {props.snapshot.scan.unsupportedFiles.length ? (
                  <ul>
                    {props.snapshot.scan.unsupportedFiles.map((file) => (
                      <li key={file.relativePath}>
                        {file.relativePath} · {file.extension || 'unknown format'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No unsupported files were found in the last complete scan.</p>
                )}
              </div>
            ) : photographs.length === 0 ? (
              <div className="workstation-empty">
                <h2>
                  {props.snapshot.scan.status === 'scanning'
                    ? 'Reading the folder'
                    : 'No photographs found'}
                </h2>
                <p>
                  {props.snapshot.scan.status === 'scanning'
                    ? 'JPEG, PNG, and WebP photographs will appear here as OpenFilm finds them.'
                    : 'Add JPEG, PNG, or WebP photographs to this folder, then refresh the Library.'}
                </p>
                {props.snapshot.scan.status !== 'scanning' ? (
                  <Button
                    disabled={props.snapshot.status !== 'saved'}
                    onClick={props.onRefresh}
                    size="small"
                    variant="outline"
                  >
                    Refresh Library
                  </Button>
                ) : null}
              </div>
            ) : visible.length === 0 ? (
              <div className="workstation-empty">
                <h2>
                  {context.filter.disposition === 'reject'
                    ? 'No rejected photographs'
                    : context.filter.disposition === 'pick'
                      ? 'No Picks match'
                      : context.filter.disposition === 'unmarked'
                        ? 'Review complete'
                        : 'No photographs match'}
                </h2>
                <p>
                  {context.filter.disposition === 'reject'
                    ? 'Photographs appear here when you mark them as Rejects. Source files are never deleted.'
                    : context.filter.disposition === 'unmarked'
                      ? 'Every photograph has a review mark. Show all photographs to keep working.'
                      : 'Show all photographs to return to the full Grid.'}
                </p>
                <Button
                  onClick={() =>
                    setContext((current) => ({
                      ...current,
                      filter: {},
                    }))
                  }
                  size="small"
                  variant="outline"
                >
                  Show all photographs
                </Button>
              </div>
            ) : (
              <LibraryGrid
                activePhotographId={active?.id ?? null}
                canReview={canMutate}
                density={density}
                initialScrollTop={gridScrollTop}
                onActivate={(id) =>
                  setContext((current) => ({ ...current, activePhotographId: id }))
                }
                onLoadThumbnail={props.onLoadThumbnail}
                onOpenLoupe={(id) => {
                  const photograph = photographs.find((item) => item.id === id);
                  setContext((current) => ({
                    ...current,
                    activePhotographId: id,
                    mode: 'loupe',
                  }));
                  setMessage(`Loupe · ${photograph?.fileName ?? 'photograph'}`);
                }}
                onReview={(id, command) => review(command, id)}
                onScrollTopChange={setGridScrollTop}
                onToggleSelection={(id) =>
                  setContext((current) => toggleLibrarySelection(current, id))
                }
                photographs={visible}
                selectedPhotographIds={selectionSet}
                scrollRestoreRevision={gridRestoreRevision}
              />
            )}
          </>
        ) : context.mode === 'loupe' && active ? (
          <div className="loupe-stage">
            <div className="stage-view-controls">
              {!sourceZoomAvailable ? (
                <span className="stage-view-controls__hint" id="source-zoom-requirement">
                  100% is unavailable for this Source size
                </span>
              ) : null}
              <Button onClick={() => setZoomScale(1)} size="small" variant="quiet">
                Fit
              </Button>
              <Button
                aria-describedby={!sourceZoomAvailable ? 'source-zoom-requirement' : undefined}
                disabled={!sourceZoomAvailable}
                onClick={() => setZoomScale(2)}
                size="small"
                variant="quiet"
              >
                100%
              </Button>
              <Button
                aria-pressed={sourceView}
                onClick={() => setSourceView((current) => !current)}
                size="small"
                variant="quiet"
              >
                Source
              </Button>
            </div>
            <LibraryPhotoView
              onLoadSource={props.onLoadSource}
              onSourceZoomAvailability={setSourceZoomAvailable}
              photograph={active}
              renderGeneration={renderGeneration}
              sourceView={sourceView}
              zoomScale={zoomScale}
            />
            <div aria-label="Nearby photographs" className="loupe-filmstrip">
              {visible
                .slice(
                  Math.max(0, visible.findIndex((photo) => photo.id === active.id) - 10),
                  Math.max(0, visible.findIndex((photo) => photo.id === active.id) - 10) +
                    FILMSTRIP_WINDOW,
                )
                .map((photo) => (
                  <button
                    aria-current={photo.id === active.id ? 'true' : undefined}
                    key={photo.id}
                    onClick={() =>
                      setContext((current) => ({ ...current, activePhotographId: photo.id }))
                    }
                    type="button"
                  >
                    {photo.fileName}
                  </button>
                ))}
            </div>
          </div>
        ) : context.mode === 'comparison' && comparison ? (
          <div className={`comparison-stage comparison-stage--${comparison.panes.length}`}>
            <div className="stage-view-controls comparison-stage__controls">
              <div>
                <strong>Comparing {comparison.panes.length}</strong>
                <span>Click a photo to make it Active</span>
              </div>
              <Button
                onClick={() => {
                  setComparison(null);
                  setContext((current) => ({ ...current, mode: 'grid' }));
                }}
                size="small"
                variant="quiet"
              >
                Back to Grid
              </Button>
              <Button
                onClick={() =>
                  setComparison((current) =>
                    current
                      ? {
                          ...current,
                          fit: true,
                          panes: current.panes.map((pane) => ({ ...pane, zoomScale: 1 })),
                        }
                      : current,
                  )
                }
                size="small"
                variant="quiet"
              >
                Shared Fit
              </Button>
              <Button
                aria-pressed={sourceView}
                onClick={() => setSourceView((current) => !current)}
                size="small"
                variant="quiet"
              >
                Source
              </Button>
            </div>
            {comparison.panes.map((pane, index) => {
              const photograph = photographs.find((photo) => photo.id === pane.photographId);
              if (!photograph) return null;
              const paneFocalPoint = mapSourceFocalPointToPane(
                comparison.focalPoint,
                sourceView ? neutralGeometry : getLibraryEdit(photograph).geometry,
              );
              return (
                <article
                  aria-label={`Comparison pane ${index + 1}, ${photograph.fileName}, ${pane.linked ? 'linked' : 'unlinked'}, resolution limited`}
                  className={`comparison-pane ${active?.id === photograph.id ? 'comparison-pane--active' : ''}`}
                  key={pane.photographId}
                >
                  <button
                    aria-label={`Make ${photograph.fileName} the Active photograph`}
                    className="comparison-pane__image"
                    onClick={(event) => {
                      setContext((current) => ({ ...current, activePhotographId: photograph.id }));
                      const bounds = event.currentTarget.getBoundingClientRect();
                      setComparison((current) =>
                        current
                          ? setComparisonZoom(current, pane.photographId, pane.zoomScale, {
                              x: (event.clientX - bounds.left) / Math.max(1, bounds.width),
                              y: (event.clientY - bounds.top) / Math.max(1, bounds.height),
                            })
                          : current,
                      );
                    }}
                    style={
                      {
                        '--comparison-origin-x': `${paneFocalPoint.x * 100}%`,
                        '--comparison-origin-y': `${paneFocalPoint.y * 100}%`,
                        '--comparison-zoom': pane.zoomScale,
                      } as CSSProperties
                    }
                    type="button"
                  >
                    <ComparisonPreview
                      onLoadThumbnail={props.onLoadComparisonThumbnail}
                      photograph={photograph}
                      renderGeneration={renderGeneration}
                      sourceView={sourceView}
                    />
                  </button>
                  <footer>
                    <span>
                      {photograph.fileName} · {sourceView ? 'Source preview' : 'Rendered preview'}
                      {' · '}Resolution limited
                    </span>
                    <button
                      aria-pressed={pane.linked}
                      onClick={() =>
                        setComparison((current) =>
                          current ? toggleComparisonPaneLink(current, pane.photographId) : current,
                        )
                      }
                      type="button"
                    >
                      {pane.linked ? 'Linked' : 'Unlinked'}
                    </button>
                    <button
                      onClick={() =>
                        setComparison((current) =>
                          current
                            ? setComparisonZoom(
                                current,
                                pane.photographId,
                                current.panes.find(
                                  (item) => item.photographId === pane.photographId,
                                )!.zoomScale === 1
                                  ? 2
                                  : 1,
                                current.focalPoint,
                              )
                            : current,
                        )
                      }
                      type="button"
                    >
                      Zoom
                    </button>
                    <button
                      disabled={comparison.panes.length <= 2}
                      onClick={() =>
                        setComparison((current) =>
                          current ? removeComparisonPane(current, pane.photographId) : current,
                        )
                      }
                      title={
                        comparison.panes.length <= 2
                          ? 'Comparison keeps at least two panes'
                          : 'Remove this pane'
                      }
                      type="button"
                    >
                      Remove pane
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="workstation-no-matches">Choose an Active photograph.</p>
        )}
      </section>

      {inspectorOpen && active ? (
        <div>
          <EditInspector
            active={active}
            canMutate={canMutate}
            customLooks={props.customLooks}
            document={document}
            expanded={editSection}
            onChange={(next) =>
              void commit(
                next,
                `Saved Edit revision ${getLibraryEdit(next.photographs.find((photo) => photo.id === active.id)!).revision}.`,
              )
            }
            onClose={closeInspector}
            onCopy={() => {
              try {
                const next = copyActiveLookToSelection(document, active.id, context.selection);
                void commit(
                  next,
                  `Copied ${active.fileName}'s Look to ${context.selection.length} selected photographs.`,
                );
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : 'OpenFilm could not copy that Look.',
                );
              }
            }}
            onExpand={setEditSection}
            selectionCount={context.selection.length}
          />
        </div>
      ) : null}

      {showGroups ? (
        <aside
          aria-label="Review groups"
          aria-modal="true"
          className="workstation-sheet"
          data-openfilm-modal="true"
          role="dialog"
        >
          <header>
            <h2>Review groups</h2>
            <Button
              onClick={() => closeSheet(() => setShowGroups(false))}
              size="small"
              variant="quiet"
            >
              Close
            </Button>
          </header>
          <section>
            <h3>Burst proposals</h3>
            {proposals.length ? (
              proposals.map((proposal) => (
                <div className="review-proposal" key={proposal.id}>
                  <span>{proposal.photographIds.length} photographs</span>
                  <Button
                    disabled={!canMutate}
                    onClick={() =>
                      void commit(
                        acceptReviewProposal(document, proposal),
                        'Accepted Burst proposal as a Review group.',
                      )
                    }
                    size="small"
                    variant="primary"
                  >
                    Accept
                  </Button>
                  <Button
                    disabled={!canMutate}
                    onClick={() =>
                      void commit(
                        dismissReviewProposal(document, proposal.id),
                        'Dismissed Burst proposal.',
                      )
                    }
                    size="small"
                    variant="quiet"
                  >
                    Dismiss
                  </Button>
                </div>
              ))
            ) : (
              <p>No pending Burst proposals.</p>
            )}
          </section>
          <section>
            <h3>Groups</h3>
            {groups.map((group) => (
              <div className="review-proposal" key={group.id}>
                <span>
                  {group.photographIds.length} photographs · {group.origin}
                </span>
                <Button
                  disabled={!canMutate || group.photographIds.length < 2}
                  onClick={() =>
                    void commit(
                      splitReviewGroup(
                        document,
                        group.id,
                        Math.floor(group.photographIds.length / 2),
                      ),
                      'Split Review group.',
                    )
                  }
                  size="small"
                  variant="quiet"
                >
                  Split
                </Button>
                <Button
                  disabled={!canMutate}
                  onClick={() => {
                    if (
                      globalThis.confirm(
                        'Dissolve this Review group? The photographs stay in the Library and the change can be undone.',
                      )
                    ) {
                      void commit(
                        dissolveReviewGroup(document, group.id),
                        'Dissolved Review group.',
                      );
                    }
                  }}
                  size="small"
                  variant="quiet"
                >
                  Dissolve
                </Button>
              </div>
            ))}
            {groups.length > 1 ? (
              <Button
                disabled={!canMutate}
                onClick={() => {
                  if (
                    globalThis.confirm(
                      'Merge the first two Review groups? The change can be undone from Library history.',
                    )
                  ) {
                    void commit(
                      mergeReviewGroups(document, groups[0].id, groups[1].id),
                      'Merged Review groups.',
                    );
                  }
                }}
                size="small"
                variant="outline"
              >
                Merge first two groups
              </Button>
            ) : null}
          </section>
        </aside>
      ) : null}

      {showExport ? (
        <aside
          aria-label="Export final set"
          aria-modal="true"
          className="workstation-sheet workstation-sheet--export"
          data-openfilm-modal="true"
          role="dialog"
        >
          <header>
            <h2>Export final set</h2>
            <Button
              onClick={() => closeSheet(() => setShowExport(false))}
              size="small"
              variant="quiet"
            >
              Close
            </Button>
          </header>
          <p>
            Rendered images assume sRGB, strip source metadata, and are not archival or
            print-fidelity masters.
          </p>
          <fieldset>
            <legend>Photographs</legend>
            <label>
              <input
                checked={exportMode === 'picks'}
                onChange={() => setExportMode('picks')}
                type="radio"
              />
              All Picks
            </label>
            <label>
              <input
                checked={exportMode === 'selection'}
                onChange={() => setExportMode('selection')}
                type="radio"
              />
              Current Selection · {context.selection.length}
            </label>
          </fieldset>
          <Button disabled={exportRunning} onClick={() => void prepareExport()} variant="primary">
            Choose folder to preview or resume
          </Button>
          <Button disabled={exportRunning} onClick={prepareDownloadFallback} variant="outline">
            Prepare bounded downloads
          </Button>
          {exportManifest ? (
            <>
              <div aria-live="polite" className="export-summary" role="status">
                <strong>
                  {exportCounts?.complete ?? 0} of {exportManifest.entries.length} exported
                </strong>
                <span>
                  {exportCounts?.failed ? `${exportCounts.failed} failed` : 'No failures'}
                  {(exportCounts?.pending ?? 0) + (exportCounts?.writing ?? 0) > 0
                    ? ` · ${(exportCounts?.pending ?? 0) + (exportCounts?.writing ?? 0)} remaining`
                    : ''}
                  {exportCounts?.cancelled ? ` · ${exportCounts.cancelled} cancelled` : ''}
                </span>
              </div>
              <ol className="export-manifest-preview">
                {exportManifest.entries.map((entry) => (
                  <li key={entry.photographId}>
                    <span>{entry.destinationPath}</span>
                    <span>
                      {entry.state}
                      {entry.failure ? ` · ${entry.failure}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="workstation-sheet__actions">
                {!exportDestination ? (
                  <p className="export-requirement" id="folder-export-requirement">
                    Choose a folder above to start or resume a folder Export.
                  </p>
                ) : null}
                <Button
                  aria-describedby={!exportDestination ? 'folder-export-requirement' : undefined}
                  disabled={exportRunning || !exportDestination}
                  onClick={() => void runExport(true)}
                  variant="primary"
                >
                  {exportRunning
                    ? 'Exporting…'
                    : exportCounts?.failed && !exportCounts.pending && !exportCounts.writing
                      ? 'Retry failed'
                      : 'Start folder Export'}
                </Button>
                <Button
                  aria-describedby="download-fallback-limit"
                  disabled={
                    exportRunning || exportManifest.entries.length > DOWNLOAD_FALLBACK_LIMIT
                  }
                  onClick={() => void runExport(false)}
                  variant="outline"
                >
                  Download fallback
                </Button>
                {exportRunning ? (
                  <Button
                    onClick={() => {
                      exportCancelledRef.current = true;
                      setExportCancelled(true);
                    }}
                    variant="quiet"
                  >
                    Cancel after current photograph
                  </Button>
                ) : null}
              </div>
              {exportCancelled ? <p role="status">Export cancellation requested.</p> : null}
              <p id="download-fallback-limit">
                The download fallback is limited to {DOWNLOAD_FALLBACK_LIMIT} photographs and cannot
                resume after reload.
              </p>
            </>
          ) : null}
        </aside>
      ) : null}

      {showShortcuts ? (
        <div
          aria-label="Keyboard shortcuts"
          aria-modal="true"
          className="shortcut-dialog"
          data-openfilm-modal="true"
          role="dialog"
        >
          <div>
            <header>
              <h2>Keyboard shortcuts</h2>
              <Button
                onClick={() => closeSheet(() => setShowShortcuts(false))}
                size="small"
                variant="quiet"
              >
                Close
              </Button>
            </header>
            <dl>
              <dt>Space</dt>
              <dd>Add or remove the Active photo from Selection</dd>
              <dt>Left / Right</dt>
              <dd>Move the Active photo</dd>
              <dt>Shift + Left / Right</dt>
              <dd>Extend Selection</dd>
              <dt>0–5</dt>
              <dd>Clear or set Rating</dd>
              <dt>P / X / U</dt>
              <dd>Pick, Reject, Unmarked</dd>
              <dt>Enter / Escape</dt>
              <dd>Open Loupe, return to Grid</dd>
              <dt>C / E</dt>
              <dd>Comparison, Edit inspector</dd>
              <dt>Space / Z in Loupe</dt>
              <dd>Hold 100%, toggle zoom</dd>
              <dt>?</dt>
              <dd>Show this shortcut list</dd>
            </dl>
          </div>
        </div>
      ) : null}

      {props.snapshot.status === 'unsaved' ? (
        <section
          aria-label="Unsaved Library recovery"
          className="library-recovery-bar"
          data-workstation-background
          role="alert"
        >
          <span>Unsaved Library. Viewing remains available; changes wait for recovery.</span>
          <Button onClick={props.onRetry} size="small" variant="primary">
            Retry
          </Button>
          <Button onClick={props.onSaveCopy} size="small" variant="outline">
            Save a copy
          </Button>
          <Button onClick={props.onRevert} size="small" variant="quiet">
            Revert
          </Button>
        </section>
      ) : null}
      {props.snapshot.status === 'read-only' ? (
        <section
          aria-label="Read-only Library recovery"
          className="library-recovery-bar"
          data-workstation-background
          role="alert"
        >
          <span>Read-only Library. Reauthorize the folder to save changes.</span>
          <Button onClick={props.onReauthorize} size="small" variant="primary">
            Reauthorize
          </Button>
        </section>
      ) : null}
    </main>
  );
}
