# The Sliding Studio — single-comp prompt

Use case: ui-mockup
Asset type: high-fidelity desktop landing-page decision comp for a real browser photo editor

## Prompt

Create one polished, shippable 3:2 landscape desktop web UI screenshot for OpenFilm's new visual world, “The Sliding Studio”. This is a product interface comp, not concept art, not a device mockup, and not a marketing illustration. The website itself should be the image.

Composition: 1536 × 1024 browser viewport, edge-to-edge desktop website with a tiny top chrome-free utility header. The photograph is the dominant content, occupying about 70% of the viewport. Use the supplied OpenFilm sample photograph as the main photograph: analog camera, open notebook, cup and dried flowers on a wood desk in late-afternoon window light. Preserve its recognizable composition and make it look like a real photo editor canvas. A slim honest vertical before/after divider runs through the photo; on the left side show a slightly flatter original, on the right side show a subtle film-inspired edit. No fake app dashboard or laptop frame.

Visual system: Rietveld-inspired movable planes, translated into a refined web interface. Large white and cool-gray planes slide over the photograph from the left and bottom, with clear black 1px frame lines and joints. The planes should feel like actual browser layout panels, not abstract shapes. Primary red, yellow, and blue may appear only as thin moving edge tabs or small active-state marks, each doing a job: red at the before/after handle, blue at the active Looks rail, yellow at the local-file start action. Keep the rest white, pale gray, black, and photographic. Geometric lowercase sans-serif typography, calm and precise, generous asymmetric negative space, zero rounded cards and zero pill UI. Use sharp rectangular geometry, subtle 2px rules, and flat surfaces. Avoid shadows except a very light lift at one moving plane.

First viewport content: top left wordmark “openfilm” in lowercase black geometric sans; top center small status “local / no upload”; top right tiny outlined controls “undo” and “export”. On the left over a white sliding plane, use exact copy: “make it yours.” and below “a quiet photo editor for fast, film-inspired edits.” Include one clear yellow rectangular action labeled “choose a photograph” and a small text action “try the sample”. At the bottom of the large photo, show a compact real control rail with truthful labels only: “looks”, “adjust”, “crop”, “compare”, plus 3–4 tiny slider/fader indicators, an active blue edge on “looks”, and a small status “no account · no upload”. Show a small before/after label near the divider. The editor controls should be visibly functional but compact, not a generic feature grid.

Copy constraints: render these words legibly and exactly where possible: “openfilm”, “local / no upload”, “make it yours.”, “a quiet photo editor for fast, film-inspired edits.”, “choose a photograph”, “try the sample”, “looks”, “adjust”, “crop”, “compare”, “before”, “after”, “no account · no upload”. Do not invent testimonials, metrics, product claims, or extra logos. Do not use the existing OF monogram.

Style/medium: premium modern web UI screenshot, editorial product design, crisp CSS-like rendering, realistic supplied photograph, geometric lowercase sans, no gradients, no glassmorphism, no 3D render, no device frame, no browser tabs.

Constraints: the photograph must remain primary and instantly legible; show a meaningful before/after state; make the moving white/gray planes and black frame lines the compositional story; maintain excellent contrast and hierarchy; include only one primary local-file CTA; no generic rounded cards; no decorative colored stripes that do not have a job; no watermark; no hand-drawn text; no placeholder lorem ipsum.

## Generation notes

- Input image role: `/Users/darshm/Documents/4 Projects/OpenFilm/src/assets/openfilm-darkroom-hero.webp` was supplied as the OpenFilm sample photograph reference.
- Built-in `image_gen` was used; the generated PNG was converted to WebP with `cwebp` for the requested project path.
- Final generated source: `/Users/darshm/.codex/generated_images/01a02f29-1473-7701-8371-e2759fefcd38/exec-767da13d-1a58-4afa-952f-c0169a575fb3.png`.
