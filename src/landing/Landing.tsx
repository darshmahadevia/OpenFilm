import type { PointerEvent as ReactPointerEvent } from 'react';

import workstationScreenshot from '../../docs/screenshots/openfilm-workstation-wide.png';
import closingCoast from '../assets/openfilm-closing-coast.webp';
import darkroomHero from '../assets/openfilm-darkroom-hero.webp';
import coastalValley from '../assets/openfilm-landing-coastal-valley.webp';
import comparisonStreet from '../assets/openfilm-comparison-street.webp';

const releaseUrl =
  'https://github.com/darshmahadevia/OpenFilm/releases/latest/download/OpenFilm.dmg';
const repositoryUrl = 'https://github.com/darshmahadevia/OpenFilm';

function DownloadIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M5 21h14" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M5 12h13m-5-5 5 5-5 5" />
    </svg>
  );
}

function ReleaseLink({ compact = false }: { compact?: boolean }) {
  return (
    <a
      aria-label={compact ? 'Download OpenFilm for macOS' : undefined}
      className={compact ? 'landing-download landing-download--compact' : 'landing-download'}
      href={releaseUrl}
    >
      <span>{compact ? 'Download' : 'Download for macOS'}</span>
      <DownloadIcon />
    </a>
  );
}

function FilmStrip() {
  const frames = [
    { alt: 'A darkroom print under warm light', src: darkroomHero },
    { alt: 'A street photograph at dusk', src: comparisonStreet },
    { alt: 'A quiet coast under an open sky', src: closingCoast },
    { alt: 'A coastal valley in soft morning light', src: coastalValley },
  ];

  return (
    <div aria-hidden="true" className="landing-film-strip">
      <div className="landing-film-strip__track">
        {[...frames, ...frames].map((frame, index) => (
          <figure key={`${frame.src}-${index}`}>
            <span>{String((index % frames.length) + 1).padStart(2, '0')}</span>
            <img alt="" src={frame.src} />
          </figure>
        ))}
      </div>
    </div>
  );
}

function ComingSoon() {
  return (
    <main className="landing-coming-soon">
      <img alt="" className="landing-coming-soon__image" src={coastalValley} />
      <div aria-hidden="true" className="landing-coming-soon__shade" />
      <header>
        <span className="landing-wordmark">OpenFilm</span>
        <span>Mobile / tablet</span>
      </header>
      <div className="landing-coming-soon__content">
        <h1>Coming soon.</h1>
        <p>OpenFilm is being shaped for smaller screens. The macOS workstation is available now.</p>
      </div>
      <footer>
        <span>Local-first photography software</span>
        <a href={repositoryUrl}>Follow the project</a>
      </footer>
    </main>
  );
}

export default function Landing() {
  function moveHero(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty('--pointer-x', x.toFixed(3));
    event.currentTarget.style.setProperty('--pointer-y', y.toFixed(3));
  }

  function resetHero(event: ReactPointerEvent<HTMLElement>) {
    event.currentTarget.style.setProperty('--pointer-x', '0');
    event.currentTarget.style.setProperty('--pointer-y', '0');
  }

  return (
    <div className="landing-page">
      <ComingSoon />

      <div className="landing-desktop">
        <header className="landing-header">
          <a className="landing-skip" href="#main-content">
            Skip to content
          </a>
          <a aria-label="OpenFilm home" className="landing-wordmark" href="#top">
            OpenFilm
          </a>
          <nav aria-label="Main navigation" className="landing-nav">
            <a href="#workstation">Workstation</a>
            <a href="#workflow">Workflow</a>
            <a href={repositoryUrl}>Source</a>
          </nav>
          <ReleaseLink compact />
        </header>

        <main id="main-content">
          <section
            className="landing-hero"
            id="top"
            onPointerLeave={resetHero}
            onPointerMove={moveHero}
          >
            <div className="landing-hero__photograph" aria-hidden="true">
              <img alt="" src={darkroomHero} />
            </div>

            <div className="landing-hero__copy">
              <h1 aria-label="Review the whole shoot. Keep every photograph local.">
                <span aria-hidden="true">Review the whole shoot.</span>
                <span aria-hidden="true">Keep every photograph local.</span>
              </h1>
              <div className="landing-hero__details">
                <p>
                  A desktop workstation for culling, comparing, editing, and exporting a folder of
                  photographs. No account. No upload path.
                </p>
                <div>
                  <ReleaseLink />
                  <a className="landing-text-link" href="#workstation">
                    See the workstation <ArrowIcon />
                  </a>
                </div>
              </div>
            </div>

            <figure className="landing-hero__frame" aria-label="OpenFilm desktop workstation">
              <div className="landing-window-bar" aria-hidden="true">
                <span />
                <span />
                <span />
                <b>JUNE COAST / 184 PHOTOGRAPHS</b>
              </div>
              <img
                alt="OpenFilm showing a photograph grid, review controls, and the Edit inspector"
                src={workstationScreenshot}
              />
            </figure>

            <div className="landing-hero__meta" aria-hidden="true">
              <span>OPENFILM / 0.1</span>
              <span>LOCAL WORKSTATION</span>
            </div>
            <FilmStrip />
          </section>

          <section aria-label="Product facts" className="landing-facts">
            <p>
              <strong>Folders, not uploads.</strong> Source photographs stay where you put them.
            </p>
            <p>
              <strong>A durable Library.</strong> Review and Edit state lives beside the shoot.
            </p>
            <p>
              <strong>One rendering path.</strong> Loupe and Export share WebGL2 adjustments.
            </p>
          </section>

          <section className="landing-workstation" id="workstation">
            <div className="landing-section-heading">
              <h2>A contact sheet that remembers.</h2>
              <p>
                OpenFilm keeps ratings, Picks, Rejects, Selection, Looks, and Geometry with the
                Library. Close the app, reopen the folder, and continue the review.
              </p>
            </div>

            <div className="landing-workstation__stage">
              <div className="landing-workstation__rail" aria-hidden="true">
                <span>GRID</span>
                <span>LOUPE</span>
                <span>COMPARISON</span>
                <span>EDIT</span>
              </div>
              <img
                alt="The full OpenFilm workstation with a virtualized photograph Grid"
                src={workstationScreenshot}
              />
              <div className="landing-workstation__caption">
                <span>Grid / Loupe / Comparison</span>
                <p>Move from the full shoot to a single frame without losing review context.</p>
              </div>
            </div>
          </section>

          <section className="landing-workflow" id="workflow">
            <div className="landing-workflow__visual">
              <img alt="A coastal valley photographed in soft morning light" src={coastalValley} />
              <p>Source photographs remain in place throughout the review.</p>
            </div>
            <div className="landing-workflow__content">
              <div className="landing-workflow__title">
                <h2>One folder in. A finished set out.</h2>
                <p>Every step stays visible and attached to the Library.</p>
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
                    <p>Rate, filter, compare, and mark Picks without moving Source files.</p>
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
                OpenFilm has no account system, application backend, analytics, or runtime network
                request. It reads Source photographs only for metadata, a visible derivative, Loupe,
                or Export.
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
              <img alt="A finished street photograph at dusk" src={comparisonStreet} />
              <figcaption>Source photograph / rendered locally</figcaption>
            </figure>
          </section>

          <section className="landing-closing">
            <img alt="A quiet coastline photographed in soft evening light" src={closingCoast} />
            <div aria-hidden="true" className="landing-closing__veil" />
            <div className="landing-closing__content">
              <h2>The shoot stays yours.</h2>
              <p>Open the folder. Make the decisions. Export the photographs.</p>
              <ReleaseLink />
            </div>
          </section>
        </main>

        <footer className="landing-footer">
          <a className="landing-wordmark" href="#top">
            OpenFilm
          </a>
          <p>Local-first photography software.</p>
          <div>
            <a href={repositoryUrl}>GitHub</a>
            <a href={`${repositoryUrl}/blob/main/README.md`}>Documentation</a>
            <span>MIT License</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
