---
version: 4
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
The browser must support directory handles, IndexedDB, Web Workers, Canvas, and WebGL2.

## Current direction

The start screen has one dominant action, `Open folder`, beside a quiet recent-Library list. Format
and sidecar details remain supporting copy. Recovery appears only when it needs action.

The workstation keeps Library identity, modes, save state, and Export in the top bar. Filters and
secondary Library actions use disclosures. The command bar keeps only ordering, Auto-advance,
Selection, history, Edit, and Grid density visible. The photograph stage receives the space removed
from chrome.

## Implementation commitments

| Ingredient        | Commitment                                                                   |
| ----------------- | ---------------------------------------------------------------------------- |
| Start action      | One sand `Open folder` button with formats adjacent and sidecar detail below |
| Recent Libraries  | Ruled rows with one status and one contextual action                         |
| Workstation bar   | Grid / Loupe / Comparison, save state, Export, and one secondary-action menu |
| Filters           | One disclosure with an active-filter count and clear action                  |
| Command bar       | Order, Auto-advance, Selection, history, Edit, and contextual Grid density   |
| Accessibility     | Visible focus, semantic status, keyboard-complete menus, and reduced motion  |
| Responsive layout | No document overflow at wide, medium, 200-percent zoom, or compact width     |

## Review decisions

- Removed duplicate recent-Library status copy.
- Moved Review groups, Refresh, keyboard help, and Library exit into `More`.
- Moved the four filters into one counted disclosure and moved Grid density into the command bar.
- Kept Export visible because it closes the primary workflow.
- Removed the Electron update bridge and notice when the workstation returned to browser-only
  distribution.
