# OpenFilm Library Workstation

This release replaces the single-photo landing/editor path with the local-first browser Library
workstation.

## Highlights

- Progressive recursive folder scan into a virtualized three-density Grid.
- Active and multi-photo Selection, keyboard culling, filters, ordering, auto-advance, and durable
  command-level undo/redo.
- Loupe, two-to-four-photo Comparison, non-destructive Edits, and atomic Look copy.
- Deterministic Burst proposals and editable Review groups with provenance.
- Collision-safe final-set Export with a resumable manifest and a bounded download fallback.
- Browser Library mode for Brave, Safari, Firefox, and other browsers without writable folder access,
  with folder reselection and Library backup download/import.
- Explicit recovery for interrupted writes, permission loss, stale revisions, malformed state,
  migrations, Missing Sources, and WebGL2 loss.
- A quieter start screen and workstation command bar with filters and secondary actions disclosed
  only when needed.
- Accessibility, responsive-layout, reduced-motion, visual-evidence, anti-slop, and 2,000-record
  performance gates.

## Deliberately constrained

Comparison renders bounded derivatives and labels them `Resolution limited · Fit`. Advisory
Similarity and Sharpness models are implemented and tested but do not appear in the interface until
a rights-cleared validation corpus meets the documented precision/recall gate. Export assumes sRGB,
strips Source metadata, and is not an archival or print-fidelity workflow. Measured performance and
assistive-technology evidence comes from current Chromium on macOS; results do not imply universal
browser or device support. OpenFilm does not ship a desktop shell, platform installer, or application
updater.

See [release evidence](./docs/release-evidence.md) and [limitations](./docs/limitations.md).
