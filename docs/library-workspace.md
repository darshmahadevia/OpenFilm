# Library workspace contract

The Library workstation is OpenFilm's default and only shipped product surface. It remains static
and local-first: the user selects one folder and Source photographs stay there. OpenFilm stores
versioned sidecars under `.openfilm/` when writable folder access is available. Otherwise it creates
a Browser Library in IndexedDB and asks for the Source folder again after reload.

## Authority and recovery

For a folder-access Library, `library.json` is the durable authority. `library.pending.json` and
`library.previous.json` are recovery slots governed by the commit protocol. For a Browser Library,
IndexedDB stores the authoritative versioned envelope and a downloadable backup carries that same
envelope. Every commit has a checksum, monotonically increasing revision, and parent revision.
Validation covers the envelope and the typed Library document. An invalid, unsupported, or
conflicting file opens read-only and is never replaced by a working copy.

IndexedDB also stores recent directory handles, the last durable revision reference, and recoverable
working copies. A folder-access working copy is an aid, not a second source of truth. User-visible
outcomes are `Saved`, `Saving`, `Unsaved`, and `Read-only`. Unsaved state blocks another mutation
until Retry, Save a copy, or Revert resolves it.

## Discovery and Grid

The recursive scanner reports supported and unsupported files separately and yields records as it
goes. It starts with cheap `lastModified + byteSize` fingerprints and bounded metadata reads; no
full-resolution decode is required to make the Grid usable. Known capture times sort before unknown
times, then relative path and record ID provide deterministic ties.

The Grid has Overview, Standard, and Detail densities with fixed geometry and row virtualization.
Only mounted rows request transient thumbnails. Active and Selection are separate state: click moves
Active, modifier or keyboard range commands extend Selection, and the toolbar always shows the
Selection count. Filters include disposition, rating, Source state, and capture ordering.

Refreshing reuses identity for the same path and fingerprint, marks absent records Missing, and gives
changed bytes at the same path a new record. Explicit Refresh caches content hashes as low-priority
work for later moves; initial open remains cheap. A unique cached hash reconciles a moved file.
Ambiguous candidates produce named choices in the Grid and preserve prior state until the
photographer chooses one.

## Review, Loupe, and Comparison

The workstation supports `0–5`, `P`, `X`, and `U` review commands, arrow navigation, optional
auto-advance, and command-level undo/redo. The command is committed before the Active photograph
moves. Filtered-empty and no-next-photo cases preserve a valid context.

Loupe loads one active Source into the shared renderer and supports Fit, a 100-percent request,
Source/Rendered comparison, nearby navigation, and keyboard return to Grid. Comparison accepts two
to four selected photographs. Linked panes share zoom and normalized focal point; panes can be
unlinked independently. Comparison uses bounded derivatives and is labeled
`Resolution limited · Fit`.

## Edits and groups

Each Photograph has neutral Edit defaults, persistent adjustments, tone curve, Geometry, and a
revision. Light, Color, Curve, Finish, Geometry, and Looks are grouped in a focus-contained inspector.
Copy Look to Selection validates all targets, changes them atomically, and participates in the same
undo/redo and durable-command boundary.

Burst proposals are deterministic: adjacent capture times within two seconds and matching normalized
camera serials form candidates. Accept and dismiss are explicit. Accepted and manual groups preserve
their origin and can be merged, split, or dissolved without changing culling state.

Perceptual similarity and relative sharpness implementations are versioned, cached, cancellable,
and bounded to time-neighborhood candidates. They remain intentionally absent from the product UI
until a rights-cleared labeled corpus meets the quality gate.

## Final-set Export

Export operates on all Picks or the current Selection. Planning resolves case-insensitive path
collisions, optionally preserves Source folders, and records an explicit source-to-output binding.
Folder writes refuse overwrite. A manifest records checksum, status, and failure per
photograph; it is written before work and after every entry. Reopening the folder reconciles output
checksums, skips valid results, and gives incomplete occupied paths a new collision-safe name rather
than overwriting them. Cancel stops after the current photograph. Browser Library mode uses the
download fallback, which is capped at 12 files and cannot resume after reload.

All final-set images use the shared renderer. Output assumes sRGB, strips Source metadata, and does
not claim archival or print fidelity.

## Keyboard summary

| Key                      | Command                     |
| ------------------------ | --------------------------- |
| Left / Right             | Move Active                 |
| Shift + Left / Right     | Extend Selection            |
| 0–5                      | Clear or set rating         |
| P / X / U                | Pick, Reject, Unmarked      |
| Enter / Escape           | Enter Loupe, return to Grid |
| C / E                    | Comparison, Edit inspector  |
| Space / Z                | Hold or toggle Loupe zoom   |
| Command/Ctrl + Z         | Undo                        |
| Command/Ctrl + Shift + Z | Redo                        |

See [architecture](./architecture.md), [limitations](./limitations.md), and
[release evidence](./release-evidence.md).
