---
version: 2
slug: 'src-app-tsx'
primary_target: 'src/App.tsx'
related_targets: ['index.html', 'src/app.css', 'src/ui/components/Slider.tsx', 'src/ui/tokens.css']
---

## Scope and mode

Production landing page and responsive editor shell. Refined from the earlier category-standard
concept to remove AI-SaaS visual tells while keeping the proven dark creative-tool vocabulary.

## Audience, job, action, proof, constraints

The audience is a casual photographer deciding whether to open one local image. The primary action
is choosing a photograph; the sample is secondary. Proof is the real interactive before/after and
the functioning editor. Processing stays in the browser. No accounts, uploads, analytics, invented
claims, HEIC support, or destructive source changes.

## Current direction

The first viewport is direct: compact heading and actions followed by one large comparison image.
Below it, a linear workflow and a local-processing fact section provide enough explanation for
someone who scrolls. There is no feature-card grid, decorative image sequence, or closing CTA repeat.

The editor uses a flat right rail on desktop, a stacked tablet layout, and a mobile `100dvh` image
workspace with a persistent bottom tool dock. The supplied three-phone image defines mobile topology,
not literal styling or content. On phones, Adjust, Geometry, and Looks remain visible while active
controls scroll internally above a persistent status/source footer.

## Implementation commitments

| Ingredient         | Commitment                                                                       |
| ------------------ | -------------------------------------------------------------------------------- |
| Import             | One “Choose a photo” input; the supporting line names Photos, Files, and formats |
| Hero proof         | Greenhouse portrait comparison, dominant and edge-to-edge                        |
| Supporting content | One ruled workflow and one local-processing fact section                         |
| Editor chrome      | Compact top bar with wordmark, filename on phone, help, and Export               |
| Desktop controls   | Flat `22rem` right rail with one internally scrolling content area               |
| Mobile controls    | Safe-area-aware bottom dock around `40dvh`, persistent tabs and footer           |
| Slider values      | One visible editable number; formatted `aria-valuetext`; compact row reset       |
| Accessibility      | `2.75rem` coarse-pointer targets, visible focus, keyboard tools, reduced motion  |

## Review decisions

- Removed the oversized slogan, six-cell pseudo-feature strip, extra lifestyle image, coastal close,
  repeated actions, and ornamental status chrome.
- Replaced the broad violet-blue treatment with warm-white actions and a sparse sand interaction cue.
- Replaced the abstract bundled sample with a natural greenhouse portrait in landscape and square crops.
- Reduced Looks to one visible Apply action per row; file and management actions use disclosures.
- Preserved image aspect ratio, all editor tools, recovery, local status, help, and export behavior.
- Native Photos versus Files presentation is owned by the mobile operating system; the web input
  cannot truthfully force two separate native picker modes.

## Unresolved decisions

None. Native picker wording and available providers vary by device and browser and require physical
iOS/Android verification outside automated browser emulation.
