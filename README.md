# OpenFilm

OpenFilm is a local-first browser workstation for reviewing and editing a folder of JPEG, PNG, and
WebP photographs. It has no account system, application backend, or runtime upload path.

[Try the live app](https://openfilm.vercel.app) · [Repository](https://github.com/darshmahadevia/OpenFilm) · [CI](https://github.com/darshmahadevia/OpenFilm/actions/workflows/ci.yml)

![OpenFilm workstation at a wide viewport](./docs/screenshots/openfilm-workstation-wide.png)

## Shipped workflow

- Create or reopen a Library beside a Source-photo folder. OpenFilm keeps its versioned sidecars in
  `.openfilm/`; Source bytes do not enter the Library document.
- Review a progressively populated, virtualized Grid with three densities, persistent active state,
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

## Verification

```bash
npm run check
npm run check:ui-slop
npm run test:e2e
npm run perf:generate
npx playwright test e2e/performance.spec.ts
```

The performance gate uses a deterministic 2,000-record Library and records the measured browser
result under `.artifacts/`. Results are machine-specific; they are not a universal device claim.
See [testing](./docs/testing.md), [release evidence](./docs/release-evidence.md), and
[limitations](./docs/limitations.md).

## Architecture and privacy

OpenFilm is a React and Vite static application. Browser directory handles, IndexedDB working
copies, Web Workers, and WebGL2 provide the local workspace; there is no application server. Source
files stay in the selected folder and are read only when needed for metadata, visible derivatives,
Loupe, or Export. Browser storage and sidecars are recovery mechanisms, not backups.

See [architecture notes](./docs/architecture.md) and the [Library workspace contract](./docs/library-workspace.md).

## Supported boundary

The verified browser target is current Chromium on macOS. RAW, HEIC/HEIF, TIFF, archival color
management, cloud sync, and cross-device Libraries are out of scope. Comparison intentionally uses
bounded derivatives and labels that limitation. Similarity and sharpness analysis models exist
behind tested module boundaries but are not exposed in the shipped interface because a suitable
rights-cleared validation corpus has not passed the documented quality gate.

## License

OpenFilm is released under the [MIT License](./LICENSE). Dependency licenses and asset provenance are
recorded in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md), beside generated assets, and in the
[release evidence](./docs/release-evidence.md).
