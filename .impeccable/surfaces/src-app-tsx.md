---
version: 5
slug: 'src-app-tsx'
primary_target: 'src/App.tsx'
related_targets: ['src/app.css', 'src/library/AdaptiveLibraryWorkspace.tsx', 'app.html']
---

## Scope and mode

Production browser Library start screen and adaptive workstation. Operate mode. The public landing
page remains a separate Persuade surface at the site root.

## Audience, job, action, proof, constraints

The photographer needs to open or resume one local Library, review a shoot, make non-destructive
Edits, and Export a finished set. Source photographs stay in place. The UI must preserve every
shipped command while keeping secondary controls out of the main reading path. There are no
accounts, uploads, analytics, cloud storage, desktop packages, installers, or application updates.
The browser must support directory selection, IndexedDB, Web Workers, Canvas, Web Crypto, and
WebGL2. Writable directory handles are an enhancement, not an entry requirement.

## Current direction

The start screen has one dominant action, `Open folder`, beside a quiet recent-Library list. Format
and persistence details remain supporting copy. Browsers without writable folder access state the
Browser Library trade-off and offer backup import. Recovery appears only when it needs action.

The workstation keeps a direct Libraries route, Library identity, modes, save state, and Export in
the top bar. One sentence names the path from Grid review through Loupe and Edit to Export. The
Active photograph rail keeps review marks, rating, and Selection actions beside the stage, while
Grid footers stay calm and less-frequent photo actions stay in overflow. Filters, Review groups,
Edit, and View remain discoverable in the command bar; maintenance actions use More. Order,
Auto-advance, and Grid size live under View. Empty folders replace the command bar and duplicate
messages with one next action.

## Implementation commitments

| Ingredient        | Commitment                                                                             |
| ----------------- | -------------------------------------------------------------------------------------- |
| Start action      | One sand `Open folder` button with formats and persistence detail nearby               |
| Recent Libraries  | Ruled rows with one status and `Choose folder` when sources need access                |
| Workstation bar   | Direct Libraries route, modes, save state, Export, and More with maintenance actions   |
| Review rail       | Active photograph identity, Pick/Reject/rating, Selection, and Compare actions         |
| Grid surface      | Stable metadata footers, explicit Active/Selected state, and photo actions in overflow |
| Filters           | One disclosure with an active-filter count and clear action                            |
| Command bar       | Filters, Review groups, Edit, View, and only contextual history                        |
| Overlays          | One active popover/modal, priority Escape behavior, outside-click safety, focus return |
| Accessibility     | Visible focus, semantic status, keyboard-complete menus, and reduced motion            |
| Responsive layout | No document overflow at wide, medium, 200-percent zoom, or compact width               |

## Review decisions

- Removed duplicate recent-Library status copy.
- Kept `Libraries` and `Review groups` directly discoverable; kept Refresh, keyboard help, and
  Library backup maintenance in `More`.
- Moved the four filters into one counted disclosure.
- Moved Order, Auto-advance, and Grid size into View; hid empty Selection and history controls.
- Added an Active photograph rail so review decisions and Selection actions stay adjacent to the
  current image instead of competing with every Grid tile.
- Added explicit Grid Active/Selected badges and a shared one-open popover lifecycle with
  priority Escape handling and focus restoration for protected overlays.
- Added a concise Grid to Loupe/Edit to Export workflow line and one-action empty states.
- Kept Export visible because it closes the primary workflow.
- Removed the Electron update bridge and notice when the workstation returned to browser-only
  distribution.
- Added Browser Library persistence, folder reselection, and backup import/download when writable
  folder access is unavailable.
