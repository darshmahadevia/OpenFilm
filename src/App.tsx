import { useEffect, useReducer, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent, PointerEvent, ReactNode } from 'react';

import {
  adjustmentDefinitions,
  adjustmentGroups,
  coreAdjustmentKeys,
  formatAdjustmentValue,
  neutralAdjustments,
  type AdjustmentGroup,
  type AdjustmentKey,
  type AdjustmentValues,
} from './editor/adjustments';
import {
  createEditHistory,
  EDIT_HISTORY_LIMIT,
  editHistoryReducer,
  hasNonNeutralEdit,
  type EditHistoryAction,
} from './editor/editHistory';
import {
  bundledLooks,
  normalizeLookDescription,
  normalizeLookTitle,
  type BundledLook,
} from './editor/looks';
import {
  createPreset,
  getPresetFileName,
  readPresetFile,
  serializePreset,
  type Preset,
} from './editor/presets';
import {
  editorReducer,
  editorTools,
  initialEditorState,
  type EditorTool,
} from './editor/editorState';
import {
  cropAspectRatioOptions,
  cropForAspectRatio,
  hasNonNeutralGeometry,
  moveCrop,
  normalizeCrop,
  neutralGeometry,
  resizeCrop,
  type CropAspectRatio,
  type CropHandle,
  type GeometryValues,
  type NormalizedCrop,
} from './editor/geometry';
import { createGrainSeed, DEFAULT_GRAIN_SEED } from './editor/grain';
import {
  createBundledSamplePhotographFile,
  describeSourcePhotographImportError,
  importSourcePhotograph,
  releaseSourcePhotographObjectUrl,
  type ImportedSourcePhotograph,
} from './import';
import {
  createRenderer,
  describeRendererStatus,
  neutralRendererAdjustments,
  RendererError,
  type PreviewRenderer,
  type RendererAdjustments,
  type RendererStatus,
  type LuminanceHistogram,
} from './rendering/renderer';
import {
  describeExportAllocationWarning,
  describeExportDimensionIssue,
  defaultExportOptions,
  exportFormatOptions,
  getExportDimensionIssue,
  getExportDimensions,
  getExportFileName,
  isLossyExportFormat,
  isLikelyOversizedExport,
  MAX_EXPORT_DIMENSION,
  normalizeMaximumLongEdge,
  type ExportFormat,
} from './rendering/export';
import {
  createBrowserStorage,
  describeStorageError,
  hasBrowserStorage,
  storageNotice,
  type BrowserStorage,
  type StoredEdit,
  type StoredLook,
} from './storage/browserStorage';
import {
  addToneCurvePoint,
  isNeutralToneCurve,
  moveToneCurvePoint,
  removeToneCurvePoint,
  TONE_CURVE_MAX_POINTS,
  TONE_CURVE_STEP,
  type ToneCurvePoint,
} from './editor/toneCurve';
import { Button, Dialog, Disclosure, Field, IconButton, Panel, Slider } from './ui/components';

const toolLabels: Record<EditorTool, string> = {
  adjustments: 'Adjust',
  geometry: 'Geometry',
  looks: 'Looks',
};

const toolDetails: Record<EditorTool, { description: string; title: string }> = {
  adjustments: {
    title: 'Adjustments',
    description: 'Change light, color, and texture.',
  },
  geometry: {
    title: 'Geometry',
    description: 'Crop, rotate, or flip this Edit.',
  },
  looks: {
    title: 'Looks',
    description: 'Apply or save a reusable Look.',
  },
};

const toolContextMessages: Record<EditorTool, string> = {
  adjustments: 'Import a source photograph to change its light, color, and texture.',
  geometry: 'Import a source photograph to crop, rotate, or flip it.',
  looks: 'Import a source photograph to apply or save a Look.',
};

const TONE_CURVE_GESTURE_ID = 'tone-curve-drag';

type LookSource = {
  adjustments: AdjustmentValues;
  description?: string;
  title: string;
};

function createStoredEdit(
  state: { grainSeed: number | null; sourceFileName: string | null },
  editHistory: ReturnType<typeof createEditHistory>,
  sourcePhotograph: ImportedSourcePhotograph | null,
  persistSource = true,
): StoredEdit {
  return {
    grainSeed: state.grainSeed,
    history: {
      future: editHistory.future,
      past: editHistory.past,
      present: editHistory.present,
    },
    savedAt: Date.now(),
    ...(persistSource
      ? {
          source: sourcePhotograph
            ? {
                blob: sourcePhotograph.file,
                fileName: sourcePhotograph.fileName,
                height: sourcePhotograph.height,
                mimeType: sourcePhotograph.mimeType,
                width: sourcePhotograph.width,
              }
            : null,
        }
      : {}),
    sourceFileName: state.sourceFileName,
    version: 1,
  };
}

function createLookId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `look-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function scheduleObjectUrlRelease(objectUrl: string): void {
  let released = false;

  const release = () => {
    if (released) {
      return;
    }

    released = true;

    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Download URLs are best-effort browser resources.
    }
  };

  try {
    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
      window.setTimeout(release, 0);
    } else {
      release();
    }
  } catch {
    release();
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  if (
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function' ||
    typeof document === 'undefined'
  ) {
    throw new Error('This browser could not create a local download.');
  }

  let objectUrl: string | null = null;
  let link: HTMLAnchorElement | null = null;

  try {
    objectUrl = URL.createObjectURL(blob);
    link = document.createElement('a');

    link.download = fileName;
    link.href = objectUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
  } finally {
    link?.remove();

    if (objectUrl) {
      scheduleObjectUrlRelease(objectUrl);
    }
  }
}

function getDuplicateLookTitle(title: string, existingLooks: readonly StoredLook[]): string {
  const existingTitles = new Set(existingLooks.map((look) => look.title));
  const baseTitle = `${title} copy`;

  if (!existingTitles.has(baseTitle)) {
    return baseTitle;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseTitle} ${index}`;

    if (!existingTitles.has(candidate)) {
      return candidate;
    }
  }

  return `${baseTitle} ${Date.now()}`;
}

function adjustmentGestureId(key: AdjustmentKey): string {
  return `adjustment-${key}`;
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
    return true;
  }

  return target instanceof HTMLInputElement
    ? ['email', 'number', 'password', 'search', 'tel', 'text', 'url'].includes(target.type)
    : false;
}

function RendererStatusLabel({ status }: { status: RendererStatus }) {
  const isAvailable = status === 'available';
  const label = isAvailable
    ? 'WebGL2 ready'
    : status === 'context-lost'
      ? 'WebGL2 context lost'
      : 'WebGL2 unavailable';

  return (
    <span className={`renderer-status renderer-status--${status}`}>
      <span aria-hidden="true" className="renderer-status__dot" />
      {label}
    </span>
  );
}

function CanvasStateMessage({
  actionLabel,
  actions,
  children,
  kind = 'neutral',
  onAction,
  title,
}: {
  actionLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
  kind?: 'error' | 'loading' | 'neutral' | 'warning';
  onAction?: () => void;
  title: string;
}) {
  return (
    <div
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
      className={`canvas-stage__state canvas-stage__state--${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <h2>{title}</h2>
      <p>{children}</p>
      {actions ??
        (actionLabel && onAction ? (
          <div className="canvas-stage__actions">
            <Button onClick={onAction} variant="primary">
              {actionLabel}
            </Button>
          </div>
        ) : null)}
    </div>
  );
}

function FeedbackNotice({
  actionLabel,
  disabled = false,
  kind,
  message,
  onAction,
}: {
  actionLabel: string;
  disabled?: boolean;
  kind: 'error' | 'warning';
  message: string;
  onAction: () => void;
}) {
  return (
    <div
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
      className={`feedback-notice feedback-notice--${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <p>{message}</p>
      <Button disabled={disabled} onClick={onAction} size="small" variant="outline">
        {actionLabel}
      </Button>
    </div>
  );
}

function HistogramPanel({
  histogram,
  pending,
}: {
  histogram: LuminanceHistogram | null;
  pending: boolean;
}) {
  const max = histogram?.max ?? 0;

  return (
    <section aria-busy={pending} aria-labelledby="histogram-title" className="histogram-panel">
      <div className="histogram-panel__header">
        <div>
          <h2 id="histogram-title">Histogram</h2>
          <p>Luminance distribution for the visible preview.</p>
        </div>
        <span className="histogram-panel__status">{pending ? 'Updating…' : 'Luminance'}</span>
      </div>
      {histogram && max > 0 ? (
        <svg
          aria-label={`Luminance histogram with ${histogram.sampleCount.toLocaleString()} samples`}
          className="histogram-panel__plot"
          role="img"
          viewBox="0 0 320 120"
        >
          {histogram.bins.map((count, index) => {
            const width = 320 / histogram.bins.length;
            const height = (count / max) * 108;

            return (
              <rect
                height={height}
                key={index}
                width={Math.max(1, width - 1)}
                x={index * width}
                y={112 - height}
              />
            );
          })}
          <path d="M0 112H320" />
        </svg>
      ) : (
        <p className="histogram-panel__empty">
          {pending ? 'Reading the rendered image…' : 'Import a source photograph to see its tones.'}
        </p>
      )}
    </section>
  );
}

function EditHistoryActions({
  canRedo,
  canUndo,
  hasSource,
  onRedo,
  onUndo,
}: {
  canRedo: boolean;
  canUndo: boolean;
  hasSource: boolean;
  onRedo: () => void;
  onUndo: () => void;
}) {
  return (
    <div aria-label="Edit history" className="history-actions">
      <Button
        aria-keyshortcuts="Control+Z Meta+Z"
        disabled={!hasSource || !canUndo}
        onClick={onUndo}
        size="small"
        variant="quiet"
      >
        Undo
      </Button>
      <Button
        aria-keyshortcuts="Control+Y Control+Shift+Z Meta+Shift+Z"
        disabled={!hasSource || !canRedo}
        onClick={onRedo}
        size="small"
        variant="quiet"
      >
        Redo
      </Button>
    </div>
  );
}

function EditHistoryDisclosure({
  canRedo,
  canUndo,
  hasSource,
  onRedo,
  onUndo,
}: {
  canRedo: boolean;
  canUndo: boolean;
  hasSource: boolean;
  onRedo: () => void;
  onUndo: () => void;
}) {
  return (
    <Disclosure
      description="Undo or redo the latest committed Edit changes."
      id="edit-history"
      title="Edit history"
    >
      <EditHistoryActions
        canRedo={canRedo}
        canUndo={canUndo}
        hasSource={hasSource}
        onRedo={onRedo}
        onUndo={onUndo}
      />
      <p className="field__hint">
        The shared history keeps the latest {EDIT_HISTORY_LIMIT} committed changes across
        Adjustments, curve edits, effects, and Geometry.
      </p>
    </Disclosure>
  );
}

function AdjustmentControl({
  adjustments,
  hasSource,
  onAdjustmentChange,
  onAdjustmentGestureEnd,
  onAdjustmentGestureStart,
  onReset,
  adjustmentKey,
}: {
  adjustments: RendererAdjustments;
  adjustmentKey: AdjustmentKey;
  hasSource: boolean;
  onAdjustmentChange: (key: AdjustmentKey, value: number, gestureId: string) => void;
  onAdjustmentGestureEnd: (key: AdjustmentKey) => void;
  onAdjustmentGestureStart: (key: AdjustmentKey) => void;
  onReset: (key: AdjustmentKey) => void;
}) {
  const definition = adjustmentDefinitions[adjustmentKey];
  const value = adjustments[adjustmentKey];

  return (
    <div className="adjustment-control">
      <Slider
        disabled={!hasSource}
        displayValue={formatAdjustmentValue(adjustmentKey, value)}
        hint={`${definition.description} ${definition.rangeHint}`}
        id={adjustmentKey}
        label={definition.label}
        max={definition.max}
        min={definition.min}
        onChange={(event) =>
          onAdjustmentChange(
            adjustmentKey,
            Number(event.currentTarget.value),
            adjustmentGestureId(adjustmentKey),
          )
        }
        onRangeChangeEnd={() => onAdjustmentGestureEnd(adjustmentKey)}
        onRangeChangeStart={() => onAdjustmentGestureStart(adjustmentKey)}
        step={definition.step}
        value={value}
      />
      <Button
        aria-label={`Reset ${definition.label}`}
        disabled={!hasSource || value === definition.neutral}
        onClick={() => onReset(adjustmentKey)}
        size="small"
        variant="outline"
      >
        Reset
      </Button>
    </div>
  );
}

function AdjustmentGroupControl({
  adjustments,
  description,
  group,
  hasSource,
  onAdjustmentChange,
  onAdjustmentGestureEnd,
  onAdjustmentGestureStart,
  onReset,
  onResetGroup,
  title,
}: {
  adjustments: RendererAdjustments;
  description: string;
  group: AdjustmentGroup;
  hasSource: boolean;
  onAdjustmentChange: (key: AdjustmentKey, value: number, gestureId: string) => void;
  onAdjustmentGestureEnd: (key: AdjustmentKey) => void;
  onAdjustmentGestureStart: (key: AdjustmentKey) => void;
  onReset: (key: AdjustmentKey) => void;
  onResetGroup: (group: AdjustmentGroup) => void;
  title: string;
}) {
  const keys = adjustmentGroups[group];
  const hasNonNeutralValue = keys.some(
    (key) => adjustments[key] !== adjustmentDefinitions[key].neutral,
  );

  return (
    <section aria-labelledby={`${group}-title`} className="adjustment-group">
      <div className="adjustment-group__header">
        <div>
          <h3 id={`${group}-title`}>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      {keys.map((adjustmentKey) => (
        <AdjustmentControl
          adjustmentKey={adjustmentKey}
          adjustments={adjustments}
          hasSource={hasSource}
          key={adjustmentKey}
          onAdjustmentChange={onAdjustmentChange}
          onAdjustmentGestureEnd={onAdjustmentGestureEnd}
          onAdjustmentGestureStart={onAdjustmentGestureStart}
          onReset={onReset}
        />
      ))}
      <Button
        aria-label={`Reset ${title}`}
        disabled={!hasSource || !hasNonNeutralValue}
        onClick={() => onResetGroup(group)}
        size="small"
        variant="quiet"
      >
        Reset {title}
      </Button>
    </section>
  );
}

function ToneCurveControl({
  hasSource,
  onGestureEnd,
  onGestureStart,
  onChange,
  onReset,
  points,
}: {
  hasSource: boolean;
  onGestureEnd: () => void;
  onGestureStart: () => void;
  onChange: (points: ToneCurvePoint[], gestureId: string) => void;
  onReset: () => void;
  points: ToneCurvePoint[];
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const draggingIndex = useRef<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const safeSelectedIndex = Math.max(0, Math.min(selectedIndex, points.length - 1));
  const selectedPoint = points[safeSelectedIndex];

  function updatePointFromPointer(index: number, event: PointerEvent<HTMLButtonElement>) {
    const bounds = plotRef.current?.getBoundingClientRect();

    if (!bounds || bounds.width < 1 || bounds.height < 1) {
      return;
    }

    const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const y = Math.min(1, Math.max(0, 1 - (event.clientY - bounds.top) / bounds.height));
    const next = moveToneCurvePoint(points, index, { x, y });

    if (next) {
      onChange(next, TONE_CURVE_GESTURE_ID);
    }
  }

  function handlePointPointerDown(index: number, event: PointerEvent<HTMLButtonElement>) {
    if (!hasSource) {
      return;
    }

    event.preventDefault();
    setSelectedIndex(index);
    draggingIndex.current = index;
    onGestureStart();
    event.currentTarget.setPointerCapture(event.pointerId);
    updatePointFromPointer(index, event);
  }

  function handlePointPointerMove(index: number, event: PointerEvent<HTMLButtonElement>) {
    if (draggingIndex.current === index) {
      updatePointFromPointer(index, event);
    }
  }

  function handlePointPointerUp(index: number, event: PointerEvent<HTMLButtonElement>) {
    if (draggingIndex.current !== index) {
      return;
    }

    draggingIndex.current = null;
    onGestureEnd();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handlePointKeyDown(index: number, event: KeyboardEvent<HTMLButtonElement>) {
    if (!hasSource) {
      return;
    }

    const step = event.shiftKey ? TONE_CURVE_STEP * 5 : TONE_CURVE_STEP;
    let position: Partial<ToneCurvePoint>;

    switch (event.key) {
      case 'ArrowLeft':
        position = { x: points[index].x - step };
        break;
      case 'ArrowRight':
        position = { x: points[index].x + step };
        break;
      case 'ArrowUp':
        position = { y: points[index].y + step };
        break;
      case 'ArrowDown':
        position = { y: points[index].y - step };
        break;
      default:
        return;
    }

    event.preventDefault();
    setSelectedIndex(index);
    const next = moveToneCurvePoint(points, index, position);

    if (next) {
      onChange(next, TONE_CURVE_GESTURE_ID);
    }
  }

  function handleCoordinateChange(axis: keyof ToneCurvePoint, value: string) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return;
    }

    const next = moveToneCurvePoint(points, safeSelectedIndex, { [axis]: numericValue });

    if (next) {
      onChange(next, TONE_CURVE_GESTURE_ID);
    }
  }

  function addPoint() {
    const next = addToneCurvePoint(points);

    if (!next) {
      return;
    }

    const insertedIndex = next.findIndex((point, index) => point.x !== points[index]?.x);
    setSelectedIndex(insertedIndex < 0 ? next.length - 2 : insertedIndex);
    onChange(next, TONE_CURVE_GESTURE_ID);
  }

  function removeSelectedPoint() {
    const next = removeToneCurvePoint(points, safeSelectedIndex);

    if (!next) {
      return;
    }

    setSelectedIndex(Math.max(0, safeSelectedIndex - 1));
    onChange(next, TONE_CURVE_GESTURE_ID);
  }

  return (
    <div className="tone-curve-control">
      <div className="tone-curve-control__header">
        <div>
          <h3>RGB tone curve</h3>
          <p>Shape all three color channels with one bounded curve.</p>
        </div>
        <span className="tone-curve-control__count">
          {points.length} / {TONE_CURVE_MAX_POINTS} points
        </span>
      </div>
      <div aria-label="RGB tone curve plot" className="tone-curve-plot" ref={plotRef} role="group">
        <svg aria-hidden="true" className="tone-curve-plot__grid" viewBox="0 0 100 100">
          <path d="M0 25H100M0 50H100M0 75H100M25 0V100M50 0V100M75 0V100" />
          <path className="tone-curve-plot__neutral" d="M0 100L100 0" />
          <polyline
            className="tone-curve-plot__line"
            points={points.map((point) => `${point.x * 100},${100 - point.y * 100}`).join(' ')}
          />
        </svg>
        {points.map((point, index) => (
          <button
            aria-label={`Tone curve point ${index + 1}, input ${point.x.toFixed(2)}, output ${point.y.toFixed(2)}`}
            aria-pressed={safeSelectedIndex === index}
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
            className={`tone-curve-point ${safeSelectedIndex === index ? 'tone-curve-point--selected' : ''}`}
            disabled={!hasSource}
            key={index}
            onClick={() => setSelectedIndex(index)}
            onKeyDown={(event) => handlePointKeyDown(index, event)}
            onPointerCancel={(event) => handlePointPointerUp(index, event)}
            onPointerDown={(event) => handlePointPointerDown(index, event)}
            onPointerMove={(event) => handlePointPointerMove(index, event)}
            onPointerUp={(event) => handlePointPointerUp(index, event)}
            style={{ left: `${point.x * 100}%`, top: `${(1 - point.y) * 100}%` }}
            type="button"
          >
            <span aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="field__hint">
        Select a point, drag it, use the arrow keys, or edit its input and output values. Endpoints
        keep their input positions; point inputs must stay ordered.
      </p>
      <div className="tone-curve-control__actions">
        <Button
          aria-label="Add tone curve point"
          disabled={!hasSource || points.length >= TONE_CURVE_MAX_POINTS}
          onClick={addPoint}
          size="small"
          variant="outline"
        >
          Add point
        </Button>
        <Button
          aria-label="Remove selected tone curve point"
          disabled={
            !hasSource || safeSelectedIndex === 0 || safeSelectedIndex === points.length - 1
          }
          onClick={removeSelectedPoint}
          size="small"
          variant="outline"
        >
          Remove point
        </Button>
        <Button
          aria-label="Reset tone curve"
          disabled={!hasSource || isNeutralToneCurve(points)}
          onClick={onReset}
          size="small"
          variant="quiet"
        >
          Reset curve
        </Button>
      </div>
      <div className="tone-curve-control__coordinates">
        <Field
          hint="0 to 1; interior inputs must stay between their neighbors."
          id="tone-curve-input"
          label="Input (x)"
        >
          <input
            aria-describedby="tone-curve-input-hint"
            className="slider-field__number"
            disabled={
              !hasSource || safeSelectedIndex === 0 || safeSelectedIndex === points.length - 1
            }
            id="tone-curve-input"
            max={1}
            min={0}
            onChange={(event) => handleCoordinateChange('x', event.currentTarget.value)}
            step={TONE_CURVE_STEP}
            type="number"
            value={selectedPoint.x.toFixed(2)}
          />
        </Field>
        <Field hint="0 to 1." id="tone-curve-output" label="Output (y)">
          <input
            aria-describedby="tone-curve-output-hint"
            className="slider-field__number"
            disabled={!hasSource}
            id="tone-curve-output"
            max={1}
            min={0}
            onChange={(event) => handleCoordinateChange('y', event.currentTarget.value)}
            step={TONE_CURVE_STEP}
            type="number"
            value={selectedPoint.y.toFixed(2)}
          />
        </Field>
      </div>
    </div>
  );
}

interface CropDragState {
  bounds: { height: number; width: number };
  crop: NormalizedCrop;
  handle: CropHandle | 'move';
  startCrop: NormalizedCrop;
  startX: number;
  startY: number;
}

function CropControl({
  geometry,
  hasSource,
  onCropChange,
  sourceDimensions,
}: {
  geometry: GeometryValues;
  hasSource: boolean;
  onCropChange: (crop: NormalizedCrop) => void;
  sourceDimensions: { height: number; width: number } | null;
}) {
  const cropPreviewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<CropDragState | null>(null);
  const [aspectRatio, setAspectRatio] = useState<CropAspectRatio>('free');
  const [draftCrop, setDraftCrop] = useState(geometry.crop);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragRef.current) {
      setDraftCrop(geometry.crop);
    }
  }, [geometry.crop]);

  const visibleCrop = draftCrop;
  const hasFullCrop =
    geometry.crop.x === 0 &&
    geometry.crop.y === 0 &&
    geometry.crop.width === 1 &&
    geometry.crop.height === 1;

  function startDrag(handle: CropHandle | 'move', event: PointerEvent<HTMLElement>) {
    if (!hasSource) {
      return;
    }

    const bounds = cropPreviewRef.current?.getBoundingClientRect();

    if (!bounds || bounds.width < 1 || bounds.height < 1) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      bounds: { height: bounds.height, width: bounds.width },
      crop: geometry.crop,
      handle,
      startCrop: geometry.crop,
      startX: event.clientX,
      startY: event.clientY,
    };
    setDragging(true);
    setDraftCrop(geometry.crop);
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    const deltaX = (event.clientX - drag.startX) / drag.bounds.width;
    const deltaY = (event.clientY - drag.startY) / drag.bounds.height;
    const crop =
      drag.handle === 'move'
        ? moveCrop(drag.startCrop, deltaX, deltaY)
        : resizeCrop(drag.startCrop, drag.handle, deltaX, deltaY);

    drag.crop = crop;
    setDraftCrop(crop);
  }

  function endDrag(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    dragRef.current = null;
    setDragging(false);
    setDraftCrop(drag.crop);
    onCropChange(drag.crop);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleAspectRatioChange(value: string) {
    const nextAspectRatio = cropAspectRatioOptions.some((option) => option.value === value)
      ? (value as CropAspectRatio)
      : 'free';

    setAspectRatio(nextAspectRatio);

    if (sourceDimensions) {
      onCropChange(
        cropForAspectRatio(
          geometry.crop,
          nextAspectRatio,
          sourceDimensions.width,
          sourceDimensions.height,
        ),
      );
    }
  }

  function handleCropValueChange(key: keyof NormalizedCrop, value: string) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return;
    }

    onCropChange(normalizeCrop({ ...geometry.crop, [key]: numericValue / 100 }));
  }

  const cropPreviewStyle = sourceDimensions
    ? { aspectRatio: `${sourceDimensions.width} / ${sourceDimensions.height}` }
    : undefined;

  return (
    <section aria-labelledby="crop-title" className="crop-control">
      <div className="adjustment-group__header">
        <div>
          <h3 id="crop-title">Crop</h3>
          <p>Drag the frame or enter normalized image percentages below.</p>
        </div>
      </div>
      <div
        aria-label="Crop preview"
        className="crop-control__preview"
        ref={cropPreviewRef}
        role="group"
        style={cropPreviewStyle}
      >
        <div className="crop-control__grid" />
        <div
          aria-label="Crop selection"
          className={`crop-control__selection ${dragging ? 'crop-control__selection--dragging' : ''}`}
          onPointerDown={(event) => startDrag('move', event)}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="group"
          style={{
            height: `${visibleCrop.height * 100}%`,
            left: `${visibleCrop.x * 100}%`,
            top: `${visibleCrop.y * 100}%`,
            width: `${visibleCrop.width * 100}%`,
          }}
        >
          {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((handle) => (
            <button
              aria-label={`Resize crop ${handle.replace('-', ' ')}`}
              className={`crop-control__handle crop-control__handle--${handle}`}
              disabled={!hasSource}
              key={handle}
              onPointerCancel={endDrag}
              onPointerDown={(event) => startDrag(handle, event)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              type="button"
            />
          ))}
        </div>
      </div>
      <p className="field__hint">
        The crop stays with this Edit. It is not part of a reusable Look.
      </p>
      <Field
        hint="Free keeps the crop flexible. Other options fit the current selection."
        id="crop-aspect-ratio"
        label="Aspect ratio"
      >
        <select
          aria-describedby="crop-aspect-ratio-hint"
          disabled={!hasSource}
          id="crop-aspect-ratio"
          onChange={(event) => handleAspectRatioChange(event.currentTarget.value)}
          value={hasFullCrop ? 'free' : aspectRatio}
        >
          {cropAspectRatioOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="crop-control__coordinates">
        {(
          [
            ['x', 'Left'],
            ['y', 'Top'],
            ['width', 'Width'],
            ['height', 'Height'],
          ] as const
        ).map(([key, label]) => (
          <Field hint="0 to 100% of the source image." id={`crop-${key}`} key={key} label={label}>
            <input
              aria-label={`Crop ${label.toLowerCase()} value`}
              className="slider-field__number"
              disabled={!hasSource}
              id={`crop-${key}`}
              max={100}
              min={key === 'width' || key === 'height' ? 1 : 0}
              onChange={(event) => handleCropValueChange(key, event.currentTarget.value)}
              step={1}
              type="number"
              value={Math.round(geometry.crop[key] * 100)}
            />
          </Field>
        ))}
      </div>
    </section>
  );
}

function LookCard({
  isCustom,
  look,
  onApply,
  onDelete,
  onDuplicate,
  onExport,
  onRename,
}: {
  isCustom: boolean;
  look: LookSource;
  onApply: (look: LookSource) => void;
  onDelete: (look: StoredLook) => void;
  onDuplicate: (look: LookSource) => void;
  onExport: (look: LookSource) => void;
  onRename: (look: StoredLook) => void;
}) {
  const customLook = isCustom ? (look as StoredLook) : null;

  return (
    <article className="look-card">
      <div className="look-card__copy">
        <h4>{look.title}</h4>
        <p>{look.description || 'A reusable set of photographic Adjustments.'}</p>
      </div>
      <div className="look-card__actions">
        <Button
          aria-label={`Apply ${look.title}`}
          onClick={() => onApply(look)}
          size="small"
          variant="outline"
        >
          Apply
        </Button>
        {customLook ? (
          <>
            <Button
              aria-label={`Rename ${look.title}`}
              onClick={() => onRename(customLook)}
              size="small"
              variant="quiet"
            >
              Rename
            </Button>
            <Button
              aria-label={`Duplicate ${look.title}`}
              onClick={() => onDuplicate(look)}
              size="small"
              variant="quiet"
            >
              Duplicate
            </Button>
            <Button
              aria-label={`Delete ${look.title}`}
              onClick={() => onDelete(customLook)}
              size="small"
              variant="quiet"
            >
              Delete
            </Button>
          </>
        ) : (
          <Button
            aria-label={`Save ${look.title} as a custom Look`}
            onClick={() => onDuplicate(look)}
            size="small"
            variant="quiet"
          >
            Save copy
          </Button>
        )}
        <Button
          aria-label={`Export ${look.title} preset`}
          onClick={() => onExport(look)}
          size="small"
          variant="quiet"
        >
          Export
        </Button>
      </div>
    </article>
  );
}

function LooksControl({
  bundledLooks: bundledLookOptions,
  customLooks,
  hasSource,
  isPresetImporting,
  onApplyLook,
  onDeleteLook,
  onDuplicateLook,
  onExportLook,
  onExportCurrentLook,
  onImportPreset,
  onOpenSaveDialog,
  onOpenRenameDialog,
}: {
  bundledLooks: readonly BundledLook[];
  customLooks: readonly StoredLook[];
  hasSource: boolean;
  isPresetImporting: boolean;
  onApplyLook: (look: LookSource) => void;
  onDeleteLook: (look: StoredLook) => void;
  onDuplicateLook: (look: LookSource) => void;
  onExportCurrentLook: () => void;
  onExportLook: (look: LookSource) => void;
  onImportPreset: () => void;
  onOpenSaveDialog: () => void;
  onOpenRenameDialog: (look: StoredLook) => void;
}) {
  return (
    <div className="control-stack looks-control">
      <section aria-labelledby="bundled-looks-title" className="looks-section">
        <div className="looks-section__header">
          <div>
            <h3 id="bundled-looks-title">Bundled Looks</h3>
            <p>Seven original starting points for a new Edit.</p>
          </div>
          <span className="looks-section__count">{bundledLookOptions.length}</span>
        </div>
        <div className="look-list">
          {bundledLookOptions.map((look) => (
            <LookCard
              isCustom={false}
              key={look.id}
              look={look}
              onApply={onApplyLook}
              onDelete={onDeleteLook}
              onDuplicate={onDuplicateLook}
              onExport={onExportLook}
              onRename={onOpenRenameDialog}
            />
          ))}
        </div>
      </section>
      <section aria-labelledby="custom-looks-title" className="looks-section">
        <div className="looks-section__header">
          <div>
            <h3 id="custom-looks-title">Your Looks</h3>
            <p>Save only the reusable Adjustments, not this Edit’s geometry.</p>
          </div>
          <Button onClick={onOpenSaveDialog} size="small" variant="primary">
            Save current Look
          </Button>
        </div>
        {customLooks.length > 0 ? (
          <div className="look-list">
            {customLooks.map((look) => (
              <LookCard
                isCustom
                key={look.id}
                look={look}
                onApply={onApplyLook}
                onDelete={onDeleteLook}
                onDuplicate={onDuplicateLook}
                onExport={onExportLook}
                onRename={onOpenRenameDialog}
              />
            ))}
          </div>
        ) : (
          <p className="looks-section__empty">Your saved Looks will appear here.</p>
        )}
      </section>
      <Button
        aria-label="Use Neutral Look"
        disabled={!hasSource}
        onClick={() =>
          onApplyLook({
            title: 'Neutral Look',
            description: '',
            adjustments: neutralAdjustments,
          })
        }
        size="small"
        variant="outline"
      >
        Use Neutral Look
      </Button>
      <div className="looks-file-actions">
        <Button
          disabled={isPresetImporting}
          onClick={onImportPreset}
          size="small"
          variant="outline"
        >
          {isPresetImporting ? 'Reading preset…' : 'Import Look preset'}
        </Button>
        <Button onClick={onExportCurrentLook} size="small" variant="outline">
          Export current Look
        </Button>
      </div>
      <p className="field__hint">
        Presets are readable JSON files with one Look. They never include this Edit’s source,
        geometry, history, or Grain seed.
      </p>
      <p className="field__hint">
        A Look changes photographic Adjustments only. Crop, rotation, flips, and grain seed stay
        with this Edit.
      </p>
    </div>
  );
}

function ToolControls({
  activeTool,
  adjustments,
  bundledLookOptions,
  customLooks,
  geometry,
  hasSource,
  hasNonNeutralGeometryValue,
  showDisabledControls,
  isPresetImporting,
  onAdjustmentChange,
  onAdjustmentGestureEnd,
  onAdjustmentGestureStart,
  onApplyLook,
  onCropChange,
  onDeleteLook,
  onDuplicateLook,
  onExportCurrentLook,
  onExportLook,
  onGeometryReset,
  onImportPreset,
  onOpenRenameDialog,
  onOpenSaveDialog,
  onResetAdjustment,
  onReset,
  onResetGroup,
  onResetToneCurve,
  onRotationChange,
  onToneCurveGestureEnd,
  onToneCurveGestureStart,
  onToneCurveChange,
  onToggleFlipHorizontal,
  onToggleFlipVertical,
  sourceDimensions,
}: {
  activeTool: EditorTool;
  adjustments: RendererAdjustments;
  bundledLookOptions: readonly BundledLook[];
  customLooks: readonly StoredLook[];
  geometry: GeometryValues;
  hasSource: boolean;
  hasNonNeutralGeometryValue: boolean;
  showDisabledControls: boolean;
  isPresetImporting: boolean;
  onAdjustmentChange: (key: AdjustmentKey, value: number, gestureId: string) => void;
  onAdjustmentGestureEnd: (key: AdjustmentKey) => void;
  onAdjustmentGestureStart: (key: AdjustmentKey) => void;
  onApplyLook: (look: LookSource) => void;
  onCropChange: (crop: NormalizedCrop) => void;
  onDeleteLook: (look: StoredLook) => void;
  onDuplicateLook: (look: LookSource) => void;
  onExportCurrentLook: () => void;
  onExportLook: (look: LookSource) => void;
  onGeometryReset: () => void;
  onImportPreset: () => void;
  onOpenRenameDialog: (look: StoredLook) => void;
  onOpenSaveDialog: () => void;
  onResetAdjustment: (key: AdjustmentKey) => void;
  onReset: () => void;
  onResetGroup: (group: AdjustmentGroup) => void;
  onResetToneCurve: () => void;
  onRotationChange: (rotation: GeometryValues['rotation']) => void;
  onToneCurveGestureEnd: () => void;
  onToneCurveGestureStart: () => void;
  onToneCurveChange: (points: ToneCurvePoint[], gestureId: string) => void;
  onToggleFlipHorizontal: () => void;
  onToggleFlipVertical: () => void;
  sourceDimensions: { height: number; width: number } | null;
}) {
  if (!hasSource && activeTool !== 'looks' && !showDisabledControls) {
    return (
      <div className="tool-context">
        <p>{toolContextMessages[activeTool]}</p>
      </div>
    );
  }

  if (activeTool === 'geometry') {
    return (
      <div className="control-stack">
        <CropControl
          geometry={geometry}
          hasSource={hasSource}
          onCropChange={onCropChange}
          sourceDimensions={sourceDimensions}
        />
        <Field
          hint="Geometry belongs to this Edit, not its reusable Look."
          id="rotation"
          label="Rotation"
        >
          <select
            aria-describedby="rotation-hint"
            onChange={(event) =>
              onRotationChange(Number(event.currentTarget.value) as GeometryValues['rotation'])
            }
            disabled={!hasSource}
            id="rotation"
            value={geometry.rotation}
          >
            <option value="0">Original orientation</option>
            <option value="90">90° clockwise</option>
            <option value="180">180°</option>
            <option value="270">90° counterclockwise</option>
          </select>
        </Field>
        <div className="field-row">
          <span className="field__label">Flip</span>
          <div className="button-row">
            <Button
              aria-pressed={geometry.flipHorizontal}
              disabled={!hasSource}
              onClick={onToggleFlipHorizontal}
              size="small"
              variant="outline"
            >
              Horizontal
            </Button>
            <Button
              aria-pressed={geometry.flipVertical}
              disabled={!hasSource}
              onClick={onToggleFlipVertical}
              size="small"
              variant="outline"
            >
              Vertical
            </Button>
          </div>
        </div>
        <Button
          aria-label="Reset geometry"
          disabled={!hasSource || !hasNonNeutralGeometryValue}
          onClick={onGeometryReset}
          size="small"
          variant="outline"
        >
          Reset geometry
        </Button>
        <p className="field__hint">
          Edit history keeps the latest {EDIT_HISTORY_LIMIT} committed changes. Geometry stays with
          this Edit and never enters a reusable Look.
        </p>
      </div>
    );
  }

  if (activeTool === 'looks') {
    return (
      <LooksControl
        bundledLooks={bundledLookOptions}
        customLooks={customLooks}
        hasSource={hasSource}
        isPresetImporting={isPresetImporting}
        onApplyLook={onApplyLook}
        onDeleteLook={onDeleteLook}
        onDuplicateLook={onDuplicateLook}
        onExportCurrentLook={onExportCurrentLook}
        onExportLook={onExportLook}
        onImportPreset={onImportPreset}
        onOpenRenameDialog={onOpenRenameDialog}
        onOpenSaveDialog={onOpenSaveDialog}
      />
    );
  }

  return (
    <div className="control-stack">
      {coreAdjustmentKeys.map((adjustmentKey) => (
        <AdjustmentControl
          adjustmentKey={adjustmentKey}
          adjustments={adjustments}
          hasSource={hasSource}
          key={adjustmentKey}
          onAdjustmentChange={onAdjustmentChange}
          onAdjustmentGestureEnd={onAdjustmentGestureEnd}
          onAdjustmentGestureStart={onAdjustmentGestureStart}
          onReset={onResetAdjustment}
        />
      ))}
      <AdjustmentGroupControl
        adjustments={adjustments}
        description="Darken the frame edges with a controlled, image-relative falloff."
        group="vignette"
        hasSource={hasSource}
        onAdjustmentGestureEnd={onAdjustmentGestureEnd}
        onAdjustmentGestureStart={onAdjustmentGestureStart}
        onAdjustmentChange={onAdjustmentChange}
        onReset={onResetAdjustment}
        onResetGroup={onResetGroup}
        title="Vignette"
      />
      <AdjustmentGroupControl
        adjustments={adjustments}
        description="Add a stable texture whose pattern belongs to this Edit."
        group="grain"
        hasSource={hasSource}
        onAdjustmentGestureEnd={onAdjustmentGestureEnd}
        onAdjustmentGestureStart={onAdjustmentGestureStart}
        onAdjustmentChange={onAdjustmentChange}
        onReset={onResetAdjustment}
        onResetGroup={onResetGroup}
        title="Grain"
      />
      <ToneCurveControl
        hasSource={hasSource}
        onGestureEnd={onToneCurveGestureEnd}
        onGestureStart={onToneCurveGestureStart}
        onChange={onToneCurveChange}
        onReset={onResetToneCurve}
        points={adjustments.toneCurve}
      />
      <Button disabled={!hasSource} onClick={onReset} size="small" variant="outline">
        Reset adjustments
      </Button>
    </div>
  );
}

type ExportSizeMode = 'maximum' | 'source';

type StorageStatus = 'checking' | 'available' | 'unavailable' | 'failed';

interface LookDialogState {
  description: string;
  lookId: string | null;
  mode: 'rename' | 'save';
  title: string;
}

function ExportControls({
  canExport,
  estimatedOutputDimensions,
  exportAllocationWarning,
  exportDimensionIssue,
  exportFormat,
  exportMaximumLongEdge,
  exportMaximumLongEdgeInput,
  exportQuality,
  exportSizeMode,
  hasSource,
  isExporting,
  maximumLongEdgeIsValid,
  onDownload,
  onExportFormatChange,
  onExportMaximumLongEdgeChange,
  onExportQualityChange,
  onExportSizeModeChange,
}: {
  canExport: boolean;
  estimatedOutputDimensions: { height: number; width: number } | null;
  exportAllocationWarning: string | null;
  exportDimensionIssue: string | null;
  exportFormat: ExportFormat;
  exportMaximumLongEdge: number | null;
  exportMaximumLongEdgeInput: string;
  exportQuality: number;
  exportSizeMode: ExportSizeMode;
  hasSource: boolean;
  isExporting: boolean;
  maximumLongEdgeIsValid: boolean;
  onDownload: () => void;
  onExportFormatChange: (format: ExportFormat) => void;
  onExportMaximumLongEdgeChange: (value: string) => void;
  onExportQualityChange: (value: number) => void;
  onExportSizeModeChange: (mode: ExportSizeMode) => void;
}) {
  if (!hasSource) {
    return (
      <Disclosure
        description="Choose a format and save a rendered image."
        id="export"
        title="Export"
      >
        <div className="tool-context">
          <p>Import a source photograph to export the finished Edit.</p>
        </div>
      </Disclosure>
    );
  }

  const formatOption = exportFormatOptions.find((option) => option.value === exportFormat);

  return (
    <Disclosure
      description="Re-encode the current Edit without changing the source photograph."
      id="export"
      title="Export"
    >
      <div className="export-controls">
        <Field
          hint="The browser re-encodes the rendered image, so source metadata is not copied."
          id="export-format"
          label="Format"
        >
          <select
            aria-describedby="export-format-hint"
            disabled={!hasSource}
            id="export-format"
            onChange={(event) => onExportFormatChange(event.currentTarget.value as ExportFormat)}
            value={exportFormat}
          >
            {exportFormatOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        {isLossyExportFormat(exportFormat) ? (
          <Slider
            disabled={!hasSource}
            displayValue={`${exportQuality}%`}
            hint={`${formatOption?.label ?? 'Lossy'} quality from 1 to 100. Higher values usually create larger files.`}
            id="export-quality"
            label="Quality"
            max={100}
            min={1}
            onChange={(event) => onExportQualityChange(Number(event.currentTarget.value))}
            step={1}
            value={exportQuality}
          />
        ) : null}

        <Field
          hint="Source dimensions keeps the rendered crop at its natural size. A maximum long edge never enlarges it."
          id="export-size"
          label="Output size"
        >
          <select
            aria-describedby="export-size-hint"
            disabled={!hasSource}
            id="export-size"
            onChange={(event) =>
              onExportSizeModeChange(event.currentTarget.value as ExportSizeMode)
            }
            value={exportSizeMode}
          >
            <option value="source">Source dimensions</option>
            <option value="maximum">Maximum long edge</option>
          </select>
        </Field>

        {exportSizeMode === 'maximum' ? (
          <Field
            hint="The current Edit will not be upscaled when this value exceeds its natural long edge."
            id="export-long-edge"
            label="Maximum long edge"
          >
            <input
              aria-describedby="export-long-edge-hint"
              className="export-controls__number"
              disabled={!hasSource}
              id="export-long-edge"
              inputMode="numeric"
              max={MAX_EXPORT_DIMENSION}
              min={1}
              onChange={(event) => onExportMaximumLongEdgeChange(event.currentTarget.value)}
              step={1}
              type="number"
              value={exportMaximumLongEdgeInput}
            />
          </Field>
        ) : null}

        <div aria-live="polite" className="export-estimate">
          <span>Estimated output</span>
          {estimatedOutputDimensions ? (
            <strong>
              {estimatedOutputDimensions.width.toLocaleString()} ×{' '}
              {estimatedOutputDimensions.height.toLocaleString()} pixels
            </strong>
          ) : (
            <strong>Import a source photograph first</strong>
          )}
        </div>

        {exportSizeMode === 'maximum' && !maximumLongEdgeIsValid ? (
          <p className="export-controls__error" role="alert">
            Enter a maximum long edge of at least 1 pixel to export.
          </p>
        ) : null}

        {exportDimensionIssue ? (
          <p className="export-controls__error" role="alert">
            {exportDimensionIssue}
          </p>
        ) : null}

        {exportAllocationWarning ? (
          <p aria-live="polite" className="export-controls__warning" role="status">
            {exportAllocationWarning}
          </p>
        ) : null}

        {exportMaximumLongEdge !== null && estimatedOutputDimensions ? (
          <p className="field__hint">
            {formatOption?.label ?? 'Export'} will be written as a fresh file; the source remains
            untouched.
          </p>
        ) : null}
        <div className="export-controls__actions">
          <Button
            disabled={
              !canExport || !maximumLongEdgeIsValid || Boolean(exportDimensionIssue) || isExporting
            }
            onClick={onDownload}
            variant="primary"
          >
            {isExporting
              ? `Preparing ${formatOption?.label ?? 'export'}…`
              : `Download ${formatOption?.label ?? 'export'}`}
          </Button>
        </div>
      </div>
    </Disclosure>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const [sourcePhotograph, setSourcePhotograph] = useState<ImportedSourcePhotograph | null>(null);
  const [editHistory, dispatchEditHistory] = useReducer(editHistoryReducer, createEditHistory());
  const [rendererStatus, setRendererStatus] = useState<RendererStatus>('unsupported');
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [customLooks, setCustomLooks] = useState<StoredLook[]>([]);
  const browserStorageAvailable = hasBrowserStorage();
  const [storageStatus, setStorageStatus] = useState<StorageStatus>(
    browserStorageAvailable ? 'checking' : 'unavailable',
  );
  const [storageReady, setStorageReady] = useState(!browserStorageAvailable);
  const [storageFeedback, setStorageFeedback] = useState<string | null>(
    browserStorageAvailable ? null : describeStorageError('unavailable'),
  );
  const [recoveryFeedback, setRecoveryFeedback] = useState<string | null>(null);
  const [recoveryNeedsSource, setRecoveryNeedsSource] = useState(false);
  const [lookDialog, setLookDialog] = useState<LookDialogState | null>(null);
  const [lookDialogError, setLookDialogError] = useState<string | null>(null);
  const [lookActionPending, setLookActionPending] = useState(false);
  const [presetPreview, setPresetPreview] = useState<Preset | null>(null);
  const [isPresetImporting, setIsPresetImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    kind: 'error' | 'success';
    message: string;
  } | null>(null);
  const [exportFeedback, setExportFeedback] = useState<{
    kind: 'error' | 'success';
    message: string;
  } | null>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(defaultExportOptions.format);
  const [exportQuality, setExportQuality] = useState(defaultExportOptions.quality);
  const [exportSizeMode, setExportSizeMode] = useState<ExportSizeMode>('source');
  const [exportMaximumLongEdgeInput, setExportMaximumLongEdgeInput] = useState('4096');
  const [isImporting, setIsImporting] = useState(false);
  const [isPreviewReady, setIsPreviewReady] = useState(false);
  const [showBefore, setShowBefore] = useState(false);
  const [histogram, setHistogram] = useState<LuminanceHistogram | null>(null);
  const [histogramPending, setHistogramPending] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presetFileInputRef = useRef<HTMLInputElement>(null);
  const importRequestRef = useRef(0);
  const importInFlightRef = useRef(false);
  const presetImportRequestRef = useRef(0);
  const presetImportInFlightRef = useRef(false);
  const storageRef = useRef<BrowserStorage | null>(null);
  const pendingEditRef = useRef<{ edit: StoredEdit; storage: BrowserStorage } | null>(null);
  const storageWriteInFlightRef = useRef(false);
  const persistedSourceRef = useRef<File | null | undefined>(undefined);
  const exportInFlightRef = useRef(false);
  const activeTool = toolDetails[state.activeTool];
  const adjustments = editHistory.present.adjustments;
  const geometry = editHistory.present.geometry;
  const editHasChanges = hasNonNeutralEdit(editHistory.present);
  const exportMaximumLongEdge =
    exportSizeMode === 'maximum'
      ? normalizeMaximumLongEdge(exportMaximumLongEdgeInput)
      : defaultExportOptions.maximumLongEdge;
  const maximumLongEdgeIsValid = exportSizeMode === 'source' || exportMaximumLongEdge !== null;
  const estimatedOutputDimensions = sourcePhotograph
    ? getExportDimensions(sourcePhotograph, geometry, exportMaximumLongEdge)
    : null;
  const exportDimensionIssue = estimatedOutputDimensions
    ? getExportDimensionIssue(estimatedOutputDimensions)
    : null;
  const exportDimensionIssueMessage = exportDimensionIssue
    ? describeExportDimensionIssue(exportDimensionIssue)
    : null;
  const exportAllocationWarning =
    estimatedOutputDimensions && isLikelyOversizedExport(estimatedOutputDimensions)
      ? describeExportAllocationWarning(estimatedOutputDimensions)
      : null;

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      setRendererStatus('unsupported');
      return;
    }

    const renderer = createRenderer(canvas, {
      onError: (error) => setRendererError(error.message),
      onStatusChange: (status) => {
        setRendererStatus(status);
        if (status !== 'available') {
          setIsPreviewReady(false);
        }
        if (status === 'available') {
          setRendererError(null);
        }
      },
    });

    rendererRef.current = renderer;

    if (!renderer) {
      return () => {
        rendererRef.current = null;
      };
    }

    renderer.resize();
    renderer.setAdjustments(neutralRendererAdjustments);
    renderer.setGeometry(initialEditorState.geometry);
    renderer.setGrainSeed(DEFAULT_GRAIN_SEED);

    const resize = () => renderer.resize();
    window.addEventListener('resize', resize);

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    resizeObserver?.observe(canvas);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!hasBrowserStorage()) {
      return () => {
        cancelled = true;
      };
    }

    const storage = createBrowserStorage();

    if (!storage) {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setStorageStatus('unavailable');
          setStorageFeedback(describeStorageError('unavailable'));
          setStorageReady(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    storageRef.current = storage;
    const availableStorage = storage;

    async function recover() {
      try {
        const [savedLooks, savedEdit] = await Promise.all([
          availableStorage.listCustomLooks(),
          availableStorage.loadLatestEdit(),
        ]);

        if (cancelled) {
          return;
        }

        setCustomLooks(savedLooks);

        if (savedEdit) {
          dispatch({
            type: 'restore',
            state: {
              activeTool: 'adjustments',
              geometry: savedEdit.history.present.geometry,
              grainSeed: savedEdit.grainSeed,
              sourceFileName: savedEdit.sourceFileName,
            },
          });
          dispatchEditHistory({ type: 'restore', history: savedEdit.history });

          if (savedEdit.source) {
            const file = new File([savedEdit.source.blob], savedEdit.source.fileName, {
              type: savedEdit.source.mimeType,
            });

            try {
              const imported = await importSourcePhotograph(file);

              if (!cancelled) {
                setSourcePhotograph(imported);
                setRecoveryFeedback(
                  `Recovered ${imported.fileName} and the latest Edit from this browser.`,
                );
              } else {
                releaseSourcePhotographObjectUrl(imported.objectUrl);
              }
            } catch {
              if (!cancelled) {
                setRecoveryNeedsSource(true);
                setRecoveryFeedback(
                  `Recovered settings for ${savedEdit.sourceFileName ?? savedEdit.source.fileName}. Choose the source photograph again to continue.`,
                );
              }
            }
          } else if (savedEdit.sourceFileName) {
            setRecoveryNeedsSource(true);
            setRecoveryFeedback(
              `Recovered settings for ${savedEdit.sourceFileName}. Choose that source photograph again to continue.`,
            );
          }
        }

        setStorageStatus('available');
      } catch {
        if (!cancelled) {
          storageRef.current = null;
          setStorageStatus('failed');
          setStorageFeedback(describeStorageError('failed'));
        }
      } finally {
        if (!cancelled) {
          setStorageReady(true);
        }
      }
    }

    void recover();

    return () => {
      cancelled = true;
      storageRef.current = null;
    };
  }, []);

  useEffect(() => {
    const storage = storageRef.current;

    if (!storageReady || !storage) {
      return;
    }

    const sourceFile = sourcePhotograph?.file ?? null;
    const persistSource = persistedSourceRef.current !== sourceFile;

    pendingEditRef.current = {
      edit: createStoredEdit(state, editHistory, sourcePhotograph, persistSource),
      storage,
    };

    if (persistSource) {
      persistedSourceRef.current = sourceFile;
    }

    if (storageWriteInFlightRef.current) {
      return;
    }

    storageWriteInFlightRef.current = true;
    void (async () => {
      try {
        while (pendingEditRef.current) {
          const pendingEdit = pendingEditRef.current;
          pendingEditRef.current = null;

          if (storageRef.current === pendingEdit.storage) {
            await pendingEdit.storage.saveLatestEdit(pendingEdit.edit);
          }
        }
      } catch {
        pendingEditRef.current = null;

        if (storageRef.current === storage) {
          handleStorageFailure();
        }
      } finally {
        storageWriteInFlightRef.current = false;
      }
    })();
  }, [editHistory, sourcePhotograph, state, storageReady]);

  useEffect(() => {
    rendererRef.current?.setAdjustments(showBefore ? neutralRendererAdjustments : adjustments);
  }, [adjustments, showBefore]);

  useEffect(() => {
    rendererRef.current?.setGeometry(showBefore ? neutralGeometry : geometry);
  }, [geometry, showBefore]);

  useEffect(() => {
    rendererRef.current?.setGrainSeed(state.grainSeed ?? DEFAULT_GRAIN_SEED);
  }, [state.grainSeed]);

  useEffect(() => {
    const renderer = rendererRef.current;

    if (!renderer || !sourcePhotograph) {
      setIsPreviewReady(false);
      return;
    }

    let cancelled = false;
    setIsPreviewReady(false);
    setRendererError(null);

    void renderer
      .replaceImage({
        height: sourcePhotograph.height,
        objectUrl: sourcePhotograph.objectUrl,
        width: sourcePhotograph.width,
      })
      .then(() => {
        if (!cancelled) {
          setIsPreviewReady(true);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRendererError(
            error instanceof RendererError
              ? error.message
              : 'OpenFilm could not prepare the source photograph for WebGL2.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sourcePhotograph]);

  useEffect(() => {
    const renderer = rendererRef.current;

    if (!renderer || !sourcePhotograph || !isPreviewReady || rendererStatus !== 'available') {
      setHistogram(null);
      setHistogramPending(false);
      return;
    }

    let cancelled = false;
    let frame: number | null = null;
    let timeout: number | null = null;
    setHistogramPending(true);

    const readHistogram = () => {
      if (cancelled) {
        return;
      }

      setHistogram(renderer.getHistogram());
      setHistogramPending(false);
    };

    if (typeof window.requestAnimationFrame === 'function') {
      frame = window.requestAnimationFrame(readHistogram);
    } else {
      timeout = window.setTimeout(readHistogram, 0);
    }

    return () => {
      cancelled = true;
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      if (timeout !== null) {
        window.clearTimeout(timeout);
      }
    };
  }, [adjustments, geometry, isPreviewReady, rendererStatus, showBefore, sourcePhotograph]);

  useEffect(() => {
    function handleKeyboardShortcut(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented || isTextEntryTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && !event.altKey && key === 'z') {
        event.preventDefault();
        dispatchEditHistory({ type: event.shiftKey ? 'redo' : 'undo' });
        return;
      }

      if (modifier && !event.altKey && key === 'y') {
        event.preventDefault();
        dispatchEditHistory({ type: 'redo' });
        return;
      }

      if (!modifier && !event.altKey && key === 'b' && sourcePhotograph) {
        event.preventDefault();
        setShowBefore((current) => !current);
      }
    }

    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [sourcePhotograph]);

  useEffect(() => {
    const objectUrl = sourcePhotograph?.objectUrl;

    return () => {
      if (objectUrl) {
        releaseSourcePhotographObjectUrl(objectUrl);
      }
    };
  }, [sourcePhotograph?.objectUrl]);

  useEffect(() => {
    return () => {
      importRequestRef.current += 1;
      presetImportRequestRef.current += 1;
    };
  }, []);

  function openFilePicker() {
    if (isImporting || importInFlightRef.current) {
      return;
    }

    fileInputRef.current?.click();
  }

  function openPresetFilePicker() {
    if (isPresetImporting || presetImportInFlightRef.current) {
      return;
    }

    presetFileInputRef.current?.click();
  }

  async function importSelectedSource(file: File | undefined) {
    if (!file || importInFlightRef.current) {
      return;
    }

    importInFlightRef.current = true;
    const requestId = importRequestRef.current + 1;
    importRequestRef.current = requestId;
    setImportFeedback(null);
    setIsImporting(true);

    try {
      const imported = await importSourcePhotograph(file);

      if (requestId !== importRequestRef.current) {
        releaseSourcePhotographObjectUrl(imported.objectUrl);
        return;
      }

      const attachingRecoveredSource = recoveryNeedsSource && !sourcePhotograph;
      const replacementConfirmed =
        attachingRecoveredSource ||
        !sourcePhotograph ||
        !editHasChanges ||
        typeof window === 'undefined' ||
        window.confirm('Replace the current source photograph? The current Edit will be reset.');

      if (!replacementConfirmed) {
        releaseSourcePhotographObjectUrl(imported.objectUrl);
        setImportFeedback({
          kind: 'success',
          message: 'The current source photograph is still open.',
        });
        return;
      }

      setSourcePhotograph(imported);
      setShowBefore(false);
      setExportFeedback(null);
      if (attachingRecoveredSource) {
        setRecoveryNeedsSource(false);
        setRecoveryFeedback(null);
        dispatch({
          type: 'attach-source',
          fileName: imported.fileName,
          grainSeed: state.grainSeed ?? createGrainSeed(),
        });
      } else {
        dispatchEditHistory({ type: 'replace-source' });
        dispatch({
          type: 'source-selected',
          fileName: imported.fileName,
          grainSeed: createGrainSeed(),
        });
      }
      setImportFeedback({
        kind: 'success',
        message: `Loaded ${imported.fileName}. ${imported.width.toLocaleString()} × ${imported.height.toLocaleString()} pixels.`,
      });
    } catch (error) {
      if (requestId === importRequestRef.current) {
        setImportFeedback({
          kind: 'error',
          message: describeSourcePhotographImportError(error, file.name),
        });
      }
    } finally {
      if (requestId === importRequestRef.current) {
        setIsImporting(false);
      }
      importInFlightRef.current = false;
    }
  }

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    void importSelectedSource(file);
  }

  function handlePresetFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    void importSelectedPreset(file);
  }

  function handleSourceDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDropActive(false);

    if (importInFlightRef.current) {
      return;
    }

    void importSelectedSource(event.dataTransfer.files?.[0]);
  }

  async function importSelectedPreset(file: File | undefined) {
    if (!file || presetImportInFlightRef.current) {
      return;
    }

    presetImportInFlightRef.current = true;
    const requestId = presetImportRequestRef.current + 1;
    presetImportRequestRef.current = requestId;
    setImportFeedback(null);
    setIsPresetImporting(true);

    try {
      const preset = await readPresetFile(file);

      if (requestId === presetImportRequestRef.current) {
        setPresetPreview(preset);
      }
    } catch (error) {
      if (requestId === presetImportRequestRef.current) {
        setImportFeedback({
          kind: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'OpenFilm could not read this preset. Choose a valid JSON file.',
        });
      }
    } finally {
      if (requestId === presetImportRequestRef.current) {
        setIsPresetImporting(false);
      }
      presetImportInFlightRef.current = false;
    }
  }

  function handleAdjustmentChange(key: AdjustmentKey, value: number, gestureId: string) {
    dispatchEditHistory({ type: 'set-adjustment', key, value, gestureId });
  }

  function beginAdjustmentGesture(key: AdjustmentKey) {
    dispatchEditHistory({ type: 'begin-gesture', id: adjustmentGestureId(key) });
  }

  function endAdjustmentGesture(key: AdjustmentKey) {
    dispatchEditHistory({ type: 'end-gesture', id: adjustmentGestureId(key) });
  }

  function resetAdjustments() {
    dispatchEditHistory({ type: 'reset-adjustments' });
  }

  function resetAdjustment(key: AdjustmentKey) {
    dispatchEditHistory({ type: 'reset-one', key });
  }

  function resetAdjustmentGroup(group: AdjustmentGroup) {
    dispatchEditHistory({ type: 'reset-group', group });
  }

  function handleToneCurveChange(points: ToneCurvePoint[], gestureId: string) {
    dispatchEditHistory({ type: 'set-tone-curve', points, gestureId });
  }

  function beginToneCurveGesture() {
    dispatchEditHistory({ type: 'begin-gesture', id: TONE_CURVE_GESTURE_ID });
  }

  function endToneCurveGesture() {
    dispatchEditHistory({ type: 'end-gesture', id: TONE_CURVE_GESTURE_ID });
  }

  function resetToneCurve() {
    dispatchEditHistory({ type: 'reset-tone-curve' });
  }

  function undoEdit() {
    dispatchEditHistory({ type: 'undo' });
  }

  function redoEdit() {
    dispatchEditHistory({ type: 'redo' });
  }

  function applyGeometryAction(action: EditHistoryAction) {
    dispatchEditHistory(action);
  }

  function handleCropChange(crop: NormalizedCrop) {
    applyGeometryAction({ type: 'set-crop', crop });
  }

  function handleRotationChange(rotation: GeometryValues['rotation']) {
    applyGeometryAction({ type: 'set-rotation', rotation });
  }

  function toggleFlipHorizontal() {
    applyGeometryAction({ type: 'toggle-flip-horizontal' });
  }

  function toggleFlipVertical() {
    applyGeometryAction({ type: 'toggle-flip-vertical' });
  }

  function resetGeometry() {
    applyGeometryAction({ type: 'reset-geometry' });
  }

  function importBundledSample() {
    void importSelectedSource(createBundledSamplePhotographFile());
  }

  function applyLook(look: LookSource) {
    dispatchEditHistory({ type: 'apply-look', adjustments: look.adjustments });
    setShowBefore(false);
    setImportFeedback({ kind: 'success', message: `Applied ${look.title}.` });
  }

  function exportLook(look: LookSource) {
    try {
      const preset = createPreset({
        adjustments: look.adjustments,
        description: look.description,
        title: look.title,
      });
      const downloadFileName = getPresetFileName(preset.title);
      const blob = new Blob([serializePreset(preset)], { type: 'application/json' });

      downloadBlob(blob, downloadFileName);

      setImportFeedback({
        kind: 'success',
        message: `Exported ${preset.title} as ${downloadFileName}.`,
      });
    } catch (error) {
      setImportFeedback({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'OpenFilm could not create the preset download.',
      });
    }
  }

  function exportCurrentLook() {
    exportLook({
      adjustments,
      description: 'A reusable Look exported from the current Edit.',
      title: 'Current Look',
    });
  }

  function openSaveLookDialog() {
    setLookDialogError(null);
    setLookDialog({
      description: '',
      lookId: null,
      mode: 'save',
      title: 'My Look',
    });
  }

  function openRenameLookDialog(look: StoredLook) {
    setLookDialogError(null);
    setLookDialog({
      description: look.description,
      lookId: look.id,
      mode: 'rename',
      title: look.title,
    });
  }

  function handleStorageFailure() {
    storageRef.current = null;
    pendingEditRef.current = null;
    setStorageStatus('failed');
    setStorageFeedback(describeStorageError('failed'));
  }

  function continueWithoutStorage() {
    setStorageFeedback(null);
  }

  function retryStorage() {
    const storage = createBrowserStorage();

    if (!storage) {
      setStorageStatus('unavailable');
      setStorageFeedback(describeStorageError('unavailable'));
      return;
    }

    storageRef.current = storage;
    setStorageStatus('checking');
    setStorageFeedback(null);

    const currentEdit = createStoredEdit(state, editHistory, sourcePhotograph, true);

    void (async () => {
      try {
        await storage.saveLatestEdit(currentEdit);
        await Promise.all(customLooks.map((look) => storage.saveCustomLook(look)));

        if (storageRef.current === storage) {
          persistedSourceRef.current = sourcePhotograph?.file ?? null;
          setStorageStatus('available');
        }
      } catch {
        if (storageRef.current === storage) {
          handleStorageFailure();
        }
      }
    })();
  }

  function rememberCustomLook(look: StoredLook) {
    setCustomLooks((current) =>
      [...current.filter((item) => item.id !== look.id), look].sort(
        (first, second) => second.updatedAt - first.updatedAt,
      ),
    );

    const storage = storageRef.current;

    if (storage) {
      void storage.saveCustomLook(look).catch(() => {
        if (storageRef.current === storage) {
          handleStorageFailure();
        }
      });
    }
  }

  function duplicateLook(look: LookSource) {
    const now = Date.now();
    const duplicate: StoredLook = {
      adjustments: look.adjustments,
      createdAt: now,
      description: look.description ?? '',
      id: createLookId(),
      title: getDuplicateLookTitle(look.title, customLooks),
      updatedAt: now,
    };

    rememberCustomLook(duplicate);
    setImportFeedback({ kind: 'success', message: `Saved ${duplicate.title}.` });
  }

  function savePresetAsCustomLook() {
    if (!presetPreview) {
      return;
    }

    duplicateLook(presetPreview);
    setPresetPreview(null);
  }

  function applyPreset() {
    if (!presetPreview) {
      return;
    }

    applyLook(presetPreview);
    setPresetPreview(null);
  }

  function deleteLook(look: StoredLook) {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Delete "${look.title}"? This saved Look cannot be recovered.`)
    ) {
      return;
    }

    setCustomLooks((current) => current.filter((item) => item.id !== look.id));
    const storage = storageRef.current;

    if (storage) {
      void storage.deleteCustomLook(look.id).catch(() => {
        if (storageRef.current === storage) {
          handleStorageFailure();
        }
      });
    }
    setImportFeedback({ kind: 'success', message: `Deleted ${look.title}.` });
  }

  async function submitLookDialog() {
    if (!lookDialog || lookActionPending) {
      return;
    }

    const title = normalizeLookTitle(lookDialog.title);

    if (!title) {
      setLookDialogError('Enter a name for this Look.');
      return;
    }

    if (lookDialog.mode === 'rename' && lookDialog.lookId) {
      const existing = customLooks.find((look) => look.id === lookDialog.lookId);

      if (!existing) {
        setLookDialog(null);
        return;
      }

      const renamed: StoredLook = {
        ...existing,
        title,
        updatedAt: Date.now(),
      };

      rememberCustomLook(renamed);
      setLookDialog(null);
      setImportFeedback({ kind: 'success', message: `Renamed Look to ${title}.` });
      return;
    }

    const now = Date.now();
    const saved: StoredLook = {
      adjustments: editHistory.present.adjustments,
      createdAt: now,
      description: normalizeLookDescription(lookDialog.description),
      id: createLookId(),
      title,
      updatedAt: now,
    };

    setLookActionPending(true);
    rememberCustomLook(saved);
    setLookActionPending(false);
    setLookDialog(null);
    setImportFeedback({ kind: 'success', message: `Saved ${saved.title}.` });
  }

  async function handleDownload() {
    const renderer = rendererRef.current;
    const source = sourcePhotograph;
    const selectedFormat = exportFormat;
    const formatLabel =
      exportFormatOptions.find((option) => option.value === selectedFormat)?.label ?? 'image';
    const outputDimensions = estimatedOutputDimensions;

    if (
      !source ||
      !renderer ||
      rendererStatus !== 'available' ||
      !isPreviewReady ||
      !maximumLongEdgeIsValid ||
      exportDimensionIssue ||
      !outputDimensions ||
      isExporting ||
      exportInFlightRef.current
    ) {
      return;
    }

    exportInFlightRef.current = true;
    setExportFeedback(null);
    setIsExporting(true);
    const restoreBeforeState = showBefore;

    try {
      if (restoreBeforeState) {
        renderer.setAdjustments(adjustments);
        renderer.setGeometry(geometry);
      }

      const blob = await renderer.exportImage({
        format: selectedFormat,
        maximumLongEdge: exportMaximumLongEdge,
        quality: exportQuality,
      });
      const downloadFileName = getExportFileName(source.fileName, selectedFormat);

      downloadBlob(blob, downloadFileName);

      setExportFeedback({
        kind: 'success',
        message: `Downloaded ${downloadFileName} at ${outputDimensions.width.toLocaleString()} × ${outputDimensions.height.toLocaleString()} pixels.`,
      });
    } catch (error) {
      setExportFeedback({
        kind: 'error',
        message:
          error instanceof RendererError
            ? error.message
            : `OpenFilm could not create the ${formatLabel} download.`,
      });
    } finally {
      try {
        if (restoreBeforeState) {
          renderer.setAdjustments(neutralRendererAdjustments);
          renderer.setGeometry(neutralGeometry);
        }
      } finally {
        setIsExporting(false);
        exportInFlightRef.current = false;
      }
    }
  }

  const rendererMessage = rendererError ?? describeRendererStatus(rendererStatus);
  const hasSource = Boolean(sourcePhotograph);
  const sourcePreviewUnavailable =
    hasSource && (rendererStatus !== 'available' || Boolean(rendererError));
  const sourceRecoveryLabel =
    rendererStatus === 'available' && rendererError ? 'Choose another source' : 'Reload page';
  const sourceRecoveryAction =
    rendererStatus === 'available' && rendererError
      ? openFilePicker
      : () => window.location.reload();
  const storageStatusLabel =
    storageStatus === 'available'
      ? 'Browser recovery available'
      : storageStatus === 'checking'
        ? 'Checking browser recovery'
        : 'Browser recovery unavailable';

  return (
    <div className="app-shell">
      <header className="topbar">
        <a aria-label="OpenFilm home" className="brand" href="/">
          <span aria-hidden="true" className="brand__mark">
            OF
          </span>
          <span className="brand__name">OpenFilm</span>
        </a>
        <div className="topbar__actions">
          <RendererStatusLabel status={rendererStatus} />
          <IconButton label="Open editor help" onClick={() => setHelpOpen(true)} size="small">
            <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 18 18" width="18">
              <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M7.4 6.8a1.75 1.75 0 1 1 2.75 1.43c-.7.46-1.15.8-1.15 1.67"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.4"
              />
              <circle cx="9" cy="12.65" fill="currentColor" r=".75" />
            </svg>
          </IconButton>
        </div>
      </header>

      <main className="workspace">
        <section aria-labelledby="preview-title" className="canvas-column">
          <div className="canvas-column__header">
            <h1 id="preview-title">Your photograph, in focus.</h1>
          </div>

          <div
            aria-busy={isImporting}
            aria-label="Source photograph import area"
            className={`canvas-stage ${sourcePhotograph && !sourcePreviewUnavailable ? 'canvas-stage--ready' : ''} ${isDropActive ? 'canvas-stage--drop-active' : ''}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDropActive(true);
            }}
            onDragLeave={() => setIsDropActive(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleSourceDrop}
            role="group"
          >
            <canvas
              aria-label="Image preview canvas"
              className={`render-canvas ${sourcePhotograph && isPreviewReady && !rendererMessage ? 'render-canvas--visible' : ''}`}
              ref={canvasRef}
            />
            <div className="canvas-stage__content">
              {isImporting ? (
                <CanvasStateMessage kind="loading" title="Opening your photograph…">
                  Reading it in this tab. You can keep using the other controls.
                </CanvasStateMessage>
              ) : sourcePhotograph && sourcePreviewUnavailable ? (
                <div className="canvas-stage__source-error">
                  <h2>{sourcePhotograph.fileName}</h2>
                  <CanvasStateMessage
                    actionLabel={sourceRecoveryLabel}
                    kind={rendererError ? 'error' : 'warning'}
                    onAction={sourceRecoveryAction}
                    title={
                      rendererStatus === 'context-lost'
                        ? 'Preview stopped.'
                        : 'Preview unavailable.'
                    }
                  >
                    {rendererMessage ?? 'OpenFilm could not prepare this preview.'}
                  </CanvasStateMessage>
                </div>
              ) : sourcePhotograph ? (
                <>
                  <h2>{sourcePhotograph.fileName}</h2>
                  <p>
                    {sourcePhotograph.width.toLocaleString()} ×{' '}
                    {sourcePhotograph.height.toLocaleString()} pixels. Ready to edit.
                  </p>
                </>
              ) : recoveryNeedsSource ? (
                <CanvasStateMessage
                  actionLabel="Choose source photograph"
                  onAction={openFilePicker}
                  title="Choose the source photograph again."
                >
                  {recoveryFeedback ?? 'Your latest Edit is ready when you choose that file again.'}
                </CanvasStateMessage>
              ) : importFeedback?.kind === 'error' ? (
                <CanvasStateMessage
                  actionLabel="Try another file"
                  kind="error"
                  onAction={openFilePicker}
                  title="That file could not be opened."
                >
                  {importFeedback.message}
                </CanvasStateMessage>
              ) : (
                <CanvasStateMessage
                  actions={
                    <div className="canvas-stage__actions">
                      <Button disabled={isImporting} onClick={openFilePicker} variant="primary">
                        Import photograph
                      </Button>
                      <Button
                        disabled={isImporting}
                        onClick={importBundledSample}
                        size="small"
                        variant="quiet"
                      >
                        Try bundled sample
                      </Button>
                    </div>
                  }
                  title="Start with a photograph."
                >
                  Edit a JPEG, PNG, or WebP in your browser.
                </CanvasStateMessage>
              )}
            </div>
          </div>

          <div
            aria-label="Before and after comparison"
            className="canvas-column__toolbar"
            role="group"
          >
            <Button
              aria-keyshortcuts="B"
              aria-pressed={showBefore}
              disabled={!sourcePhotograph || !isPreviewReady}
              onClick={() => setShowBefore((current) => !current)}
              size="small"
              variant={showBefore ? 'primary' : 'outline'}
            >
              {showBefore ? 'Show edited result' : 'Show before'}
            </Button>
            <span>{showBefore ? 'Neutral image' : 'Current Edit'}</span>
          </div>

          <div className="canvas-column__footer">
            <RendererStatusLabel status={rendererStatus} />
            <span className="storage-status">{storageStatusLabel}</span>
          </div>
          <HistogramPanel histogram={histogram} pending={histogramPending} />
          {importFeedback?.kind === 'success' ? (
            <p
              aria-live="polite"
              className="import-feedback import-feedback--success"
              role="status"
            >
              {importFeedback.message}
            </p>
          ) : null}
          {importFeedback?.kind === 'error' && hasSource ? (
            <FeedbackNotice
              actionLabel="Choose another source"
              kind="error"
              message={importFeedback.message}
              onAction={openFilePicker}
            />
          ) : null}
          {rendererMessage && !sourcePreviewUnavailable ? (
            <FeedbackNotice
              actionLabel="Reload page"
              kind="warning"
              message={rendererMessage}
              onAction={() => window.location.reload()}
            />
          ) : null}
          {recoveryFeedback && hasSource ? (
            <p aria-live="polite" className="storage-feedback" role="status">
              {recoveryFeedback}
            </p>
          ) : null}
          {storageFeedback ? (
            <FeedbackNotice
              actionLabel={storageStatus === 'failed' ? 'Try again' : 'Continue without recovery'}
              kind="warning"
              message={storageFeedback}
              onAction={storageStatus === 'failed' ? retryStorage : continueWithoutStorage}
            />
          ) : null}
          <p className="storage-note">{storageNotice}</p>
          {exportFeedback?.kind === 'success' ? (
            <p
              aria-live="polite"
              className="export-feedback export-feedback--success"
              role="status"
            >
              {exportFeedback.message}
            </p>
          ) : null}
          {exportFeedback?.kind === 'error' ? (
            <FeedbackNotice
              actionLabel="Try export again"
              disabled={isExporting}
              kind="error"
              message={exportFeedback.message}
              onAction={() => void handleDownload()}
            />
          ) : null}
          <input
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            aria-label="Choose source photograph"
            className="visually-hidden"
            onChange={handleFileSelected}
            ref={fileInputRef}
            type="file"
          />
          <input
            accept="application/json,.json"
            aria-label="Choose Look preset"
            className="visually-hidden"
            onChange={handlePresetFileSelected}
            ref={presetFileInputRef}
            type="file"
          />
        </section>

        <aside aria-labelledby="controls-title" className="control-area">
          <div className="control-area__header">
            <h2 id="controls-title">Make it yours.</h2>
            <p>One control area keeps the image in charge of the experience.</p>
          </div>

          <div aria-label="Editor tools" className="tool-tabs" role="tablist">
            {editorTools.map((tool) => (
              <button
                aria-controls="active-tool"
                aria-selected={state.activeTool === tool}
                className={`tool-tab ${state.activeTool === tool ? 'tool-tab--active' : ''}`}
                id={`tool-tab-${tool}`}
                key={tool}
                onClick={() => dispatch({ type: 'select-tool', tool })}
                role="tab"
                type="button"
              >
                {toolLabels[tool]}
              </button>
            ))}
          </div>

          <EditHistoryDisclosure
            canRedo={editHistory.future.length > 0}
            canUndo={editHistory.past.length > 0}
            hasSource={Boolean(sourcePhotograph)}
            onRedo={redoEdit}
            onUndo={undoEdit}
          />

          <Panel description={activeTool.description} id="active-tool" title={activeTool.title}>
            <ToolControls
              activeTool={state.activeTool}
              adjustments={adjustments}
              bundledLookOptions={bundledLooks}
              customLooks={customLooks}
              geometry={geometry}
              hasSource={Boolean(sourcePhotograph)}
              hasNonNeutralGeometryValue={hasNonNeutralGeometry(geometry)}
              isPresetImporting={isPresetImporting}
              showDisabledControls={editHasChanges}
              onAdjustmentChange={handleAdjustmentChange}
              onAdjustmentGestureEnd={endAdjustmentGesture}
              onAdjustmentGestureStart={beginAdjustmentGesture}
              onApplyLook={applyLook}
              onCropChange={handleCropChange}
              onDeleteLook={deleteLook}
              onDuplicateLook={duplicateLook}
              onExportCurrentLook={exportCurrentLook}
              onExportLook={exportLook}
              onGeometryReset={resetGeometry}
              onImportPreset={openPresetFilePicker}
              onOpenRenameDialog={openRenameLookDialog}
              onOpenSaveDialog={openSaveLookDialog}
              onResetAdjustment={resetAdjustment}
              onReset={resetAdjustments}
              onResetGroup={resetAdjustmentGroup}
              onResetToneCurve={resetToneCurve}
              onRotationChange={handleRotationChange}
              onToneCurveGestureEnd={endToneCurveGesture}
              onToneCurveGestureStart={beginToneCurveGesture}
              onToneCurveChange={handleToneCurveChange}
              onToggleFlipHorizontal={toggleFlipHorizontal}
              onToggleFlipVertical={toggleFlipVertical}
              sourceDimensions={sourcePhotograph}
            />
          </Panel>

          <ExportControls
            canExport={
              hasSource &&
              isPreviewReady &&
              rendererStatus === 'available' &&
              !rendererError &&
              !exportDimensionIssue
            }
            estimatedOutputDimensions={estimatedOutputDimensions}
            exportAllocationWarning={exportAllocationWarning}
            exportDimensionIssue={exportDimensionIssueMessage}
            exportFormat={exportFormat}
            exportMaximumLongEdge={exportMaximumLongEdge}
            exportMaximumLongEdgeInput={exportMaximumLongEdgeInput}
            exportQuality={exportQuality}
            exportSizeMode={exportSizeMode}
            hasSource={Boolean(sourcePhotograph)}
            isExporting={isExporting}
            maximumLongEdgeIsValid={maximumLongEdgeIsValid}
            onDownload={handleDownload}
            onExportFormatChange={setExportFormat}
            onExportMaximumLongEdgeChange={setExportMaximumLongEdgeInput}
            onExportQualityChange={setExportQuality}
            onExportSizeModeChange={setExportSizeMode}
          />

          <div className="control-area__footer">
            <p>{sourcePhotograph?.fileName ?? 'No source photograph yet'}</p>
            {sourcePhotograph ? (
              <div className="control-area__actions">
                <Button
                  disabled={isImporting}
                  onClick={openFilePicker}
                  size="small"
                  variant="outline"
                >
                  Choose another source
                </Button>
              </div>
            ) : null}
          </div>
        </aside>
      </main>

      {presetPreview ? (
        <Dialog
          actions={
            <>
              <Button onClick={() => setPresetPreview(null)} variant="quiet">
                Cancel
              </Button>
              <Button onClick={savePresetAsCustomLook} variant="outline">
                Save as custom Look
              </Button>
              <Button onClick={applyPreset} variant="primary">
                Apply preset
              </Button>
            </>
          }
          onClose={() => setPresetPreview(null)}
          open
          title="Review Look preset"
        >
          <p>Review this Look before choosing where it goes.</p>
          <dl className="preset-preview">
            <div>
              <dt>Name</dt>
              <dd>{presetPreview.title}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{presetPreview.description || 'No description provided.'}</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>OpenFilm preset {presetPreview.formatVersion}</dd>
            </div>
          </dl>
          <p className="field__hint">
            Applying this preset changes the current Look adjustments only. Geometry and source
            photograph data stay with the Edit.
          </p>
        </Dialog>
      ) : null}

      {lookDialog ? (
        <Dialog
          actions={
            <>
              <Button
                disabled={lookActionPending}
                onClick={() => setLookDialog(null)}
                variant="quiet"
              >
                Cancel
              </Button>
              <Button
                disabled={lookActionPending}
                onClick={() => void submitLookDialog()}
                variant="primary"
              >
                {lookDialog.mode === 'rename' ? 'Rename Look' : 'Save Look'}
              </Button>
            </>
          }
          onClose={() => setLookDialog(null)}
          open
          title={lookDialog.mode === 'rename' ? 'Rename Look' : 'Save current Look'}
        >
          <Field hint="Use a short name you will recognize later." id="look-title" label="Name">
            <input
              aria-describedby="look-title-hint"
              autoFocus
              id="look-title"
              maxLength={80}
              onChange={(event) => {
                const title = event.currentTarget.value;
                setLookDialog((current) => (current ? { ...current, title } : current));
              }}
              type="text"
              value={lookDialog.title}
            />
          </Field>
          {lookDialog.mode === 'save' ? (
            <Field
              hint="Optional. Keep it under 240 characters."
              id="look-description"
              label="Description"
            >
              <textarea
                aria-describedby="look-description-hint"
                id="look-description"
                maxLength={240}
                onChange={(event) => {
                  const description = event.currentTarget.value;
                  setLookDialog((current) => (current ? { ...current, description } : current));
                }}
                rows={3}
                value={lookDialog.description}
              />
            </Field>
          ) : null}
          {lookDialogError ? (
            <p aria-live="assertive" className="looks-dialog__error" role="alert">
              {lookDialogError}
            </p>
          ) : null}
        </Dialog>
      ) : null}

      <Dialog
        actions={
          <Button onClick={() => setHelpOpen(false)} variant="primary">
            Close
          </Button>
        }
        onClose={() => setHelpOpen(false)}
        open={helpOpen}
        title="A quiet place to edit"
      >
        <p>
          OpenFilm keeps source photographs and Looks in your browser. The interface is
          intentionally small: one preview, one active tool, and a portable Look model.
        </p>
      </Dialog>
    </div>
  );
}
