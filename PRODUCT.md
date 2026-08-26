# OpenFilm

<!-- impeccable:product-schema 1 -->

## Platform

web

Vite ships a static landing page and browser workstation. The landing page opens the workstation at
`app.html`; there are no platform installers, desktop packages, or application update path.

## Users

Photographers who want to review, cull, compare, make a focused non-destructive Edit, and export a
local shoot without an account, backend, or cloud transfer.

## Product purpose

OpenFilm is a quiet, local-first Library workstation. It references JPEG, PNG, and WebP Source
photographs in one authorized folder. It stores durable review and Edit state beside that folder when
writable folder access is available, or in browser storage as a Browser Library when it is not.

## Primary journey

1. Open a folder or reopen a recent Library.
2. Review the progressive Grid with Active, Selection, Rating, Disposition, filters, and ordering.
3. Move into Loupe or Comparison without losing review context.
4. Edit the Active photograph, copy a Look atomically, and organize explicit Review groups.
5. Export Picks or Selection to a folder with a resumable manifest, or use the bounded download
   fallback.

## Capabilities and constraints

- Library sidecars are authoritative when writable directory handles are available. A Browser
  Library keeps its versioned Library file in IndexedDB and supports backup download and import.
  Neither mode backs up Source photographs.
- Grid work is virtualized and scheduled. Source reads, thumbnails, metadata, analysis, rendering,
  and Export remain bounded by explicit capability or resource limits.
- Loupe and Export share WebGL2 adjustment and Geometry semantics. Comparison uses resolution-limited
  derivatives and labels them honestly.
- Light, Color, Curve, Finish, Geometry, and Looks persist as non-destructive Edit state. Undo/redo is
  bounded in-session history, not a durable historical revision log.
- Burst grouping is deterministic. Similarity and relative Sharpness remain out of the UI until the
  documented validation gate can be met.
- Export assumes sRGB, strips Source metadata, and makes no archival or print-fidelity promise.
- RAW, HEIC/HEIF, TIFF, cloud sync, accounts, analytics, and cross-device Libraries are out of scope.
- The workstation has no update or installer network path. Current browsers need directory selection,
  IndexedDB, Web Workers, Canvas, Web Crypto, and WebGL2. Writable directory handles add in-folder
  sidecars and resumable folder Export; other browsers use Browser Library and download fallbacks.

## Brand commitments

- Keep the OpenFilm wordmark; do not use the old `OF` monogram.
- Make the photograph the strongest object and use compact near-black chrome, warm-white type, fine
  separators, and one restrained sand interaction color.
- Use product vocabulary from `CONTEXT.md` and calm, factual recovery language.
- Avoid gradients, glass effects, ornamental dashboards, marketing slogans, fake activity, social
  proof, or claims beyond recorded evidence.
- The landing page may use a larger editorial scale than the workstation, but it keeps the same
  palette, type, photographic authority, and factual product language.

## Accessibility

All critical paths must be keyboard operable with visible focus. Active, Selection, Rating,
Disposition, save state, progress, errors, pane/link state, and recovery must have textual or
semantic cues beyond color. Modal surfaces contain focus, restore it on close, and make the
background inert. Layouts remain reachable across documented desktop widths, 200-percent zoom, and
reduced-motion preference.

## Evidence boundary

Release claims come from the checked-in unit, browser, durability, accessibility, visual, and
performance harnesses. Representative screenshots and generated fixture provenance are tracked.
No testimonials, usage metrics, universal device claims, or unmeasured fidelity claims are implied.
