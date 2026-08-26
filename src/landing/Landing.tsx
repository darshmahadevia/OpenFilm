import { useEffect, useRef } from 'react';

import workstationScreenshot from '../../docs/screenshots/openfilm-workstation-wide.png';
import closingCoast from '../assets/openfilm-closing-coast.webp';
import darkroomHero from '../assets/openfilm-darkroom-hero.webp';
import coastalValley from '../assets/openfilm-landing-coastal-valley.webp';
import comparisonStreet from '../assets/openfilm-comparison-street.webp';

const repositoryUrl = 'https://github.com/darshmahadevia/OpenFilm';
const browserSupportUrl = `${repositoryUrl}/blob/main/README.md#browser-support`;

function ArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M5 12h13m-5-5 5 5-5 5" />
    </svg>
  );
}

function FilmStrip() {
  const stripRef = useRef<HTMLDivElement>(null);
  const frames = [darkroomHero, comparisonStreet, closingCoast, coastalValley];

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    if (!('IntersectionObserver' in window)) {
      strip.dataset.running = 'false';
      return;
    }

    let intersects = false;
    const updatePlayback = () => {
      strip.dataset.running = String(intersects && !document.hidden);
    };
    const observer = new IntersectionObserver(([entry]) => {
      intersects = entry.isIntersecting;
      updatePlayback();
    });

    observer.observe(strip);
    document.addEventListener('visibilitychange', updatePlayback);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', updatePlayback);
    };
  }, []);

  return (
    <div aria-hidden="true" className="landing-film-strip" ref={stripRef}>
      <div className="landing-film-strip__track">
        {[...frames, ...frames].map((src, index) => (
          <figure key={`${src}-${index}`}>
            <span>{String((index % frames.length) + 1).padStart(2, '0')}</span>
            <img alt="" src={src} />
          </figure>
        ))}
      </div>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="site-header">
      <a className="landing-skip" href="#main-content">
        Skip to content
      </a>
      <a aria-label="OpenFilm home" className="landing-wordmark" href="/">
        OpenFilm
      </a>
      <nav aria-label="Main navigation" className="landing-nav">
        <a href="#workstation">Workstation</a>
        <a href="#workflow">Workflow</a>
        <a
          aria-label="Source code on GitHub (opens in a new tab)"
          href={repositoryUrl}
          rel="noreferrer"
          target="_blank"
        >
          Source
        </a>
      </nav>
      <a className="header-launch" href="/app.html">
        Open the workstation <ArrowIcon />
      </a>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="landing-footer">
      <a className="landing-wordmark" href="/">
        OpenFilm
      </a>
      <p>Local-first photography software.</p>
      <div>
        <a href={repositoryUrl} rel="noreferrer" target="_blank">
          GitHub
        </a>
        <a href={`${repositoryUrl}/blob/main/README.md`} rel="noreferrer" target="_blank">
          Documentation
        </a>
        <span>MIT License</span>
      </div>
    </footer>
  );
}

function MobileWorkstationStatus() {
  return (
    <div className="landing-mobile-status" role="status">
      <strong>Desktop workstation</strong>
      <span>Open this page on a computer. Mobile access is coming soon.</span>
      <a href={browserSupportUrl} rel="noreferrer" target="_blank">
        Browser requirements <ArrowIcon />
      </a>
    </div>
  );
}

function ProofFrame({ cropped = false, eager = false }: { cropped?: boolean; eager?: boolean }) {
  const classes = ['proof-frame', cropped && 'proof-frame--crop'].filter(Boolean).join(' ');
  return (
    <figure className={classes}>
      <div className="landing-window-bar" aria-hidden="true">
        <span />
        <span />
        <span />
        <b>JUNE COAST / 184 PHOTOGRAPHS</b>
      </div>
      <div className="proof-frame__image">
        <img
          alt="OpenFilm showing a photograph grid, review controls, and the Edit inspector"
          decoding="async"
          fetchPriority={eager ? 'high' : 'auto'}
          height="900"
          loading={eager ? 'eager' : 'lazy'}
          src={workstationScreenshot}
          width="1440"
        />
      </div>
    </figure>
  );
}

export function HomePage() {
  return (
    <div className="landing-page">
      <SiteHeader />
      <main id="main-content">
        <section className="landing-hero" id="top">
          <figure className="landing-hero__photograph">
            <img
              alt="Flowers beside a film camera in a dim workspace"
              decoding="async"
              fetchPriority="high"
              height="1024"
              src={darkroomHero}
              width="1536"
            />
            <FilmStrip />
            <figcaption>Local-first photography software</figcaption>
          </figure>
          <div className="landing-hero__copy">
            <h1 aria-label="Review the whole shoot. Keep every photograph local.">
              <span aria-hidden="true">Review the whole shoot.</span>
              <span aria-hidden="true">Keep every photograph local.</span>
            </h1>
            <div className="landing-hero__details">
              <p>
                A browser workstation for culling, comparing, editing, and exporting a folder of
                photographs. No account. No upload path.
              </p>
              <div className="landing-hero__actions">
                <a
                  className="landing-launch landing-launch--desktop landing-launch--icon-button"
                  href="/app.html"
                >
                  Open the workstation
                  <span className="landing-launch__icon">
                    <ArrowIcon />
                  </span>
                </a>
                <MobileWorkstationStatus />
                <a className="landing-text-link" href="#workstation">
                  See the workstation <ArrowIcon />
                </a>
                <p className="landing-launch-note">
                  Desktop browser · JPEG, PNG, WebP · choose a folder after launch.{' '}
                  <a href={browserSupportUrl} rel="noreferrer" target="_blank">
                    Browser limits
                  </a>
                </p>
              </div>
            </div>
          </div>
          <div className="landing-hero__frame">
            <ProofFrame cropped eager />
          </div>
        </section>
        <section aria-label="Product facts" className="landing-facts">
          <p>
            <strong>Folders, not uploads.</strong> Source photographs stay where you put them.
          </p>
          <p>
            <strong>A durable Library.</strong> Review and Edit state lives beside the shoot.
          </p>
          <p>
            <strong>One rendering path.</strong> Loupe and Export apply the same adjustments.
          </p>
        </section>
        <section className="landing-workstation" id="workstation">
          <div className="landing-section-heading">
            <h2>A contact sheet that remembers.</h2>
            <p>
              Ratings, Picks, Rejects, Selection, reusable Looks, and crop or rotation settings stay
              with the Library. Close the browser, reopen the folder, and continue the review.
            </p>
          </div>
          <ProofFrame cropped />
          <div className="landing-workstation__caption">
            <span>Grid / Loupe / Comparison</span>
            <p>Move from the full shoot to a single frame without losing review context.</p>
          </div>
          <div className="landing-review-controls">
            <p>
              Review from each photograph's actions menu, or keep both hands on the keyboard.
              Selection stays visible as you move into Comparison.
            </p>
            <div aria-label="Workstation keyboard shortcuts" className="landing-key-map">
              <span>
                <kbd>P</kbd> Pick
              </span>
              <span>
                <kbd>X</kbd> Reject
              </span>
              <span>
                <kbd>0–5</kbd> Rate
              </span>
              <span>
                <kbd>Space</kbd> Select
              </span>
              <span>
                <kbd>Enter</kbd> Loupe
              </span>
              <span>
                <kbd>C</kbd> Compare
              </span>
            </div>
          </div>
        </section>
        <section className="landing-workflow" id="workflow">
          <figure className="landing-workflow__visual">
            <img
              alt="A coastal valley photographed in soft morning light"
              decoding="async"
              height="1024"
              loading="lazy"
              src={coastalValley}
              width="1536"
            />
            <figcaption>Source photographs remain in place throughout the review.</figcaption>
          </figure>
          <div className="landing-workflow__content">
            <div className="landing-workflow__title">
              <h2>One folder in. A finished set out.</h2>
              <p>Four clear steps keep every decision attached to the Library.</p>
            </div>
            <ol className="landing-workflow__steps">
              <li>
                <span>01</span>
                <div>
                  <h3>Open a Library</h3>
                  <p>Choose a folder of JPEG, PNG, or WebP photographs.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Review the Grid</h3>
                  <p>
                    Use a photograph's actions menu or keyboard shortcuts to Rate, Select, mark
                    Picks, and Rejects.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Make the Edit</h3>
                  <p>Shape Light, Color, Curve, Finish, Geometry, and reusable Looks.</p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <h3>Export the set</h3>
                  <p>Write Picks or the Selection to a folder with resumable progress.</p>
                </div>
              </li>
            </ol>
          </div>
        </section>
        <section className="landing-local">
          <div className="landing-local__copy">
            <h2>Your files never need to leave the machine.</h2>
            <p>
              OpenFilm has no account system, application backend, analytics, or upload path. The
              browser reads Source photographs only after you choose their folder. Chrome and Edge
              can store Library state beside the shoot. Other supported desktop browsers use a
              Browser Library. Source photographs stay in place and are not backed up by OpenFilm.
            </p>
            <dl>
              <div>
                <dt>Library record</dt>
                <dd>.openfilm/library.json</dd>
              </div>
              <div>
                <dt>Source files</dt>
                <dd>Referenced in place</dd>
              </div>
              <div>
                <dt>License</dt>
                <dd>MIT</dd>
              </div>
            </dl>
          </div>
          <figure className="landing-local__image">
            <img
              alt="A street photograph at dusk"
              decoding="async"
              height="1024"
              loading="lazy"
              src={comparisonStreet}
              width="1536"
            />
            <figcaption>Source photograph / rendered locally</figcaption>
          </figure>
        </section>
        <section className="landing-closing">
          <img
            alt="A quiet coastline photographed in soft evening light"
            decoding="async"
            height="1024"
            loading="lazy"
            src={closingCoast}
            width="1536"
          />
          <div className="landing-closing__content">
            <h2>The shoot stays yours.</h2>
            <p>Open the folder. Make the decisions. Export the photographs.</p>
            <a className="landing-launch landing-launch--desktop" href="/app.html">
              Open the workstation <ArrowIcon />
            </a>
            <MobileWorkstationStatus />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function Landing() {
  return <HomePage />;
}
