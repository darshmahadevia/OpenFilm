---
version: 2
slug: 'src-landing-landing-tsx'
primary_target: 'src/landing/Landing.tsx'
related_targets: ['index.html', 'src/landing/landing.css', 'electron/main.mjs', 'app.html']
---

## Scope and mode

Production desktop-download landing page. Persuade mode. The workstation interface remains a
separate Operate surface at `app.html` and is outside this page's redesign boundary.

## Audience, action, proof, and constraints

The audience is a photographer deciding whether to install a local-first review workstation. The
primary action is downloading the macOS or Windows build. Proof comes from the real workstation
screenshot, the shipped folder-to-Export workflow, and the precise local-file boundary. There are
no accounts, uploads, analytics, testimonials, invented performance claims, or cloud promises.

## Direction

Matte Proof Studio at editorial scale with a restrained kinetic-darkroom composition. A clean,
tightly set sans serif now carries landing headings while Bodoni remains in the OpenFilm wordmark.
The desktop hero pairs the factual local-first promise with a darkroom photograph, a moving film
strip, pointer depth, and the real workstation entering at the fold. The visitor then sees
workstation proof, the ordered Library workflow, local architecture, and one final image-led
download. Photography remains the strongest material; near-black, warm white, fine rules, and one
sand signal carry the OpenFilm identity.

## Implementation commitments

- The site root is the download page; `app.html` remains the browser workstation and Electron entry.
- At 1024 CSS pixels and below, the download page is replaced by a dedicated, image-led `Coming
soon.` view for phone and tablet visitors.
- Desktop motion uses one coordinated darkroom system: a film-strip loop, pointer depth, the
  workstation entrance, and progressive scroll reveals. Reduced motion removes every authored move.
- Download links target the stable GitHub Release assets `OpenFilm.dmg` and
  `OpenFilm-Setup.exe`, with the unsigned preview status stated beside the actions.
- The same real workstation screenshot supplies hero and detailed proof; no simulated product state
  or fake device frame is introduced.

## Review result

The finish reviewer returned `ship` after the compact mobile download action gained its explicit
accessible name. Desktop and 390-pixel mobile captures, Axe checks, horizontal-overflow checks, the
packaged Electron page, and the universal DMG were verified.
