import { useEffect, useReducer, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent, PointerEvent } from 'react';

import {
  adjustmentDefinitions,
  adjustmentGroups,
  adjustmentReducer,
  coreAdjustmentKeys,
  createAdjustmentHistory,
  formatAdjustmentValue,
  hasNonNeutralAdjustments,
  type AdjustmentGroup,
  type AdjustmentKey,
} from './editor/adjustments';
import {
  editorReducer,
  editorTools,
  initialEditorState,
  type EditorTool,
} from './editor/editorState';
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
} from './rendering/renderer';
import { hasBrowserStorage, storageNotice } from './storage/browserStorage';
import {
  addToneCurvePoint,
  isNeutralToneCurve,
  moveToneCurvePoint,
  removeToneCurvePoint,
  TONE_CURVE_MAX_POINTS,
  TONE_CURVE_STEP,
  type ToneCurvePoint,
} from './editor/toneCurve';
import { Button, Dialog, Field, IconButton, Panel, Slider } from './ui/components';

const toolLabels: Record<EditorTool, string> = {
  adjustments: 'Adjust',
  geometry: 'Geometry',
  looks: 'Looks',
};

const toolDetails: Record<EditorTool, { description: string; title: string }> = {
  adjustments: {
    title: 'Adjustments',
    description: 'Tune the Look with a small set of familiar photographic controls.',
  },
  geometry: {
    title: 'Geometry',
    description: 'Crop, rotate, and flip the current Edit without changing its Look.',
  },
  looks: {
    title: 'Looks',
    description: 'Start from a bundled Look or return to a neutral starting point.',
  },
};

function getJpegDownloadFileName(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'openfilm';
  return `${baseName}-openfilm.jpg`;
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

function AdjustmentControl({
  adjustments,
  hasSource,
  onAdjustmentChange,
  onReset,
  adjustmentKey,
}: {
  adjustments: RendererAdjustments;
  adjustmentKey: AdjustmentKey;
  hasSource: boolean;
  onAdjustmentChange: (key: AdjustmentKey, value: number) => void;
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
        onChange={(event) => onAdjustmentChange(adjustmentKey, Number(event.currentTarget.value))}
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
  onReset,
  onResetGroup,
  title,
}: {
  adjustments: RendererAdjustments;
  description: string;
  group: AdjustmentGroup;
  hasSource: boolean;
  onAdjustmentChange: (key: AdjustmentKey, value: number) => void;
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
  onChange,
  onReset,
  points,
}: {
  hasSource: boolean;
  onChange: (points: ToneCurvePoint[]) => void;
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
      onChange(next);
    }
  }

  function handlePointPointerDown(index: number, event: PointerEvent<HTMLButtonElement>) {
    if (!hasSource) {
      return;
    }

    event.preventDefault();
    setSelectedIndex(index);
    draggingIndex.current = index;
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
      onChange(next);
    }
  }

  function handleCoordinateChange(axis: keyof ToneCurvePoint, value: string) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return;
    }

    const next = moveToneCurvePoint(points, safeSelectedIndex, { [axis]: numericValue });

    if (next) {
      onChange(next);
    }
  }

  function addPoint() {
    const next = addToneCurvePoint(points);

    if (!next) {
      return;
    }

    const insertedIndex = next.findIndex((point, index) => point.x !== points[index]?.x);
    setSelectedIndex(insertedIndex < 0 ? next.length - 2 : insertedIndex);
    onChange(next);
  }

  function removeSelectedPoint() {
    const next = removeToneCurvePoint(points, safeSelectedIndex);

    if (!next) {
      return;
    }

    setSelectedIndex(Math.max(0, safeSelectedIndex - 1));
    onChange(next);
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

function ToolControls({
  activeTool,
  adjustments,
  canRedo,
  canUndo,
  hasSource,
  onAdjustmentChange,
  onRedo,
  onResetAdjustment,
  onReset,
  onResetGroup,
  onResetToneCurve,
  onToneCurveChange,
  onUndo,
}: {
  activeTool: EditorTool;
  adjustments: RendererAdjustments;
  canRedo: boolean;
  canUndo: boolean;
  hasSource: boolean;
  onAdjustmentChange: (key: AdjustmentKey, value: number) => void;
  onRedo: () => void;
  onResetAdjustment: (key: AdjustmentKey) => void;
  onReset: () => void;
  onResetGroup: (group: AdjustmentGroup) => void;
  onResetToneCurve: () => void;
  onToneCurveChange: (points: ToneCurvePoint[]) => void;
  onUndo: () => void;
}) {
  if (activeTool === 'geometry') {
    return (
      <div className="control-stack">
        <Field
          hint="Geometry belongs to this Edit, not its reusable Look."
          id="rotation"
          label="Rotation"
        >
          <select
            aria-describedby="rotation-hint"
            defaultValue="0"
            disabled={!hasSource}
            id="rotation"
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
            <Button disabled={!hasSource} size="small" variant="outline">
              Horizontal
            </Button>
            <Button disabled={!hasSource} size="small" variant="outline">
              Vertical
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (activeTool === 'looks') {
    return (
      <div className="control-stack">
        <div className="look-row look-row--selected">
          <div>
            <strong>Neutral Look</strong>
            <span>No intentional visible change</span>
          </div>
          <span className="look-row__state">Active</span>
        </div>
        <div className="look-row look-row--muted">
          <div>
            <strong>Bundled Looks</strong>
            <span>Ready for the first film-inspired collection</span>
          </div>
          <span className="look-row__state">Soon</span>
        </div>
        <Button disabled={!hasSource} variant="outline">
          Import a Look file
        </Button>
      </div>
    );
  }

  return (
    <div className="control-stack">
      <div aria-label="Adjustment history" className="history-actions">
        <Button disabled={!hasSource || !canUndo} onClick={onUndo} size="small" variant="quiet">
          Undo
        </Button>
        <Button disabled={!hasSource || !canRedo} onClick={onRedo} size="small" variant="quiet">
          Redo
        </Button>
      </div>
      {coreAdjustmentKeys.map((adjustmentKey) => (
        <AdjustmentControl
          adjustmentKey={adjustmentKey}
          adjustments={adjustments}
          hasSource={hasSource}
          key={adjustmentKey}
          onAdjustmentChange={onAdjustmentChange}
          onReset={onResetAdjustment}
        />
      ))}
      <AdjustmentGroupControl
        adjustments={adjustments}
        description="Darken the frame edges with a controlled, image-relative falloff."
        group="vignette"
        hasSource={hasSource}
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
        onAdjustmentChange={onAdjustmentChange}
        onReset={onResetAdjustment}
        onResetGroup={onResetGroup}
        title="Grain"
      />
      <ToneCurveControl
        hasSource={hasSource}
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

export default function App() {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const [sourcePhotograph, setSourcePhotograph] = useState<ImportedSourcePhotograph | null>(null);
  const [adjustmentHistory, dispatchAdjustments] = useReducer(
    adjustmentReducer,
    createAdjustmentHistory(),
  );
  const [rendererStatus, setRendererStatus] = useState<RendererStatus>('unsupported');
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
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
  const [isImporting, setIsImporting] = useState(false);
  const [isPreviewReady, setIsPreviewReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importRequestRef = useRef(0);
  const storageAvailable = hasBrowserStorage();
  const activeTool = toolDetails[state.activeTool];
  const adjustments = adjustmentHistory.present;
  const editHasNonNeutralAdjustments = hasNonNeutralAdjustments(adjustments);

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
    rendererRef.current?.setAdjustments(adjustments);
  }, [adjustments]);

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
    const objectUrl = sourcePhotograph?.objectUrl;

    return () => {
      if (objectUrl) {
        releaseSourcePhotographObjectUrl(objectUrl);
      }
    };
  }, [sourcePhotograph?.objectUrl]);

  function openFilePicker() {
    if (isImporting) {
      return;
    }

    fileInputRef.current?.click();
  }

  async function importSelectedSource(file: File | undefined) {
    if (!file) {
      return;
    }

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

      const replacementConfirmed =
        !sourcePhotograph ||
        !editHasNonNeutralAdjustments ||
        typeof window === 'undefined' ||
        window.confirm(
          'Replace the current source photograph? The current adjustment state will be reset.',
        );

      if (!replacementConfirmed) {
        releaseSourcePhotographObjectUrl(imported.objectUrl);
        setImportFeedback({
          kind: 'success',
          message: 'The current source photograph is still open.',
        });
        return;
      }

      setSourcePhotograph(imported);
      dispatchAdjustments({ type: 'replace-source' });
      setExportFeedback(null);
      dispatch({
        type: 'source-selected',
        fileName: imported.fileName,
        grainSeed: createGrainSeed(),
      });
      setImportFeedback({
        kind: 'success',
        message: `Loaded ${imported.fileName} — ${imported.width.toLocaleString()} × ${imported.height.toLocaleString()} pixels.`,
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

  function handleSourceDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDropActive(false);
    void importSelectedSource(event.dataTransfer.files?.[0]);
  }

  function handleAdjustmentChange(key: AdjustmentKey, value: number) {
    dispatchAdjustments({ type: 'set', key, value });
  }

  function resetAdjustments() {
    dispatchAdjustments({ type: 'reset-all' });
  }

  function resetAdjustment(key: AdjustmentKey) {
    dispatchAdjustments({ type: 'reset-one', key });
  }

  function resetAdjustmentGroup(group: AdjustmentGroup) {
    dispatchAdjustments({ type: 'reset-group', group });
  }

  function handleToneCurveChange(points: ToneCurvePoint[]) {
    dispatchAdjustments({ type: 'set-tone-curve', points });
  }

  function resetToneCurve() {
    dispatchAdjustments({ type: 'reset-tone-curve' });
  }

  function undoAdjustment() {
    dispatchAdjustments({ type: 'undo' });
  }

  function redoAdjustment() {
    dispatchAdjustments({ type: 'redo' });
  }

  function importBundledSample() {
    void importSelectedSource(createBundledSamplePhotographFile());
  }

  async function handleDownloadJpeg() {
    const renderer = rendererRef.current;

    if (
      !sourcePhotograph ||
      !renderer ||
      rendererStatus !== 'available' ||
      !isPreviewReady ||
      isExporting
    ) {
      return;
    }

    setExportFeedback(null);
    setIsExporting(true);

    try {
      const blob = await renderer.exportJpeg();
      const objectUrl = URL.createObjectURL(blob);
      const downloadFileName = getJpegDownloadFileName(sourcePhotograph.fileName);
      const link = document.createElement('a');

      link.download = downloadFileName;
      link.href = objectUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);

      setExportFeedback({
        kind: 'success',
        message: `Downloaded ${downloadFileName}.`,
      });
    } catch (error) {
      setExportFeedback({
        kind: 'error',
        message:
          error instanceof RendererError
            ? error.message
            : 'OpenFilm could not create the JPEG download.',
      });
    } finally {
      setIsExporting(false);
    }
  }

  const rendererMessage = rendererError ?? describeRendererStatus(rendererStatus);

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
            className={`canvas-stage ${sourcePhotograph ? 'canvas-stage--ready' : ''} ${isDropActive ? 'canvas-stage--drop-active' : ''}`}
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
            <div aria-hidden="true" className="stage-art">
              <div className="stage-art__frame">
                <div className="stage-art__sun" />
                <div className="stage-art__horizon" />
                <div className="stage-art__shadow" />
              </div>
            </div>
            <div className="canvas-stage__content">
              {sourcePhotograph ? (
                <>
                  <h2>{sourcePhotograph.fileName}</h2>
                  <p>
                    {sourcePhotograph.width.toLocaleString()} ×{' '}
                    {sourcePhotograph.height.toLocaleString()} pixels. Ready for the active Look.
                  </p>
                </>
              ) : (
                <>
                  <h2>Bring a photograph into focus.</h2>
                  <p>Choose or drop one JPEG, PNG, or WebP source photograph.</p>
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
                </>
              )}
            </div>
          </div>

          <div className="canvas-column__footer">
            <RendererStatusLabel status={rendererStatus} />
            <span className="storage-status">
              {storageAvailable ? 'Browser recovery available' : 'Browser recovery unavailable'}
            </span>
          </div>
          {isImporting ? (
            <p
              aria-live="polite"
              className="import-feedback import-feedback--loading"
              role="status"
            >
              Reading source photograph locally…
            </p>
          ) : null}
          {importFeedback ? (
            <p
              aria-live={importFeedback.kind === 'error' ? 'assertive' : 'polite'}
              className={`import-feedback import-feedback--${importFeedback.kind}`}
              role={importFeedback.kind === 'error' ? 'alert' : 'status'}
            >
              {importFeedback.message}
            </p>
          ) : null}
          {rendererMessage ? (
            <p
              aria-live="polite"
              className="renderer-feedback"
              role={rendererError ? 'alert' : 'status'}
            >
              {rendererMessage}
            </p>
          ) : null}
          <p className="storage-note">{storageNotice}</p>
          {exportFeedback ? (
            <p
              aria-live={exportFeedback.kind === 'error' ? 'assertive' : 'polite'}
              className={`export-feedback export-feedback--${exportFeedback.kind}`}
              role={exportFeedback.kind === 'error' ? 'alert' : 'status'}
            >
              {exportFeedback.message}
            </p>
          ) : null}
          <input
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            aria-label="Choose source photograph"
            className="visually-hidden"
            onChange={handleFileSelected}
            ref={fileInputRef}
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
                aria-selected={state.activeTool === tool}
                className={`tool-tab ${state.activeTool === tool ? 'tool-tab--active' : ''}`}
                key={tool}
                onClick={() => dispatch({ type: 'select-tool', tool })}
                role="tab"
                type="button"
              >
                {toolLabels[tool]}
              </button>
            ))}
          </div>

          <Panel description={activeTool.description} id="active-tool" title={activeTool.title}>
            <ToolControls
              activeTool={state.activeTool}
              adjustments={adjustments}
              canRedo={adjustmentHistory.future.length > 0}
              canUndo={adjustmentHistory.past.length > 0}
              hasSource={Boolean(sourcePhotograph)}
              onAdjustmentChange={handleAdjustmentChange}
              onRedo={redoAdjustment}
              onResetAdjustment={resetAdjustment}
              onReset={resetAdjustments}
              onResetGroup={resetAdjustmentGroup}
              onResetToneCurve={resetToneCurve}
              onToneCurveChange={handleToneCurveChange}
              onUndo={undoAdjustment}
            />
          </Panel>

          <div className="control-area__footer">
            <p>{sourcePhotograph?.fileName ?? 'No source photograph yet'}</p>
            <div className="control-area__actions">
              <Button
                disabled={
                  !sourcePhotograph ||
                  rendererStatus !== 'available' ||
                  !isPreviewReady ||
                  isExporting
                }
                onClick={handleDownloadJpeg}
                size="small"
                variant={sourcePhotograph ? 'primary' : 'outline'}
              >
                {isExporting ? 'Preparing JPEG…' : 'Download JPEG'}
              </Button>
              <Button
                disabled={isImporting}
                onClick={openFilePicker}
                size="small"
                variant={sourcePhotograph ? 'outline' : 'primary'}
              >
                {sourcePhotograph ? 'Choose another source' : 'Choose a source'}
              </Button>
            </div>
          </div>
        </aside>
      </main>

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
