---
name: OpenFilm
description: A matte, local-first photo-review workstation where the photograph stays in control.
colors:
  ink: '#f3f1ec'
  ink-soft: '#c8c3ba'
  muted: '#918c84'
  paper: '#000000'
  chrome: '#050505'
  control: '#080808'
  canvas: '#000000'
  surface: '#111111'
  surface-raised: '#181818'
  line: '#262626'
  line-strong: '#3a3a3a'
  accent: '#c6a36f'
  accent-dark: '#d5b784'
  accent-ink: '#0b0c0d'
  focus: '#e0c48f'
  update: '#2563eb'
  update-hover: '#1d4ed8'
  success: '#70d7a3'
  warning: '#f0bd69'
  warning-surface: '#171109'
  danger: '#ffb59f'
typography:
  display: 'OpenFilm Bodoni, Iowan Old Style, Times New Roman, serif'
  heading: 'Helvetica Neue, Avenir Next, Helvetica, Arial, sans-serif'
  interface: 'Helvetica Neue, Helvetica, Arial, sans-serif'
  numeric: 'tabular-nums'
rounded:
  sm: '0.4rem'
  md: '0.5rem'
  round: '999px'
spacing:
  touch-target: '2.75rem'
  page-gutter: 'clamp(1rem, 3vw, 3.25rem)'
  section-gutter: 'clamp(1rem, 5vw, 6rem)'
---

# Design system: Matte Proof Studio

OpenFilm is primarily a working surface. Near-black chrome, warm-white type, fine rules, and one
restrained sand signal frame the Source photograph. Density supports repeated review; it is never
decoration.

The download site uses the same Matte Proof Studio world at editorial scale. A real workstation
screenshot supplies product proof, full-bleed photographs control the major transitions, and the
copy stays tied to shipped behavior. The hero and final photograph may each carry a download action;
the workstation itself keeps actions compact and task-specific.

**Key Characteristics:**

- Matte near-black chrome, warm-white type, fine rules, and a restrained sand signal.
- OpenFilm Bodoni wordmark paired with Helvetica Neue headings, interface copy, and tabular numeric
  values.
- Photograph-first proof: real workstation screenshots and grounded photographic assets carry the
  visual authority.
- Compact, precise workstation controls extended to the landing page at editorial scale.
- Local-first product language with no ornamental claims, social proof, or cloud/account theatre.

## Website and download surface

The public root is the Persuade expression of Matte Proof Studio. It opens with a factual
local-first promise and a darkroom photograph, then moves through the actual workstation, the
ordered Library workflow, precise local-file architecture, and an image-led final action. Download
choices live on a separate route that recommends macOS or Windows from the visitor's operating
system without starting a download automatically.

### Surface grammar

- **Header:** OpenFilm wordmark, Workstation / Workflow / Source anchors, and compact macOS and
  Windows download links. The nav disappears below 900 CSS pixels while downloads remain available.
- **Hero:** A 12-column composition pairs the factual promise with a real workstation frame. The
  frame enters as one vertical reveal; the darkroom photograph sits behind the upper-right edge as
  atmosphere and photographic authority, never as a second panel.
- **Facts strip:** Three short, ruled statements make folders, durable Library state, and the shared
  WebGL2 rendering path legible without invented metrics.
- **Workstation proof:** One wide screenshot follows the hero. A fine-rule caption names Grid,
  Loupe, and Comparison and explains the continuity of review context.
- **Workflow:** Four ordered rows keep the shipped sequence visible: Open a Library, Review the
  Grid, Make the Edit, Export the set.
- **Local architecture:** A photograph and text pair name `.openfilm/library.json`, in-place Source
  files, and the MIT license. The copy describes local behavior precisely and makes no account,
  cloud, analytics, or backup promise.
- **Closing:** A 90svh photograph, dark veil, centered copy, and one download action provide the
  final release beat. The image remains the largest object; the CTA is simple and factual.

**The Photograph-First Rule.** Give the image the largest uninterrupted region available. Copy,
navigation, and controls frame the proof; they do not compete with it.

## Product hierarchy

The start surface does one job: create a Library, reopen a folder, or recover a recent Library. The
workstation then keeps this order stable:

1. Library identity, save state, and Export in the top bar.
2. Ordering, Selection count, history, Edit, and Grid density in the command strip. Filters and
   secondary Library actions stay in named disclosures until needed.
3. Grid, Loupe, or Comparison in the central stage.
4. Scan jobs and concise feedback at the lower edge.
5. Inspector and sheets as true overlays, with contained focus and explicit Close actions.

The photograph is always the strongest visual object. There are no promotional cards, ornamental
dashboards, testimonials, badges, repeated calls to action, or oversized slogans.

## Grid, Loupe, and Comparison

Grid uses fixed rows at three named densities. Selection is a sand inset frame; Active is a separate
semantic and keyboard state. Labels and rating/disposition marks stay legible without requiring
hover. Virtualization must not change row geometry or focus order.

Loupe places one rendered photograph against black, with compact Fit, 100%, and Source controls and a
nearby-photo strip. Comparison holds two to four panes in an adaptive matrix. Each pane names the
photograph, link state, and honest `Resolution limited · Fit` status. Shared Fit and linked focal
movement remain visible commands.

## Inspector and sheets

The Edit inspector is a ruled dock, not a floating card stack. Light, Color, Curve, Finish, Geometry,
and Looks are persistent section names. Slider and number inputs expose the same value, every change
has a nearby Reset, and numeric output uses tabular figures. Geometry and Look-copy actions remain
plain buttons with state carried by text and ARIA.

Review groups and Export use the same full-height sheet vocabulary. Destructive or irreversible
implications are stated before the action. Progress, cancellation, partial failure, and retry are
visible text, never color alone.

Desktop update notices sit above the lower-right edge without interrupting Library work. A blue
button is reserved for downloading or opening an available app update; it does not replace sand for
ordinary workstation actions. Download progress uses the same blue and includes a numeric label.

## Responsive behavior

At wide widths the command surface is compact and the stage dominates. Below 900 CSS pixels,
controls wrap without changing their reading order and overlays use most of the viewport. Below 560
pixels, labels may stack, but every action remains at least 44 CSS pixels on coarse pointers. The
interface must remain operable at 200-percent zoom without document-level horizontal scrolling.

The download surface uses a 12-column hero and split editorial sections above 1024 CSS pixels. At
1024 CSS pixels and below, a dedicated image-led view tells phone and tablet visitors that the mobile
interface is not ready and points them to the project. The macOS and Windows links remain in the
hidden desktop layout, so their platform-specific accessible names stay correct without adding
unusable download actions to the smaller-screen view.

Motion is functional and brief. A narrow film strip rolls across the hero photograph while it is in
view, pauses offscreen or in a hidden tab, and becomes static under `prefers-reduced-motion: reduce`.
The landing hero has no pointer parallax. No state depends on animation.

**The Single Reveal Rule.** The landing hero may stage one vertical workstation entrance when motion
is allowed; reduced motion removes it rather than replacing it with another effect.

## Type, color, and depth

OpenFilm Bodoni is reserved for the wordmark and compact Library heading in the workstation.
Landing, download, section, and closing headings use a tightly set Helvetica Neue with system
fallbacks. Interface copy uses the same sans-serif family at a smaller scale. Primary text is warm
white; muted gray is supporting information; sand indicates focus, Selection, direct manipulation,
and the landing download action. Green, amber, and coral are status-only.

**The One Signal Rule.** Sand is a functional signal for action, focus, Selection, and direct
manipulation, not a decorative wash; status colors remain status-only.

Depth comes from value changes and one-pixel rules. Shadows are reserved for genuine overlap. Do not
add gradients, glass effects, blur-backed panels, blobs, glow, or a second accent family.

**The Matte Layer Rule.** Separate surfaces by value before reaching for a shadow; use elevation only
when an element overlaps content or needs a clear state response.

## Content rules

Use product vocabulary from `CONTEXT.md`: Library, Source photograph, Photograph record, Active,
Selection, Look, Edit, Pick, Reject, Review group, Loupe, Comparison, and Export. Use title case only
for those domain terms. Describe local behavior precisely; never imply cloud backup, accounts,
unsupported formats, universal performance, archival fidelity, or automatic quality judgment.

Errors state the consequence and the next safe action. Empty states say which filter or Selection
caused the result. Shortcuts remain discoverable through the `?` key and the More menu.

Landing copy may state only shipped facts: local folder references, durable Library sidecars, the
supported JPEG / PNG / WebP boundary, the shared WebGL2 path, bounded download behavior, and the
GitHub Releases update check.
Do not turn the page's atmospheric photography into a claim about product performance or quality.

**The Local Fact Rule.** Every download-page claim must be traceable to the shipped workstation or
its documented release boundary; atmosphere never stands in for evidence.

## Landing component grammar

- **Download links:** Sand-filled, squared macOS and Windows links with compact download icons.
  Hover swaps to the matte ground and sand text; focus uses the shared visible focus treatment. The
  header variants remain compact and keep explicit platform-specific accessible names.
- **Proof frame:** A near-black, fine-rule frame around the real workstation screenshot. The landing
  proof crops to the upper controls and photograph row; the download route keeps the complete 16:10
  view. The small window bar and filename readout are documentary chrome only.
- **Ruled fact / workflow rows:** Use one-pixel charcoal separators, sand indices, short labels, and
  muted explanatory copy. Rows are content-first and remain readable when stacked.
- **Local architecture list:** Use a ruled definition list with tabular values for paths and license
  text. It is an evidence block, not a card or badge.
- **Photographic CTA:** Let the closing image carry the section. Add only a dark veil, centered copy,
  and the same download link used above.

## Asset provenance

Generated raster assets carry adjacent JSON provenance with prompt, creation time, and source.
Release screenshots are generated by `e2e/visualEvidence.spec.ts` from the shipped app. The token
source of truth remains `src/ui/tokens.css`.

## Do's and Don'ts

### Do:

- **Do** make a real photograph the strongest object in the landing first viewport, workstation
  proof, and final CTA.
- **Do** keep the near-black ground, warm-white type, fine rules, Bodoni wordmark, precise sans-serif
  headings, and one restrained sand interaction signal across workstation and download surfaces.
- **Do** make local behavior, Library durability, recovery, and export language plain and visible.
- **Do** preserve the landing reading order: download, proof, workflow, local architecture, final
  download.
- **Do** keep keyboard focus visible and compact download links semantically named by platform.

### Don't:

- **Don't** use gradients, glass effects, blur-backed panels, ornamental dashboards, fake metrics,
  testimonials, account or cloud claims, or a second accent family.
- **Don't** replace the OpenFilm wordmark with the old `OF` monogram or redesign the workstation as
  marketing UI.
- **Don't** imply archival fidelity, universal performance, automatic quality judgment, or Source
  backup beyond the recorded product behavior.
- **Don't** turn every landing section into a rounded card or place a wide shadow beneath a rule by
  default.
