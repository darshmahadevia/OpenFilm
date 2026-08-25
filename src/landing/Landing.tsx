import { useEffect, useMemo, useRef } from 'react';

import workstationScreenshot from '../../docs/screenshots/openfilm-workstation-wide.png';
import closingCoast from '../assets/openfilm-closing-coast.webp';
import darkroomHero from '../assets/openfilm-darkroom-hero.webp';
import coastalValley from '../assets/openfilm-landing-coastal-valley.webp';
import comparisonStreet from '../assets/openfilm-comparison-street.webp';
import { detectDesktopPlatform } from './platform';

const releases = {
  macOS: { asset: 'OpenFilm.dmg', detail: 'Universal DMG · unsigned preview' },
  Windows: { asset: 'OpenFilm-Setup.exe', detail: '64-bit installer · unsigned preview' },
} as const;
const releaseBaseUrl = 'https://github.com/darshmahadevia/OpenFilm/releases/latest/download';
const repositoryUrl = 'https://github.com/darshmahadevia/OpenFilm';

function useDesktopPlatform() {
  return useMemo(() => detectDesktopPlatform(navigator.userAgent, navigator.platform), []);
}

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

function SiteHeader({ download = false }: { download?: boolean }) {
  return (
    <header className="site-header">
      <a className="landing-skip" href="#main-content">
        Skip to content
      </a>
      <a aria-label="OpenFilm home" className="landing-wordmark" href="/">
        OpenFilm
      </a>
      <nav aria-label="Main navigation" className="landing-nav">
        <a href={download ? '/#workstation' : '#workstation'}>Workstation</a>
        <a href={download ? '/#workflow' : '#workflow'}>Workflow</a>
        <a href={repositoryUrl}>Source</a>
      </nav>
      <a className="header-download" href="/download">
        {download ? 'Choose a platform' : 'Download'} <ArrowIcon />
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
        <a href={repositoryUrl}>GitHub</a>
        <a href={`${repositoryUrl}/blob/main/README.md`}>Documentation</a>
        <span>MIT License</span>
      </div>
    </footer>
  );
}

function ProofFrame({
  compact = false,
  cropped = false,
}: {
  compact?: boolean;
  cropped?: boolean;
}) {
  const classes = ['proof-frame', compact && 'proof-frame--compact', cropped && 'proof-frame--crop']
    .filter(Boolean)
    .join(' ');
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
          src={workstationScreenshot}
        />
      </div>
    </figure>
  );
}

export function DownloadPage() {
  const detectedPlatform = useDesktopPlatform();
  const recommendation = detectedPlatform === 'unsupported' ? null : detectedPlatform;
  return (
    <div className="landing-page download-page">
      <SiteHeader download />
      <main id="main-content">
        <section className="download-hero">
          <div className="download-hero__copy">
            <p className="download-status" aria-live="polite">
              {recommendation
                ? `${recommendation} detected. This build is recommended for your computer.`
                : 'Choose the desktop build that matches your computer.'}
            </p>
            <h1>Bring the whole shoot to your desktop.</h1>
            <p>
              OpenFilm is free, open-source, and distributed through GitHub Releases. The current
              preview is unsigned, so your operating system may ask you to confirm the first launch.
            </p>
          </div>
          <div aria-label="OpenFilm desktop downloads" className="download-options" role="group">
            {(Object.keys(releases) as Array<keyof typeof releases>).map((platform) => {
              const release = releases[platform];
              const recommended = recommendation === platform;
              return (
                <article
                  className={recommended ? 'download-option is-recommended' : 'download-option'}
                  key={platform}
                >
                  <div>
                    <h2>{platform}</h2>
                    {recommended && <span className="recommended-label">Recommended</span>}
                  </div>
                  <p>{release.detail}</p>
                  <a className="landing-download" href={`${releaseBaseUrl}/${release.asset}`}>
                    Download for {platform} <DownloadIcon />
                  </a>
                  <small>{release.asset}</small>
                </article>
              );
            })}
          </div>
        </section>
        <section className="download-notes">
          <div>
            <h2>Before you install.</h2>
            <p>
              OpenFilm does not use a paid signing certificate yet. On macOS, open the DMG, drag
              OpenFilm to Applications, then control-click the app and choose Open if Gatekeeper
              blocks the first launch. On Windows, confirm the SmartScreen prompt only after
              checking that the installer came from this project’s GitHub Release.
            </p>
          </div>
          <dl>
            <div>
              <dt>Release source</dt>
              <dd>GitHub Releases</dd>
            </div>
            <div>
              <dt>Cost</dt>
              <dd>Free</dd>
            </div>
            <div>
              <dt>License</dt>
              <dd>MIT</dd>
            </div>
            <div>
              <dt>Updates</dt>
              <dd>Download requires approval</dd>
            </div>
          </dl>
        </section>
        <section className="download-proof">
          <div>
            <h2>See what you are installing.</h2>
            <p>
              A focused workstation for Grid review, Loupe, Comparison, non-destructive Edit, and
              Export.
            </p>
          </div>
          <ProofFrame compact />
          <a className="landing-text-link" href="/#workstation">
            Explore the workstation <ArrowIcon />
          </a>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export function HomePage() {
  return (
    <div className="landing-page">
      <SiteHeader />
      <main id="main-content">
        <section className="landing-hero" id="top">
          <figure className="landing-hero__photograph">
            <img alt="Flowers beside a film camera in a dim workspace" src={darkroomHero} />
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
                A desktop workstation for culling, comparing, editing, and exporting a folder of
                photographs. No account. No upload path.
              </p>
              <div className="landing-hero__actions">
                <a className="landing-download" href="/download">
                  Download OpenFilm <ArrowIcon />
                </a>
                <a className="landing-text-link" href="#workstation">
                  See the workstation <ArrowIcon />
                </a>
              </div>
            </div>
          </div>
          <div className="landing-hero__frame">
            <ProofFrame cropped />
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
            <strong>One rendering path.</strong> Loupe and Export share WebGL2 adjustments.
          </p>
        </section>
        <section className="landing-workstation" id="workstation">
          <div className="landing-section-heading">
            <h2>A contact sheet that remembers.</h2>
            <p>
              Ratings, Picks, Rejects, Selection, Looks, and Geometry stay with the Library. Close
              the app, reopen the folder, and continue the review.
            </p>
          </div>
          <ProofFrame cropped />
          <div className="landing-workstation__caption">
            <span>Grid / Loupe / Comparison</span>
            <p>Move from the full shoot to a single frame without losing review context.</p>
          </div>
        </section>
        <section className="landing-workflow" id="workflow">
          <figure className="landing-workflow__visual">
            <img alt="A coastal valley photographed in soft morning light" src={coastalValley} />
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
              OpenFilm has no account system, application backend, or analytics. The installed app
              contacts GitHub Releases for update checks and user-approved installer downloads.
              Source photographs and Library state are never sent there.
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
            <img alt="A street photograph at dusk" src={comparisonStreet} />
            <figcaption>Source photograph / rendered locally</figcaption>
          </figure>
        </section>
        <section className="landing-closing">
          <img alt="A quiet coastline photographed in soft evening light" src={closingCoast} />
          <div className="landing-closing__content">
            <h2>The shoot stays yours.</h2>
            <p>Open the folder. Make the decisions. Export the photographs.</p>
            <a className="landing-download" href="/download">
              Choose your download <ArrowIcon />
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function Landing() {
  return window.location.pathname.startsWith('/download') ? <DownloadPage /> : <HomePage />;
}
