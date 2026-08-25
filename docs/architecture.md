# Architecture

OpenFilm uses one Vite entry point and one React tree. The production build is a static `dist/`
directory. There is no server route, API client, analytics script, or general-purpose component kit.

## Source folders

- `src/editor` contains editor state, adjustment values, normalized geometry, the Edit-specific grain
  seed, and the shared 50-entry edit history. The tone curve model owns bounded points,
  interpolation, lookup generation, ordering rules, and JSON serialization. The preset model owns
  the versioned JSON format and runtime checks.
- `src/import` validates JPEG, PNG, and WebP files, decodes them through browser APIs, and releases
  object URLs and temporary decoder resources.
- `src/rendering` contains the bounded WebGL2 preview renderer, geometry transforms, tone-curve
  lookup texture, vignette, deterministic grain, deferred luminance histogram, export sizing and
  encoding, resize handling, and context-loss recovery.
- `src/library` contains the versioned Library-file envelope, typed Library document validation,
  the browser directory gateway, Web Locks coordination, recoverable commit sequence, session and
  workspace outcomes, and the browser durability harness for the first v2 gate.
- `src/storage` contains separate IndexedDB records for custom Looks, the latest recoverable Edit,
  and recent Library handles with working copies. The Library sidecar remains the durable authority;
  storage also maps failures to product-language messages. Source bytes stay in the v1 Edit
  recovery record and never enter a reusable Look or Library working copy.
- `src/ui` contains design tokens, layout styles, and reusable buttons, fields, sliders, panels, and
  dialogs.

## State model

A Look stores reusable adjustment values, including the shared RGB tone curve, vignette, and grain
amount and size. An Edit stores the source photograph, the current Look, source-specific geometry,
history, and the grain seed. Preset JSON contains a versioned Look only. It never contains source
bytes, geometry, history, or the grain seed.

The preview and export paths use the same WebGL2 adjustment and geometry transform. The preview
buffer is bounded separately from the requested export size.

## Tests

Key Vitest and component tests are grouped by behavior:

- `src/App.test.tsx` covers the application shell and recovery states.
- `src/editor/adjustments.test.ts` covers adjustment values and their history reducer.
- `src/editor/editorState.test.ts` covers editor state.
- `src/editor/editHistory.test.ts` covers shared history.
- `src/editor/geometry.test.ts` covers normalized geometry and geometry history.
- `src/editor/grain.test.ts` covers Edit-specific grain seeds.
- `src/editor/looks.test.ts` covers bundled Looks.
- `src/editor/presets.test.ts` covers preset validation and serialization.
- `src/editor/toneCurve.test.ts` covers the RGB tone curve.
- `src/import/sourcePhotograph.test.ts` covers source-photograph validation and decoding.
- `src/storage/browserStorage.test.ts` covers browser and memory storage adapters.
- `src/library/libraryModel.test.ts` covers versioned Library document validation.
- `src/library/libraryGateway.test.ts` covers the Chromium directory picker and permission adapter.
- `src/library/libraryApplication.test.ts` covers Library creation, recent statuses, recovery, and
  read-only validation at the public application boundary.
- `src/library/libraryFile.test.ts` covers canonical JSON, checksums, parent revisions, and invalid files.
- `src/library/libraryFilePersistence.test.ts` covers commit phases, recovery, conflicts, permission
  loss, Retry, Save a copy, Revert, and unsaved mutation blocking.
- `src/rendering/export.test.ts` covers format and export sizing.
- `src/rendering/renderer.test.ts` covers renderer capability, geometry helpers, preview, and export.
- `src/ui/components/components.test.tsx` covers the reusable UI components.

Playwright runs Chromium journeys at desktop and phone widths and uses axe-core on the Library start
and loaded editor states. `e2e/libraryWorkspace.spec.ts` covers creation, reopen, IndexedDB recovery,
the explicit Saving/Saved/Unsaved/read-only states, and invalid Library-file protection. The existing
`e2e/libraryDurability.spec.ts` runs the Library commit harness against the Chromium Origin Private
File System.
