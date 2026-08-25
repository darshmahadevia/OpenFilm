---
version: 2
slug: 'src-landing-landing-tsx'
primary_target: 'src/landing/Landing.tsx'
related_targets: ['index.html', 'src/landing/landing.css', 'electron/main.mjs', 'app.html']
---

## Scope and mode

Production product landing page and separate download route. Persuade mode. The workstation interface remains a
separate Operate surface at `app.html` and is outside this page's redesign boundary.

## Audience, action, proof, and constraints

The audience is a photographer deciding whether to install a local-first review workstation. The
primary action is reaching the download route and choosing the macOS or Windows build. Proof comes from the real workstation
screenshot, the shipped folder-to-Export workflow, and the precise local-file boundary. There are
no accounts, uploads, analytics, testimonials, invented performance claims, or cloud promises.

## Direction

Matte Proof Studio at editorial scale with a restrained kinetic-darkroom composition. A tightly set
Helvetica Neue carries the landing and download headings, while Bodoni remains in the wordmark. The
desktop hero pairs the factual local-first promise with a static darkroom photograph. The visitor then sees
workstation proof, the ordered Library workflow, local architecture, and one final image-led
download. Photography remains the strongest material; near-black, warm white, fine rules, and one
sand signal carry the OpenFilm identity.

## Implementation commitments

- The site root is a responsive product story; `/download` recommends a platform from the visitor's
  operating system while `app.html` remains the browser workstation and Electron entry.
- The hero removes the decorative film strip and pointer parallax. The copy carries the single
  first-viewport reveal; reduced motion removes it.
- Download links target the stable GitHub Release assets `OpenFilm.dmg` and
  `OpenFilm-Setup.exe`, with the unsigned preview status stated beside the actions.
- The real workstation screenshot is shown once at its native 16:10 proportion; no simulated product
  state, crop, or fake device frame is introduced.

## Review result

The finish reviewer returned `ship` after the download consent language, GitHub boundary, and
download-group semantics were corrected. Desktop and 390-pixel mobile captures, release links,
operating-system detection, horizontal overflow, console output, and the full project gate were
verified. The previous Helvetica Neue heading system was later restored without changing the
responsive scale or page proportions.
