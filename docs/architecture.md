# Architecture

OpenFilm is one React tree built by Vite into static files. There is no application server,
analytics path, or Source-photo upload. The browser owns the directory handle, durable sidecars,
transient image resources, and rendering context. The installed Electron shell separately contacts
GitHub Releases for update metadata and installer downloads.

## Boundaries

- `src/library/libraryApplication.ts` is the public workspace boundary. It opens or creates a
  Library, coordinates scan progress and recent-handle recovery, serializes durable commands, and
  exposes undo, redo, Retry, Save a copy, and Revert.
- `src/library/libraryFile*.ts` owns canonical JSON, checksums, parent revisions, Web Locks, pending
  and previous slots, atomic commit phases, and conflict recovery.
- `src/library/libraryGateway.ts` owns authorized folder enumeration, Source reads, and no-overwrite
  Export writes. It excludes `.openfilm/` from Source discovery.
- `src/library/libraryScanner.ts`, `libraryMetadata*.ts`, `libraryScheduler.ts`, and
  `libraryThumbnail.ts` own progressive discovery, bounded metadata reads, prioritized work,
  cancellation/retry generations, and disposable derivatives.
- `src/library/LibraryGrid.tsx` and `libraryGridModel.ts` own the fixed-row virtualized Grid. Active,
  Selection, filtering, ordering, navigation, and review commands live in `libraryReview.ts`.
- `src/library/libraryComparison.ts` and `libraryResourceCache.ts` own two-to-four-pane Comparison,
  linked focal geometry, and bounded reusable resources.
- `src/library/libraryReviewGroups.ts` owns deterministic Burst proposals and explicit group
  provenance. `libraryAnalysis.ts` owns versioned perceptual-hash and relative-sharpness signals;
  these are intentionally not connected to the shipped UI until their quality gate can be met.
- `src/library/libraryExportSet.ts` owns collision-safe paths and resumable manifests.
  `libraryRenderedExport.ts` renders each final result through the same WebGL2 renderer as Loupe.
- `src/library/libraryMigration.ts` and `libraryReconciliation.ts` isolate legacy migration,
  quarantine, fingerprint resolution, and unique-hash move reconciliation.
- `src/editor` owns normalized adjustments, RGB tone curves, Geometry, Looks, and rendering-safe Edit
  snapshots. `src/rendering` owns the shared WebGL2 preview/export pipeline and context lifecycle.
- `src/storage` owns recent handles and recoverable working copies in IndexedDB. The Library sidecar
  remains authoritative.
- `src/App.tsx` owns the Library start surface. `src/library/AdaptiveLibraryWorkspace.tsx` composes
  Grid, Loupe, Comparison, inspector, groups, Export, recovery surfaces, and shortcuts. `src/ui`
  supplies tokens and controls.
- `electron/updater.mjs` owns update checks, consent-based downloads, progress, and installer launch. A
  sandboxed preload bridge exposes only updater commands and state; the renderer has no general IPC.

## State and command flow

```text
keyboard / control
      │
      ▼
review or edit command ──► immutable Library document
      │                            │
      │                            ▼
      └────────────────────► serialized durable commit
                                   │
                        pending → library → previous
                                   │
                                   ▼
                         Saved / Unsaved / Read-only
```

Active photograph and Selection are distinct. Culling records the command before optional
auto-advance. Look-copy and other multi-record mutations form one command and one durable commit.
The application queues concurrent UI commands so two rapid actions cannot manufacture a stale-parent
conflict against its own write.

Photograph records contain paths, cheap fingerprints, extracted metadata, review state, optional
Edit state, and analysis-cache fields. They never contain Source bytes or browser object URLs.

## Rendering and resources

Loupe and rendered Export use the same adjustment, curve, Geometry, and grain implementation.
Comparison uses bounded derivatives and labels its fit-only resolution. Grid derivatives are created
for mounted rows and disposed when rows unmount. Schedulers reject stale generations and bound
concurrency and retry; caches enforce byte budgets rather than entry counts.

## Verification map

- Library durability and commands: `libraryApplication.test.ts`, `libraryFilePersistence.test.ts`,
  and `e2e/libraryDurability.spec.ts`
- Scan, reconciliation, metadata, scheduler, Grid, and resources: matching tests under `src/library`
- Review, groups, Comparison, Edit persistence, analysis, migration, and Export: matching focused
  Vitest files under `src/library`
- Rendering: `src/rendering/renderer.test.ts`, `src/rendering/export.test.ts`, and Loupe browser paths
- Product workflow and accessibility: `e2e/firstImportExport.spec.ts` and
  `e2e/libraryWorkspace.spec.ts`
- Desktop updates: `electron/updater.test.mjs` and `src/updates/DesktopUpdateNotice.test.tsx`
- Scale: `e2e/performance.spec.ts` plus `scripts/generate-performance-corpus.mjs`
- Visual evidence: `e2e/visualEvidence.spec.ts` and tracked screenshots under `docs/screenshots/`

See [testing](./testing.md) for commands and [release evidence](./release-evidence.md) for the measured
release verdict.
