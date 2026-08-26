# OpenFilm

OpenFilm is a local-first browser workstation for reviewing and editing a folder of JPEG, PNG, and
WebP photographs. It has no account system, application backend, analytics, or upload path.

[Open OpenFilm](https://openfilm.vercel.app/app.html) · [Visit the site](https://openfilm.vercel.app) · [Repository](https://github.com/darshmahadevia/OpenFilm) · [CI](https://github.com/darshmahadevia/OpenFilm/actions/workflows/ci.yml)

![OpenFilm workstation at a wide viewport](./docs/screenshots/openfilm-workstation-wide.png)

## Shipped workflow

- Create or reopen a Library for a Source-photo folder. OpenFilm keeps versioned sidecars in
  `.openfilm/` when writable folder access is available. Other browsers use a Browser Library in
  IndexedDB and ask for the Source folder again after reload. Source bytes do not enter the Library
  document or browser storage.
- Review a progressively populated, virtualized Grid with three densities, persistent Active state,
  range Selection, filters, ordering, ratings, Pick/Reject/Unmarked, and optional auto-advance.
- Inspect one photograph in Loupe, compare two to four bounded derivatives, and edit Light, Color,
  Curve, Finish, Geometry, and Looks with the shared WebGL2 rendering path.
- Accept deterministic Burst proposals or make manual groups, then split, merge, dissolve, or dismiss
  them without losing provenance.
- Export Picks or the current Selection with collision-safe names and a resumable manifest when the
  browser grants folder write access. A bounded download fallback is available for up to 12 files.
- Recover explicitly from interrupted writes, stale revisions, missing Sources, permission loss,
  invalid Library files, and unsaved working state.

A Look is reusable rendering state. An Edit is one Photograph record's Look plus source-specific
geometry and revision. A Library is the durable local review record. See [CONTEXT.md](./CONTEXT.md)
for the project vocabulary.

## Run locally

OpenFilm uses Node.js `22.20.0` and npm `11.19.0`.

```bash
nvm install
npm ci
npm run dev
```

Vite serves the landing page at `/` and the browser workstation at `/app.html`.

## Verification

```bash
npm run check
npm run check:ui-slop
npm run test:e2e
npm run perf:generate
npm run test:e2e:performance
```

The performance gate uses a deterministic 2,000-record Library and records the measured browser
result under `.artifacts/`. Results are machine-specific; they are not a universal device claim.
See [testing](./docs/testing.md), [release evidence](./docs/release-evidence.md), and
[limitations](./docs/limitations.md).

## Architecture and privacy

OpenFilm is a static React and Vite application. Directory selection, IndexedDB, Web Workers, Web
Crypto, and WebGL2 provide the local workspace; there is no application server. Source files stay in
the selected folder and are read only when needed for metadata, visible derivatives, Loupe, or
Export. Source photographs are never copied into browser storage.

Writable folder access enables `.openfilm` sidecars and resumable folder Export. Browsers without it
use Browser Library storage, folder reselection, Library backup download/import, and bounded download
Export. There are no Electron packages, platform installers, or application update checks. See
[architecture notes](./docs/architecture.md) and the
[Library workspace contract](./docs/library-workspace.md).

## Supported boundary

OpenFilm's measured release target remains current desktop Chromium. The Browser Library fallback
removes writable directory handles as an entry requirement for browsers such as Brave, Safari, and
Firefox, but those browsers still need IndexedDB, Web Workers, Web Crypto, Canvas, WebGL2, and folder
selection. RAW, HEIC/HEIF, TIFF, archival color management, cloud sync, and cross-device Libraries
are out of scope. Comparison intentionally uses bounded
derivatives and labels that limitation. Similarity and Sharpness analysis models exist behind tested
module boundaries but are not exposed because a rights-cleared validation corpus has not passed the
documented quality gate.

## License

OpenFilm is released under the [MIT License](./LICENSE). Dependency licenses and asset provenance are
recorded in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md), beside generated assets, and in the
[release evidence](./docs/release-evidence.md).
