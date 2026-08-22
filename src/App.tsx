import { useEffect, useReducer, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';

import {
  editorReducer,
  editorTools,
  initialEditorState,
  type EditorTool,
} from './editor/editorState';
import {
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

function hasNonNeutralAdjustments(adjustments: RendererAdjustments): boolean {
  return adjustments.exposure !== 0 || adjustments.contrast !== 0;
}

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

function ToolControls({
  activeTool,
  adjustments,
  hasSource,
  onAdjustmentChange,
  onReset,
}: {
  activeTool: EditorTool;
  adjustments: RendererAdjustments;
  hasSource: boolean;
  onAdjustmentChange: (key: keyof RendererAdjustments, value: number) => void;
  onReset: () => void;
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
      <Slider
        disabled={!hasSource}
        displayValue={adjustments.exposure.toFixed(2)}
        hint="Import a photograph to activate the controls."
        id="exposure"
        label="Exposure"
        max={1}
        min={-1}
        onChange={(event) => onAdjustmentChange('exposure', Number(event.currentTarget.value))}
        step={0.01}
        value={adjustments.exposure}
      />
      <Slider
        disabled={!hasSource}
        displayValue={adjustments.contrast.toFixed(2)}
        id="contrast"
        label="Contrast"
        max={100}
        min={-100}
        onChange={(event) =>
          onAdjustmentChange('contrast', Number(event.currentTarget.value) / 100)
        }
        step={1}
        value={Math.round(adjustments.contrast * 100)}
      />
      <Field
        hint="More adjustment controls will join this focused set."
        id="color-profile"
        label="Color profile"
      >
        <select
          aria-describedby="color-profile-hint"
          defaultValue="neutral"
          disabled={!hasSource}
          id="color-profile"
        >
          <option value="neutral">Neutral</option>
        </select>
      </Field>
      <Button disabled={!hasSource} onClick={onReset} size="small" variant="outline">
        Reset adjustments
      </Button>
    </div>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const [sourcePhotograph, setSourcePhotograph] = useState<ImportedSourcePhotograph | null>(null);
  const [adjustments, setAdjustments] = useState<RendererAdjustments>({
    ...neutralRendererAdjustments,
  });
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
      setAdjustments({ ...neutralRendererAdjustments });
      setExportFeedback(null);
      dispatch({ type: 'source-selected', fileName: imported.fileName });
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

  function handleAdjustmentChange(key: keyof RendererAdjustments, value: number) {
    setAdjustments((current) => ({ ...current, [key]: value }));
  }

  function resetAdjustments() {
    setAdjustments({ ...neutralRendererAdjustments });
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
                  <Button disabled={isImporting} onClick={openFilePicker} variant="primary">
                    Import photograph
                  </Button>
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
              hasSource={Boolean(sourcePhotograph)}
              onAdjustmentChange={handleAdjustmentChange}
              onReset={resetAdjustments}
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
