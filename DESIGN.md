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
  success: '#70d7a3'
  warning: '#f0bd69'
  warning-surface: '#171109'
  danger: '#ffb59f'
typography:
  display: 'Archivo, Helvetica Neue, Helvetica, Arial, sans-serif'
  heading: 'Archivo, Helvetica Neue, Helvetica, Arial, sans-serif'
  interface: 'Helvetica Neue, Helvetica, Arial, sans-serif'
  numeric: 'tabular-nums'
rounded:
  sm: '0.625rem'
  md: '0.875rem'
  lg: '1rem'
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

The landing page uses the same Matte Proof Studio world at editorial scale. A real workstation
screenshot supplies product proof, full-bleed photographs control the major transitions, and the
copy stays tied to shipped behavior. The hero and final photograph may each open the browser
workstation; the workstation itself keeps actions compact and task-specific.

**Key Characteristics:**

- Matte near-black chrome, warm-white type, fine rules, and a restrained sand signal.
- A compact Archivo wordmark and heading voice paired with Helvetica Neue interface copy and tabular
  numeric values.
- Photograph-first proof: real workstation screenshots and grounded photographic assets carry the
  visual authority.
- Compact, precise workstation controls extended to the landing page at editorial scale.
- Local-first product language with no ornamental claims, social proof, or cloud/account theatre.

## Website surface

The public root is the Persuade expression of Matte Proof Studio. It opens with a factual
local-first promise and a darkroom photograph, then moves through the actual workstation, the
ordered Library workflow, precise local-file architecture, and an image-led final action. Desktop
calls to action open the browser workstation at `app.html`; mobile viewports state that the
workstation is coming soon.

### Surface grammar

- **Header:** OpenFilm wordmark, Workstation / Workflow / Source anchors, and one compact browser
  launch link. The nav disappears below 900 CSS pixels; mobile viewports show a Coming soon status.
- **Hero:** A 12-column composition pairs the factual promise with a real workstation frame. The
  frame enters as one vertical reveal; the darkroom photograph sits behind the upper-right edge as
  atmosphere and photographic authority, never as a second panel.
- **Workflow:** Four ordered rows keep the shipped sequence visible: Open a Library, Review the
  Grid, Make the Edit, Export the set.
- **Local architecture:** A concise copy block and ruled evidence list name `.openfilm/library.json`
  and in-place Source files. The copy describes local behavior precisely and makes no account,
  cloud, analytics, or backup promise.
- **Closing:** A 90svh photograph, dark veil, centered copy, and one browser launch action provide
  the final beat. The image remains the largest object; the CTA is simple and factual.

**The Photograph-First Rule.** Give the image the largest uninterrupted region available. Copy,
navigation, and controls frame the proof; they do not compete with it.

## Product hierarchy

The start surface does one job: create a Library, reopen a folder, recover a recent Library, or
import a Library backup. Browsers without writable folder access name Browser Library persistence
and folder reselection before the photographer begins. The workstation then keeps this order stable:

1. Library identity, Grid / Loupe modes, save state, Export, and the Library menu in the top bar.
2. Active photograph identity with Pick, Reject, Rating, and Add to Selection in the review rail.
3. Edit, Comparison, Filters, and Selection management in a contextual Tools disclosure; active scan
   progress remains visible while background work is running.
4. Grid, Loupe, or Comparison in the central stage.
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

## Responsive behavior

At wide widths the command surface is compact and the stage dominates. Below 900 CSS pixels,
controls wrap without changing their reading order and overlays use most of the viewport. Below 560
pixels, labels may stack, but every action remains at least 44 CSS pixels on coarse pointers. The
interface must remain operable at 200-percent zoom without document-level horizontal scrolling.

The landing surface uses a 12-column hero and ruled editorial sections at desktop widths. Below 900
CSS pixels it stacks into one column. At phone widths, browser launch actions become a Coming soon
status while the product story remains readable.

Motion is functional and brief. A narrow film strip rolls across the hero photograph while it is in
view, pauses offscreen or in a hidden tab, and becomes static under `prefers-reduced-motion: reduce`.
The landing hero has no pointer parallax. No state depends on animation.

**The Single Reveal Rule.** The landing hero may stage one vertical workstation entrance when motion
is allowed; reduced motion removes it rather than replacing it with another effect.

## Type, color, and depth

Self-hosted Archivo carries the OpenFilm wordmark, landing headings, and compact Library headings in
the workstation. Interface copy uses Helvetica Neue at a smaller scale. Primary text is warm white;
muted gray is supporting information; sand indicates focus, Selection, direct manipulation, and the
landing launch action. Green, amber, and coral are status-only.

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
caused the result. Shortcuts remain discoverable through the `?` key and the Menu disclosure.

Landing copy may state only shipped facts: local folder references, durable Library sidecars,
Browser Library persistence, the supported JPEG / PNG / WebP boundary, the shared WebGL2 path,
bounded Export fallback, and the browser capability boundary.
Do not turn the page's atmospheric photography into a claim about product performance or quality.

**The Local Fact Rule.** Every landing-page claim must be traceable to the shipped workstation or
its documented browser boundary; atmosphere never stands in for evidence.

## Landing component grammar

- **Launch links:** Sand-filled browser links use gently rounded corners and compact arrow icons.
  Hover swaps to the matte ground and sand text; focus uses the shared visible focus treatment.
  Mobile replaces these links with a non-interactive Coming soon status.
- **Proof frame:** A near-black, fine-rule frame around the real workstation screenshot. Landing
  proofs crop to the upper controls and photograph row. The small window bar and filename readout
  are documentary chrome only.
- **Ruled fact / workflow rows:** Use one-pixel charcoal separators, sand indices, short labels, and
  muted explanatory copy. Rows are content-first and remain readable when stacked.
- **Local architecture list:** Use a ruled definition list with tabular values for paths and license
  text. It is an evidence block, not a card or badge.
- **Photographic CTA:** Let the closing image carry the section. Add only a dark veil, centered copy,
  and the same browser launch link used above.

## Asset provenance

Generated raster assets carry adjacent JSON provenance with prompt, creation time, and source.
Release screenshots are generated by `e2e/visualEvidence.spec.ts` from the shipped app. The token
source of truth remains `src/ui/tokens.css`.

## Do's and Don'ts

### Do:

- **Do** make a real photograph the strongest object in the landing first viewport, workstation
  proof, and final CTA.
- **Do** keep the near-black ground, warm-white type, fine rules, compact Archivo wordmark and
  headings, and one restrained sand interaction signal across workstation and landing surfaces.
- **Do** make local behavior, Library durability, Browser Library limits, recovery, and Export
  language plain and visible.
- **Do** preserve the landing reading order: launch, proof, workflow, local architecture, final
  launch.
- **Do** keep keyboard focus visible and browser launch links explicitly named.

### Don't:

- **Don't** use gradients, glass effects, blur-backed panels, ornamental dashboards, fake metrics,
  testimonials, account or cloud claims, or a second accent family.
- **Don't** replace the OpenFilm wordmark with the old `OF` monogram or redesign the workstation as
  marketing UI.
- **Don't** imply archival fidelity, universal performance, automatic quality judgment, or Source
  backup beyond the recorded product behavior.
- **Don't** turn every landing section into a rounded card or place a wide shadow beneath a rule by
  default.
