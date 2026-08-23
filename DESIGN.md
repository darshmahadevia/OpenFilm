---
name: OpenFilm
description: A matte, local-first photo editor where the image stays in control.
colors:
  ink: '#f2f4f7'
  ink-soft: '#bdc3cf'
  muted: '#8b93a1'
  paper: '#0b0e14'
  chrome: '#0c1015'
  control: '#0d1116'
  surface: '#12161d'
  surface-raised: '#191e27'
  canvas: '#070a0f'
  line: '#252b35'
  line-strong: '#39414e'
  accent: '#5358ed'
  accent-dark: '#686df4'
  accent-ink: '#ffffff'
  success: '#70d7a3'
  warning: '#f0bd69'
typography:
  display:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    fontSize: 'clamp(3.25rem, 3.8vw, 3.5rem)'
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: '-0.04em'
  title:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    fontSize: 'clamp(1.7rem, 2.5vw, 2.8rem)'
    fontWeight: 650
    lineHeight: 1
    letterSpacing: '-0.03em'
  body:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    fontSize: '0.96rem'
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    fontSize: '0.72rem'
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: '0.06em'
rounded:
  sm: '0.5rem'
  md: '0.8rem'
  round: '999px'
spacing:
  space-1: '0.25rem'
  space-2: '0.5rem'
  space-3: '0.75rem'
  space-4: '1rem'
  space-5: '1.25rem'
  space-6: '1.5rem'
  space-8: '2rem'
  space-10: '2.5rem'
  space-12: '3rem'
  space-16: '4rem'
  touch-target: '2.75rem'
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.accent-ink}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    padding: '0 {spacing.space-4}'
    height: '{spacing.touch-target}'
  button-primary-hover:
    backgroundColor: '{colors.accent-dark}'
    textColor: '{colors.accent-ink}'
    rounded: '{rounded.sm}'
  button-quiet:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    padding: '0 {spacing.space-4}'
    height: '{spacing.touch-target}'
  button-outline:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    padding: '0 {spacing.space-4}'
    height: '{spacing.touch-target}'
  field:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    padding: '0 {spacing.space-3}'
    height: '{spacing.touch-target}'
  navigation:
    backgroundColor: '{colors.chrome}'
    textColor: '{colors.ink}'
    height: '4.25rem'
  tool-tab-active:
    backgroundColor: '{colors.control}'
    textColor: '{colors.ink}'
    height: '{spacing.touch-target}'
---

# Design System: OpenFilm

## Overview

**Creative North Star: "The Matte Proof Studio"**

OpenFilm is a quiet, professional photo workspace where the photograph does the convincing. The
surface is matte near-black chrome with charcoal planes, off-white type, cool gray supporting copy,
and one violet-blue signal for action and focus. The product language is familiar at the craft level
of Darkroom, VSCO Web Studio, and Lightroom: image-led staging, legible controls, and enough density
to make the workflow feel real without making it feel like a pro-suite exam.

The landing first viewport is a compact promise beside a live before/after proof. After import, the
same world resolves into a large canvas and a narrow tool rail for Adjust, Geometry, and Looks.
Supporting process and privacy sections may change value for reading contrast, but the system does
not need ornamental brand theatre or a feature-card wall. The image, the active tool, and the export
path remain the primary objects.

**Provenance:** This scan records the shipped category-standard standing exit, comp option two,
concept seed `d0d9cfa6`, approved in `.impeccable/mocks/category-standard-split.webp` with its
sidecar `.impeccable/mocks/category-standard-split.webp.json`, and captured again in
`.impeccable/review/hero-repro.png`, `editor-desktop.png`, and `editor-mobile.png`. Final reviewer
disposition: ship.

**Key Characteristics:**

- Matte near-black ground with charcoal chrome and quiet value-based depth.
- One violet-blue action color used for primary actions, selected tabs, sliders, focus, and drop state.
- Neutral sans typography throughout, with compact labels and tabular numeric values.
- The photograph is the product proof: the first viewport is image-led and the editor canvas stays dominant.
- Compact, precision-oriented controls organized as a three-tool editor rail.
- No ornamental story grid, glassmorphism, invented claims, or competing identity mark.

## Colors

The palette is a cool, low-chroma dark workspace with a clean foreground and one deliberately scarce
violet-blue signal. The global tokens in `src/ui/tokens.css` are the source of truth; the `chrome` and
`control` values name the repeated matte planes used by the final landing and editor overrides.

### Primary

- **Violet-Blue Action** (`#5358ed`): the primary button, active tool underline, slider track,
  crop/tone-curve affordances, keyboard focus, and active drop state.
- **Violet-Blue Hover** (`#686df4`): the brighter hover state for primary actions and the active
  control signal when interaction needs a little more lift.
- **Violet-Blue Focus** (`#8589ff`): keyboard focus rings and the smallest active control points,
  where the darker action value does not clear the surrounding chrome.

### Neutral

- **Near-Black Ground** (`#0b0e14`): the page, landing, and editor chrome ground.
- **Top Chrome** (`#0c1015`): the top bar, comparison readout, and persistent status strip.
- **Control Plane** (`#0d1116`): the landing control strip and floating editor inspector.
- **Raised Surface** (`#191e27`): hover and disabled control states, never a decorative card fill.
- **Editor Surface** (`#12161d`): fields, panels, disclosures, histogram, and dialog surfaces.
- **Canvas Black** (`#070a0f`): the image stage behind a loaded photograph or empty canvas.
- **Foreground** (`#f2f4f7`): primary headings, wordmark, active controls, and readable values.
- **Foreground Soft** (`#bdc3cf`): supporting copy and secondary controls.
- **Muted Gray** (`#8b93a1`): metadata, helper text, inactive tabs, and quiet status labels.
- **Charcoal Line** (`#252b35`): the default one-pixel separator and panel rule.
- **Strong Line** (`#39414e`): field borders and controls that need a clearer edge.
- **Action Ink** (`#ffffff`): text and icons on the violet-blue action.

### Tertiary

- **Success Green** (`#70d7a3`): renderer-ready and successful import/export status only.
- **Warning Gold** (`#f0bd69`): storage, renderer, and export warnings only.

**The One Signal Rule.** Violet-blue is a functional signal, not a decorative brand wash. Keep it
to action, selection, focus, progress, and recovery states; do not introduce a second accent family.

## Typography

**Display Font:** ui-sans-serif (with `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif
fallbacks)
**Body Font:** the same neutral sans stack
**Label/Mono Font:** no separate mono face; numeric values use tabular numerals.

**Character:** The type is plain, compact, and confident. A strong sans headline gives the landing
promise enough weight, while the same family keeps tool names, helper text, statuses, and values
visibly related.

### Hierarchy

- **Display** (700, `clamp(3.25rem, 3.8vw, 3.5rem)`, `0.98` line-height): the compact landing
  promise; the mobile override grows from `3.1rem` to `4.25rem` across narrow widths.
- **Title** (650, `clamp(1.7rem, 2.5vw, 2.8rem)`, `1` line-height): editor heading, panel titles,
  and section-level tool headings.
- **Body** (400, `0.96rem`, `1.55` line-height): product explanation, helper copy, and editor
  context; keep prose short and close to the control it explains.
- **Label** (600, `0.72rem`, `1.45` line-height, `0.06em` when tracking is needed): navigation,
  tool tabs, field labels, status, metadata, and comparison readouts.
- **Value** (400–650, `0.72rem`–`0.84rem`): adjustment values and export estimates use
  `font-variant-numeric: tabular-nums` so columns do not jump while a control moves.

**The Neutral Sans Rule.** Do not reintroduce a display serif, novelty face, or stylistic wordmark;
the product should read as a familiar creative tool before it reads as a branded editorial page.

## Layout

The landing hero is a full viewport (`100svh`) with a slim `4.25rem` top bar. Its upper field pairs
an oversized two-line promise with one compact action column. The real before-and-after photograph
then spans the full viewport width, with its readout and six-cell control strip embedded at the image
edges. This keeps the first screen black, direct, and photograph-led while still making Crop, Looks,
and the editing vocabulary visible. The bottom status strip carries local-device and drop-state
messaging.

The editor is a full-height canvas with a `22rem` inspector floating one rem from the right and
bottom edges. The inspector owns the tool switcher, edit history, histogram, active controls, Export,
and source actions, so no secondary panels interrupt the photograph. The canvas reserves enough
room for the inspector rather than allowing it to obscure the image. At `1000px` and below the
inspector becomes a rounded top-edge workspace below the canvas. At `640px` and below the landing
nav links disappear, actions become full-width, the comparison controls scroll horizontally, and
editor padding tightens to `0.75rem`.

The spacing rhythm is the quarter-rem scale from `0.25rem` through `4rem`; interactive controls
reserve a `2.75rem` minimum target. The supporting landing process is a linear ruled list with one
image proof and a separate privacy region, not a repeated equal-card layout. The current process
field uses a light contrast surface as a reading break; it is scoped to that section and does not
change the operating workspace's matte dark identity.

**The Photograph-First Rule.** Give the image the largest uninterrupted region available. Copy,
navigation, and controls frame the proof; they do not compete with it.

## Elevation & Depth

The system is flat at rest. Depth comes from near-black, charcoal, and raised-surface value steps,
one-pixel rules, the photograph's tonal range, and a restrained comparison handle. Shadows are small
state cues: the violet-blue primary action gets a low-opacity glow, the divider handle and transient
alerts lift slightly, and dialogs receive the only deep overlay shadow. There is no glass, blur-heavy
chrome, or shadow stack under every panel.

### Shadow Vocabulary

- **Primary action:** `0 10px 26px rgba(39, 42, 172, 0.24)` in the editor and
  `0 12px 30px rgba(39, 42, 172, 0.28)` in the landing; hover increases the spread modestly.
- **Comparison handle:** `0 8px 24px rgba(0, 0, 0, 0.34)` so the divider remains readable over a
  changing photograph.
- **Transient alert:** `0 16px 40px rgba(0, 0, 0, 0.24)` for import/recovery notices.
- **Dialog:** `0 26px 80px rgba(0, 0, 0, 0.5)` for a modal layer over the workspace.

**The Matte Layer Rule.** Separate surfaces by value before reaching for a shadow; use elevation only
when an element overlaps content or needs a clear state response.

## Shapes

The form language is restrained and tool-like. Small controls, fields, tabs, and buttons use the
`0.5rem` (`8px`) radius; major canvas and dialog surfaces use `0.8rem` (`12.8px`); icon buttons
and status dots use the `999px` round token. Photo stages may be cropped and clipped, but they do not
carry ornamental frames. One-pixel lines carry the structure, while selected tabs use a violet-blue
bottom rule instead of a pill.

The landing hero keeps its large planes square and quiet, with only the comparison handle and small
labels adding a visible silhouette. The editor's crop handles and tone-curve points are round for
affordance and touch clarity, not as a general rounded-container motif.

## Components

### Buttons

Buttons are compact, direct, and usable with a thumb. They should feel like controls in a working
tool, not promotional badges.

- **Shape:** `0.5rem` (`8px`) radius, transparent one-pixel border, and a `2.75rem` minimum height;
  landing primary actions use a slightly taller `3rem` target.
- **Primary:** violet-blue background with white text and horizontal `1rem` padding. Hover shifts
  to the brighter violet-blue and adds a restrained glow; disabled moves to the raised surface and
  muted text.
- **Hover / Focus:** state transitions use the `120ms` fast motion token. Every button keeps a
  visible `3px` violet-blue focus outline with a `3px` offset.
- **Quiet:** transparent at rest, foreground text, and a raised-surface tint on hover.
- **Outline:** editor-surface background with the strong charcoal line; hover lightens the edge.

### Cards / Containers

There is no canonical card grid. The landing uses full-width planes, a photograph stage, a ruled
linear process list, and a privacy fact table. Editor panels and disclosures are flat sections divided
by one-pixel lines; a dialog is the only intentionally lifted container.

- **Background:** use `paper`/ground for the workspace, `chrome` and `control` for tool chrome,
  `surface` for fields and panels, and `surface-raised` for hover/disabled states.
- **Border:** default to `line`; use `line-strong` only where an input or stage needs a firm edge.
- **Internal padding:** use the spacing scale, usually `1rem–2rem` for controls and `2rem` for
  the canvas/editor shell.

### Inputs / Fields

Selects, text inputs, number inputs, and textareas use the editor surface, a one-pixel strong line,
the small radius, and the `2.75rem` touch target. Sliders use the violet-blue `accent-color`; their
numeric value sits beside the label and uses tabular numerals. Disabled fields move to the raised
surface and muted copy. Focus is always explicit: a `3px` outline with a small offset, never a
bare color change.

### Navigation

Landing navigation is a sparse matte bar: OpenFilm at left, process/privacy links centered, and a
sample action at right. The editor top bar keeps the wordmark, privacy/storage/renderer status,
help, and Export visible while the canvas and floating inspector sit beneath it. Links and actions use
quiet foreground states; only the active action or focus state spends violet-blue. At `640px` the
landing center links and nonessential editor statuses hide to preserve the primary action.

### Panels and Disclosures

Panels and disclosure groups are full-width, ruled sections. Titles use the title scale, descriptions
use `ink-soft` or `muted`, and the open/closed state is a small rotating chevron. Summaries keep the
shared `2.75rem` target and visible focus outline. Export stays in the same rail rather than moving
into a second floating card. The inspector is the single floating control plane on desktop.

### Before-and-After Proof

This is OpenFilm's signature surface. A real local photograph fills the stage; a semantic range input
drives the clipped edited image, a one-pixel divider, and an outlined circular handle. Before/After
labels sit on the image, while the readout and bottom control strip expose real Crop and Looks
vocabulary. The editor reuses the same comparison idea in the canvas, so the first proof and the
working tool feel like one product.

## Do's and Don'ts

### Do:

- **Do** make a real photograph the strongest object in the first viewport and editor canvas.
- **Do** use the near-black ground, charcoal planes, off-white type, cool gray copy, and one
  violet-blue action signal.
- **Do** keep controls compact, labeled, keyboard-visible, and at least `2.75rem` high.
- **Do** use one-pixel separators, tonal layering, and restrained state shadows to make hierarchy.
- **Do** keep local processing, reversible edits, recovery, and export language plain and visible.
- **Do** preserve the responsive order: image and primary action first, tool rail below at narrow widths.

### Don't:

- **Don't** use the old warm-paper/orange/editorial-serif direction or the existing OF monogram.
- **Don't** add an ornamental story grid, generic three-card SaaS layout, glassmorphism, or a
  collection of competing accent colors.
- **Don't** use generated photo content, fictional preset names, testimonials, pricing, or claims
  that are not present in the product; preserve the approved comp's topology, not its fiction.
- **Don't** imply accounts, remote uploads, analytics, or a server-side source backup.
- **Don't** bury the primary choose-photo or export action behind decorative interaction.
- **Don't** turn every surface into a rounded card or put a wide shadow beneath a border by default.
