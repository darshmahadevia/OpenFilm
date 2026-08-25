# OpenFilm

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

The workstation ships in a sandboxed Electron desktop shell for macOS and Windows, and Vite also
produces a browser build. The public web root is the desktop download page.

## Users

Photographers who want to review, cull, compare, make a focused non-destructive Edit, and export a
local shoot without an account, backend, or cloud transfer.

## Product purpose

OpenFilm is a quiet, local-first Library workstation. It references JPEG, PNG, and WebP Source
photographs in one authorized folder, stores durable review and Edit state beside that folder, and
keeps the photographer's decisions explicit and recoverable.

## Primary journey

1. Open a folder or reopen a recent Library.
2. Review the progressive Grid with Active, Selection, Rating, Disposition, filters, and ordering.
3. Move into Loupe or Comparison without losing review context.
4. Edit the Active photograph, copy a Look atomically, and organize explicit Review groups.
5. Export Picks or Selection to a folder with a resumable manifest, or use the bounded download
   fallback.

## Capabilities and constraints

- Library sidecars are authoritative. IndexedDB working copies and recent directory handles support
  recovery but do not back up Source photographs.
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

## Brand commitments

- Keep the OpenFilm wordmark; do not use the old `OF` monogram.
- Make the photograph the strongest object and use compact near-black chrome, warm-white type, fine
  separators, and one restrained sand interaction color.
- Use product vocabulary from `CONTEXT.md` and calm, factual recovery language.
- Avoid gradients, glass effects, ornamental dashboards, marketing slogans, fake activity, social
  proof, or claims beyond recorded evidence.
- The download page may use a larger editorial scale than the workstation, but it keeps the same
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
