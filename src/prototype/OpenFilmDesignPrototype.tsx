/**
 * PROTOTYPE — What should OpenFilm's landing and editor experience look like?
 * A Contact Sheet: editorial, image-led, calm red annotation.
 * B Darkroom: low-light, immersive, controls appear around the photograph.
 * C Gallery Proof: warm paper, curatorial pacing, restrained typography.
 * D Precision Instrument: dense but legible, direct controls, no decorative chrome.
 * E Processing Strip: photographic lab workflow, visible stages, amber active state.
 */

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';

import prototypePhoto from './assets/openfilm-prototype-photo.png';
import './openfilm-design-prototype.css';

type Variant = 'A' | 'B' | 'C' | 'D' | 'E';
type View = 'landing' | 'editor';

const variants: Record<Variant, { name: string; note: string }> = {
  A: { name: 'Contact Sheet', note: 'Editorial and image-led' },
  B: { name: 'Darkroom', note: 'Immersive and low-light' },
  C: { name: 'Gallery Proof', note: 'Warm and curatorial' },
  D: { name: 'Precision Instrument', note: 'Direct and exact' },
  E: { name: 'Processing Strip', note: 'Workflow made visible' },
};

const variantKeys = Object.keys(variants) as Variant[];

function readVariant(): Variant {
  const value = new URLSearchParams(window.location.search).get('variant');
  return variantKeys.includes(value as Variant) ? (value as Variant) : 'A';
}

function readView(): View {
  return new URLSearchParams(window.location.search).get('view') === 'editor'
    ? 'editor'
    : 'landing';
}

function Icon({ name }: { name: 'arrow' | 'crop' | 'export' | 'image' | 'looks' | 'sliders' }) {
  const paths = {
    arrow: <path d="m6 9 6 6 6-6" />,
    crop: <path d="M7 3v12a2 2 0 0 0 2 2h12M3 7h12a2 2 0 0 1 2 2v12" />,
    export: <path d="M12 3v12m0-12 4 4m-4-4L8 7M5 13v6h14v-6" />,
    image: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="1" />
        <path d="m3 16 5-5 4 4 3-3 6 6" />
        <circle cx="16" cy="9" r="1.5" />
      </>
    ),
    looks: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 0 0 16V4Z" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}

function Brand({ circle = false }: { circle?: boolean }) {
  return (
    <span className="proto-brand">
      {circle ? <span aria-hidden="true" className="proto-brand-circle" /> : null}
      OpenFilm
    </span>
  );
}

function Photo({
  src,
  alt = 'Sample photograph in the OpenFilm editor',
}: {
  src: string;
  alt?: string;
}) {
  return <img className="proto-photo" src={src} alt={alt} />;
}

function UploadAction({
  onFile,
  onSample,
  children,
}: {
  onFile: (file: File) => void;
  onSample: () => void;
  children?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div className="proto-upload-actions">
      <input
        ref={inputRef}
        className="proto-visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
      />
      <button
        className="proto-primary-action"
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        {children ?? 'Choose a photograph'}
      </button>
      <button className="proto-text-action" type="button" onClick={onSample}>
        Try the sample
      </button>
    </div>
  );
}

function ToolRail({ compact = false }: { compact?: boolean }) {
  return (
    <nav
      className={compact ? 'proto-tool-rail is-compact' : 'proto-tool-rail'}
      aria-label="Editing tools"
    >
      <button className="is-active" type="button">
        <Icon name="sliders" />
        Adjust
      </button>
      <button type="button">
        <Icon name="crop" />
        Geometry
      </button>
      <button type="button">
        <Icon name="looks" />
        Looks
      </button>
    </nav>
  );
}

function Slider({
  label,
  value,
  min = -100,
  max = 100,
  suffix = '',
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const [current, setCurrent] = useState(value);
  return (
    <label className="proto-slider">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={current}
        onChange={(event) => setCurrent(Number(event.target.value))}
      />
      <output>
        {current > 0 ? '+' : ''}
        {current}
        {suffix}
      </output>
    </label>
  );
}

function EditorControls({ mode = 'stack' }: { mode?: 'stack' | 'desk' }) {
  return (
    <section className={`proto-controls proto-controls-${mode}`} aria-label="Adjustments">
      <header>
        <h2>Adjust</h2>
        <button type="button">Reset</button>
      </header>
      <Slider label="Exposure" value={3} min={-40} max={40} suffix="%" />
      <Slider label="Contrast" value={12} />
      <Slider label="Warmth" value={-8} />
      <Slider label="Fade" value={18} min={0} max={100} />
    </section>
  );
}

function EditorHeader({
  circle = false,
  dark = false,
  onHome,
}: {
  circle?: boolean;
  dark?: boolean;
  onHome: () => void;
}) {
  return (
    <header className={`proto-editor-header${dark ? ' is-dark' : ''}`}>
      <button className="proto-brand-button" type="button" onClick={onHome}>
        <Brand circle={circle} />
      </button>
      <div className="proto-file-title">
        <span>IMG_2527.JPG</span>
        <small>4,272 × 2,848</small>
      </div>
      <div className="proto-history">
        <button type="button">Undo</button>
        <button type="button">Redo</button>
      </div>
      <button className="proto-export" type="button">
        <Icon name="export" />
        Export
      </button>
    </header>
  );
}

function ContactSheet({ view, photo, onFile, onSample, onHome }: PrototypeProps) {
  if (view === 'landing') {
    return (
      <main className="concept concept-a">
        <header className="a-header">
          <Brand />
          <span>Local photo editor</span>
          <span>Nothing uploads</span>
        </header>
        <section className="a-landing">
          <div className="a-copy">
            <h1>
              Find the feeling.
              <br />
              Keep the photograph.
            </h1>
            <p>Shape film-inspired Looks in your browser. No account, no cloud, no clutter.</p>
            <UploadAction onFile={onFile} onSample={onSample} />
          </div>
          <figure className="a-image">
            <Photo src={photo} />
            <figcaption>Source / local</figcaption>
          </figure>
          <div className="a-index" aria-hidden="true">
            <span>01</span>
            <span>Import</span>
            <span>Adjust</span>
            <span>Export</span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="concept concept-a a-editor">
      <EditorHeader onHome={onHome} />
      <ToolRail />
      <section className="a-canvas">
        <Photo src={photo} />
        <div className="proto-photo-meta">100% · After</div>
      </section>
      <EditorControls />
    </main>
  );
}

function Darkroom({ view, photo, onFile, onSample, onHome }: PrototypeProps) {
  if (view === 'landing') {
    return (
      <main className="concept concept-b">
        <header className="b-header">
          <Brand circle />
          <span>Your photographs stay here.</span>
        </header>
        <section className="b-landing">
          <figure>
            <Photo src={photo} />
            <div className="b-safe-light" aria-hidden="true" />
          </figure>
          <div className="b-copy">
            <h1>
              A quieter room
              <br />
              for your photographs.
            </h1>
            <p>Import locally. Develop a Look. Export a new image.</p>
            <UploadAction onFile={onFile} onSample={onSample}>
              Enter the darkroom
            </UploadAction>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="concept concept-b b-editor">
      <EditorHeader circle dark onHome={onHome} />
      <section className="b-canvas">
        <Photo src={photo} />
        <div className="b-canvas-actions">
          <button type="button">Before</button>
          <span>Fit</span>
        </div>
      </section>
      <ToolRail compact />
      <EditorControls />
      <div className="b-filmstrip" aria-label="Current edit strip">
        <Photo src={photo} />
        <Photo src={photo} />
        <Photo src={photo} />
        <span>Current edit</span>
      </div>
    </main>
  );
}

function GalleryProof({ view, photo, onFile, onSample, onHome }: PrototypeProps) {
  if (view === 'landing') {
    return (
      <main className="concept concept-c">
        <header className="c-header">
          <Brand />
          <nav>
            <a href="#process">Process</a>
            <a href="#privacy">Privacy</a>
          </nav>
        </header>
        <section className="c-landing">
          <div className="c-statement">
            <h1>
              Your photograph,
              <br />
              with room to breathe.
            </h1>
            <p>A private editing room for considered, film-inspired color.</p>
            <UploadAction onFile={onFile} onSample={onSample}>
              Open a photograph
            </UploadAction>
          </div>
          <figure className="c-proof">
            <Photo src={photo} />
            <figcaption>
              <span>OpenFilm proof</span>
              <span>Processed locally</span>
            </figcaption>
          </figure>
        </section>
        <footer className="c-footer">
          <span>JPEG · PNG · WebP</span>
          <span>No account. No upload.</span>
        </footer>
      </main>
    );
  }

  return (
    <main className="concept concept-c c-editor">
      <EditorHeader onHome={onHome} />
      <aside className="c-edit-nav">
        <strong>Edit room</strong>
        <ToolRail />
        <p>All changes remain reversible until export.</p>
      </aside>
      <section className="c-canvas">
        <div className="c-mat">
          <Photo src={photo} />
        </div>
        <span>Proof 01 · After</span>
      </section>
      <EditorControls />
    </main>
  );
}

function PrecisionInstrument({ view, photo, onFile, onSample, onHome }: PrototypeProps) {
  if (view === 'landing') {
    return (
      <main className="concept concept-d">
        <header className="d-header">
          <Brand circle />
          <span>Browser photo instrument</span>
          <span>v0.1</span>
        </header>
        <section className="d-landing">
          <div className="d-manifest">
            <h1>
              One image in.
              <br />
              One considered edit out.
            </h1>
            <ol>
              <li>Local processing</li>
              <li>Reusable Looks</li>
              <li>Full-resolution export</li>
            </ol>
          </div>
          <div className="d-drop">
            <Icon name="image" />
            <p>
              JPEG, PNG, or WebP
              <br />
              <span>up to 20 MB</span>
            </p>
            <UploadAction onFile={onFile} onSample={onSample}>
              Select source
            </UploadAction>
          </div>
          <div className="d-readout">
            <span>PRIVACY</span>
            <strong>LOCAL</strong>
            <span>PIPELINE</span>
            <strong>WEBGL2</strong>
            <span>ACCOUNT</span>
            <strong>NONE</strong>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="concept concept-d d-editor">
      <EditorHeader circle onHome={onHome} />
      <div className="d-status">
        <span>SOURCE 4272×2848</span>
        <span>PREVIEW 2048×1365</span>
        <span>COLOR RGB</span>
        <span>LOCAL ✓</span>
      </div>
      <ToolRail />
      <section className="d-canvas">
        <Photo src={photo} />
        <div>
          <span>X 0</span>
          <span>Y 0</span>
          <span>ZOOM 73%</span>
        </div>
      </section>
      <EditorControls mode="desk" />
    </main>
  );
}

function ProcessingStrip({ view, photo, onFile, onSample, onHome }: PrototypeProps) {
  if (view === 'landing') {
    return (
      <main className="concept concept-e">
        <header className="e-header">
          <Brand />
          <span>Private processing room</span>
        </header>
        <section className="e-landing">
          <div className="e-title">
            <h1>
              Develop your own
              <br />
              way of seeing.
            </h1>
            <p>OpenFilm keeps the process close: source, Look, geometry, export.</p>
            <UploadAction onFile={onFile} onSample={onSample}>
              Load first frame
            </UploadAction>
          </div>
          <div className="e-strip" aria-label="OpenFilm workflow">
            {['Source', 'Adjust', 'Shape', 'Export'].map((label, index) => (
              <figure key={label}>
                <Photo src={photo} />
                <figcaption>
                  <span>0{index + 1}</span>
                  {label}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="concept concept-e e-editor">
      <EditorHeader onHome={onHome} />
      <ol className="e-process">
        <li className="is-done">Source</li>
        <li className="is-active">Adjust</li>
        <li>Geometry</li>
        <li>Export</li>
      </ol>
      <section className="e-canvas">
        <div className="e-perf" aria-hidden="true" />
        <Photo src={photo} />
        <div className="e-frame-data">
          <span>FRAME 01</span>
          <span>AFTER</span>
          <span>73%</span>
        </div>
      </section>
      <EditorControls mode="desk" />
    </main>
  );
}

interface PrototypeProps {
  view: View;
  photo: string;
  onFile: (file: File) => void;
  onSample: () => void;
  onHome: () => void;
}

const concepts: Record<Variant, (props: PrototypeProps) => ReactNode> = {
  A: ContactSheet,
  B: Darkroom,
  C: GalleryProof,
  D: PrecisionInstrument,
  E: ProcessingStrip,
};

export default function OpenFilmDesignPrototype() {
  const [variant, setVariant] = useState<Variant>(readVariant);
  const [view, setView] = useState<View>(readView);
  const [photo, setPhoto] = useState(prototypePhoto);
  const ownedUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('variant', variant);
    params.set('view', view);
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
  }, [variant, view]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const currentIndex = variantKeys.indexOf(variant);
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      setVariant(variantKeys[(currentIndex + direction + variantKeys.length) % variantKeys.length]);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [variant]);

  function chooseFile(file: File) {
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    const url = URL.createObjectURL(file);
    ownedUrl.current = url;
    setPhoto(url);
    setView('editor');
  }

  function useSample() {
    setView('editor');
  }

  function moveVariant(direction: number) {
    const currentIndex = variantKeys.indexOf(variant);
    setVariant(variantKeys[(currentIndex + direction + variantKeys.length) % variantKeys.length]);
  }

  const Concept = concepts[variant];

  return (
    <div className="prototype-shell" data-variant={variant}>
      {photo ? (
        <Concept
          view={view}
          photo={photo}
          onFile={chooseFile}
          onSample={useSample}
          onHome={() => setView('landing')}
        />
      ) : null}
      <aside className="prototype-switcher" aria-label="Prototype controls">
        <button type="button" aria-label="Previous prototype" onClick={() => moveVariant(-1)}>
          ←
        </button>
        <div className="prototype-switcher-label">
          <strong>
            {variant} · {variants[variant].name}
          </strong>
          <span>{variants[variant].note}</span>
        </div>
        <div className="prototype-view-toggle" aria-label="Page preview">
          <button
            className={view === 'landing' ? 'is-active' : ''}
            type="button"
            onClick={() => setView('landing')}
          >
            Landing
          </button>
          <button
            className={view === 'editor' ? 'is-active' : ''}
            type="button"
            onClick={() => setView('editor')}
          >
            Editor
          </button>
        </div>
        <button type="button" aria-label="Next prototype" onClick={() => moveVariant(1)}>
          →
        </button>
      </aside>
    </div>
  );
}
