---
version: 1
slug: 'src-app-tsx'
primary_target: 'src/App.tsx'
related_targets: ['index.html', 'src/app.css', 'src/ui/tokens.css']
---

## Scope and mode

Production landing and editor shell in `App.tsx`. Persuade a casual photographer to start, then carry the same visual system into the operating workspace.

## Audience, job, action, proof, constraints

Casual photographers choosing whether to open one local image. The primary action is choosing a photograph; the sample is secondary. Proof is the interactive before/after, visible real Crop and Looks controls, and plain local-processing status. No accounts, uploads, invented claims, analytics, or destructive source changes. Desktop and phone layouts must keep the photograph, primary action, active tool, and export path findable.

## Chosen direction and memorable moment

User-selected category standard executed against Darkroom, VSCO Web Studio, and Lightroom. Approved comp: `.impeccable/mocks/category-standard-split.webp`. A matte dark creative-tool shell uses one violet-blue action color. The first viewport is a 34/66 promise-to-photograph split; dragging the before/after divider is the memorable moment, and the same surface resolves into the full editor after import.

## Approved comp record

- Ground: sampled `#0b0e14`; dominant control surface: sampled `#0d1116`; top chrome: sampled `#0c1015`.
- Action: sampled `#5358ed`; foreground: off-white; secondary copy: cool gray; separators: charcoal near `#1c2023`.
- Corners: 8px controls, 12–14px major surfaces; 1px separators; no border beneath a wide shadow.
- Elevation: matte layers differentiated mostly by value; only overlapping panels receive a soft low-opacity shadow.
- Type ramp: 50–58px landing display, 24–30px section headings, 16–18px body, 12–14px tool labels. Neutral sans throughout with tabular numerals for values.
- What not to literalize: generated photo content, exact crop thumbnails, or fictional preset names. Preserve the topology, scale, density, and control clarity with real OpenFilm content.

## Implementation inventory

| Ingredient        | Commitment                                                                                                | Medium                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Slim top bar      | Wordmark, process/privacy links, sample action; matte chrome and hairline separator                       | Semantic HTML/CSS                                   |
| Promise panel     | Compact headline, one sentence, local-processing proof, primary and secondary actions                     | Semantic HTML/CSS + authored SVG icons              |
| Hero proof        | Large edge-to-edge interactive before/after using the existing street photograph                          | Existing raster + semantic range input/CSS clipping |
| Tool preview      | Crop and Looks controls enter at the fold with practical labels and selected state                        | Semantic HTML/CSS + authored SVG icons              |
| Primary action    | Violet-blue rectangular button, 8px corners, visible focus and loading state                              | Semantic button                                     |
| Remaining landing | One product walkthrough, one privacy proof region, one anchored close; varied density, no equal-card grid | Semantic HTML/CSS + existing rasters                |
| Editor shell      | Sticky top bar, large central canvas, compact right tool rail, persistent comparison and export paths     | Existing React behavior + CSS                       |
| Motion            | One orchestrated hero-to-editor reveal and responsive divider movement; reduced-motion fallback           | CSS transitions/animation                           |

## Unresolved decisions

None. The user delegated the comp choice and approved the best-default implementation path.
