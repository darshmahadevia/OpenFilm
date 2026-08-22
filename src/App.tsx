import { useEffect, useReducer, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import {
  editorReducer,
  editorTools,
  initialEditorState,
  type EditorTool,
} from './editor/editorState';
import { getRendererStatus, type RendererStatus } from './rendering/renderer';
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

function RendererStatusLabel({ status }: { status: RendererStatus }) {
  const isAvailable = status === 'available';

  return (
    <span className={`renderer-status renderer-status--${status}`}>
      <span aria-hidden="true" className="renderer-status__dot" />
      WebGL2 {isAvailable ? 'ready' : 'unavailable'}
    </span>
  );
}

function ToolControls({ activeTool, hasSource }: { activeTool: EditorTool; hasSource: boolean }) {
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
        displayValue="0.00"
        hint="Import a photograph to activate the controls."
        id="exposure"
        label="Exposure"
        max={1}
        min={-1}
        step={0.01}
        value={0}
      />
      <Slider
        disabled={!hasSource}
        displayValue="0"
        id="contrast"
        label="Contrast"
        max={100}
        min={-100}
        step={1}
        value={0}
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
    </div>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const [rendererStatus, setRendererStatus] = useState<RendererStatus>('unsupported');
  const [helpOpen, setHelpOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const storageAvailable = hasBrowserStorage();
  const activeTool = toolDetails[state.activeTool];

  useEffect(() => {
    setRendererStatus(getRendererStatus(canvasRef.current));
  }, []);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    dispatch({ type: 'source-selected', fileName: file.name });
    event.target.value = '';
  }

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

          <div className={`canvas-stage ${state.sourceFileName ? 'canvas-stage--ready' : ''}`}>
            <canvas aria-label="Image preview canvas" className="render-canvas" ref={canvasRef} />
            <div aria-hidden="true" className="stage-art">
              <div className="stage-art__frame">
                <div className="stage-art__sun" />
                <div className="stage-art__horizon" />
                <div className="stage-art__shadow" />
              </div>
            </div>
            <div className="canvas-stage__content">
              {state.sourceFileName ? (
                <>
                  <h2>{state.sourceFileName}</h2>
                  <p>
                    Source photograph selected. The preview canvas is ready for the active Look.
                  </p>
                </>
              ) : (
                <>
                  <h2>Bring a photograph into focus.</h2>
                  <p>Start with one JPEG, PNG, or WebP source photograph.</p>
                  <Button onClick={openFilePicker} variant="primary">
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
          <p className="storage-note">{storageNotice}</p>
          <input
            accept="image/jpeg,image/png,image/webp"
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
            <ToolControls activeTool={state.activeTool} hasSource={Boolean(state.sourceFileName)} />
          </Panel>

          <div className="control-area__footer">
            <p>{state.sourceFileName ?? 'No source photograph yet'}</p>
            <Button onClick={openFilePicker} size="small" variant="outline">
              {state.sourceFileName ? 'Choose another source' : 'Choose a source'}
            </Button>
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
