---
name: OpenFilm
description: A quiet darkroom for local, film-inspired photo editing.
colors:
  ink: '#1b1c18'
  ink-soft: '#4e514b'
  muted: '#6b6e67'
  paper: '#f4f3ee'
  surface: '#fbfaf6'
  surface-raised: '#efeee8'
  line: '#d4d3ca'
  line-strong: '#b8b8ad'
  accent: '#b45335'
  accent-dark: '#8e3e28'
  accent-ink: '#fff9f2'
  success: '#4f765c'
  warning: '#7d541f'
  landing-ink: '#f2eee3'
  landing-ink-soft: '#c9c2b5'
  landing-ground: '#0c0c0a'
  landing-surface: '#151512'
  landing-line: '#3b3933'
  landing-accent: '#ed6137'
  landing-action-ink: '#160d09'
  process-paper: '#e4ded1'
  process-ink: '#1d1b17'
  process-copy: '#5e594f'
  process-rule: '#989184'
  compare-ground: '#171713'
typography:
  display:
    fontFamily: 'OpenFilm Bodoni, Times New Roman, serif'
    fontSize: 'clamp(4.25rem, 7vw, 6rem)'
    fontWeight: 400
    lineHeight: 0.84
    letterSpacing: '-0.035em'
  headline:
    fontFamily: 'OpenFilm Bodoni, Times New Roman, serif'
    fontSize: 'clamp(3rem, 6vw, 6rem)'
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: '-0.035em'
  title:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    fontSize: 'clamp(1.7rem, 2.5vw, 2.8rem)'
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: '-0.03em'
  body:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    fontSize: '0.96rem'
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    fontSize: '0.72rem'
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: '0.06em'
rounded:
  sm: '0.3rem'
  md: '0.7rem'
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
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    padding: '0 {spacing.space-4}'
    height: '{spacing.touch-target}'
  button-landing-primary:
    backgroundColor: '{colors.landing-accent}'
    textColor: '{colors.landing-action-ink}'
    typography: '{typography.body}'
    rounded: '0'
    padding: '0 1.3rem'
    height: '3.25rem'
  field:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    padding: '0 {spacing.space-3}'
    height: '{spacing.touch-target}'
  brand-mark:
    backgroundColor: 'transparent'
    rounded: '{rounded.round}'
    size: '0.78rem'
  panel:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
  navigation:
    backgroundColor: '{colors.landing-ground}'
    textColor: '{colors.landing-ink}'
    padding: '0 clamp(1.25rem, 4vw, 4.5rem)'
    height: '5.5rem'
  before-after-demo:
    backgroundColor: '{colors.compare-ground}'
    size: '16 / 9'
---

# Design System: OpenFilm

## Overview

**Creative North Star: "The Quiet Darkroom"**

OpenFilm's landing world treats the product as a quiet darkroom: a photograph fills the first
viewport, warm paper gives the story somewhere to breathe, and a safe-light orange marks the
moments that open the room. The local Bodoni face gives the landing statement and section titles a
cinematic editorial voice; the sans-serif stack keeps navigation, status, and editor controls
plain and dependable. A small open circle sits beside the OpenFilm wordmark. The existing OF
monogram is not part of the identity.

The landing composition is intentionally edge-to-edge and image-led, then yields to the existing
editor's calm, light workspace. Both surfaces share a vocabulary of thin rules, restrained orange
accent, generous spacing, visible keyboard focus, and touch-sized controls. The near-black landing
palette, square landing actions, and split before-and-after composition belong to the landing
expression; they are not global rules for the editor.

**Key Characteristics:**

- Full-bleed photographic opening with a left-anchored statement and visible import actions.
- Warm paper process section, dark privacy section, and photographic closing invitation.
- Local Bodoni display type paired with a quiet sans-serif utility voice.
- Safe-light orange used sparingly for action, focus, and drop-state emphasis.
- Thin exposed rules, a simple circle mark, and a tactile before-and-after divider.
- Local processing, reversible edits, and privacy stated in plain language.

## Colors

The palette moves between photographic near-black, warm paper, and one controlled orange signal.
The shared editor tokens remain the neutral light workspace; the landing adds a darkroom-specific
set of scoped tones and a brighter action accent.

### Primary

- **Safe-light Orange:** the landing's primary action, focus, and active drop-state color.
- **Burnt Orange:** the shared editor accent for primary controls, sliders, active tabs, and
  feedback.

### Neutral

- **Darkroom Ground:** the near-black landing field behind the hero and closing image.
- **Darkroom Surface:** the near-black privacy section surface.
- **Warm Paper:** the landing display text and image-led darkroom type color.
- **Warm Paper Soft:** secondary landing copy and navigation text.
- **Process Paper:** the light process section's warm paper field.
- **Process Ink:** the process section's dark reading color.
- **Process Copy:** supporting copy on the process paper field.
- **Exposed Rule:** the process grid's quiet gray rule color.
- **Editor Paper:** the shared editor page background.
- **Editor Surface:** raised editor controls and fields.
- **Editor Ink / Editor Ink Soft / Muted:** primary, secondary, and utility text roles.
- **Editor Line / Strong Line:** one-pixel dividers and field strokes.
- **Accent Ink:** readable text placed on the shared burnt-orange accent.
- **Success / Warning:** status and recovery feedback colors.

**The Safe-Light Rule.** Keep orange rare and functional: the brighter landing accent marks actions
and drop state, while the darker shared accent carries editor controls and status.

## Typography

**Display Font:** OpenFilm Bodoni (with Times New Roman, serif fallback)
**Body Font:** ui-sans-serif (with -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif fallbacks)
**Label/Mono Font:** No separate mono face is implemented.

**Character:** The pairing contrasts a high-contrast editorial serif with a quiet, utilitarian sans.
The serif is reserved for the landing's emotional statements; the sans keeps every decision,
status, and control legible.

### Hierarchy

- **Display** (400, clamp(4.25rem, 7vw, 6rem), 0.84 line-height): the landing hero statement.
- **Headline** (400, clamp(3rem, 6vw, 6rem), 0.92 line-height): process, privacy, and closing
  landing section statements.
- **Title** (650, clamp(1.7rem, 2.5vw, 2.8rem), 1.05 line-height): editor page and canvas titles.
- **Body** (400, 0.96rem, 1.55 line-height): explanatory copy, editor context, and action labels.
  Marketing paragraphs stay around 42–43ch; editor context is kept near 34ch.
- **Label** (400, 0.72rem, 1.45 line-height, 0.06em letter spacing when uppercase): statuses,
  metadata, section labels, and small utility text.

**The Type Contrast Rule.** Set brand and landing section headlines in the local Bodoni face; keep
body copy, navigation, labels, and editor controls in the sans stack.

## Layout

The landing hero is a full-bleed photographic stage with a minimum height of `max(44rem, 100svh)`.
Its desktop navigation is a three-column row with a spare wordmark at left, two links centered, and
the sample action at right. Hero copy is left-anchored and vertically centered, while a ruled local
status line holds the bottom edge. At `900px` and below, navigation links disappear and the story
stacks; at `520px` and below, actions become full-width vertical controls and the status line keeps
only the local-processing message.

The process section uses a maximum content width of `94rem`, a two-column introduction, and a
16:9 before-and-after frame. Its six editing-group cells become a three-column, two-row grid on
phone widths, while the frame changes to a 4:5 crop. The privacy section follows a two-column
statement-and-facts layout on larger screens and stacks below `900px`. The closing invitation is a
centered image stage with a minimum height of `76vh`.

The shared editor uses a centered `1440px` maximum workspace with a flexible canvas and a
`19rem–23rem` control column. That grid collapses to one column below `900px`; the editor controls
move below the canvas with a ruled top edge. The spacing rhythm comes from the shared `0.25rem`
through `4rem` scale, with a `2.75rem` minimum interactive target.

**The Yielding Surface Rule.** Landing composition may be edge-to-edge and editorial; the editor
stays a calm max-width workspace with a dedicated control column.

## Elevation & Depth

OpenFilm is flat by default. The landing creates depth through the hero photograph, brightness and
saturation filters, dark linear veils, warm/cool tonal changes between sections, and one-pixel
rules rather than stacked cards. The shared editor similarly relies on paper/surface layering and
lines. A transient landing alert is the one deliberate lifted surface, using a diffuse dark shadow;
the editor's drop state uses an inset accent rule instead of a floating panel.

### Shadow Vocabulary

- **Landing alert:** `0 16px 40px rgba(0, 0, 0, 0.25)` for import, recovery, and renderer notices.
- **Editor drop state:** `inset 0 0 0 1px var(--color-accent)` as a structural focus cue, not a
  floating elevation.

**The Flat Darkroom Rule.** Let photography, tonal blocks, and exposed rules create depth; reserve
a shadow for transient notices and overlays.

## Shapes

The landing uses square edges and exposed borders to feel like a darkroom contact sheet: buttons,
image frames, section transitions, and footer rules do not use rounded corners. The wordmark's
aperture is a small open circle (`0.78rem`, `50%` radius), and the before-and-after handle is a
`2rem` outlined circle on a one-pixel divider.

The shared editor is softer but still restrained: small controls and fields use a `0.3rem` radius,
canvas stages use `0.7rem`, and icon buttons use a fully round `999px` shape. Borders are generally
one pixel and carry more of the structure than shadows. The landing's square geometry should not be
promoted to a global editor constraint.

## Components

### Buttons

Buttons are tactile, direct, and sized for a thumb. The shared editor uses a small radius and the
landing deliberately overrides that geometry with square actions.

- **Shape:** shared buttons use `0.3rem`; landing buttons use `0`.
- **Primary:** shared primary uses the burnt-orange accent with accent-ink text and a `2.75rem`
  minimum height; landing primary uses the brighter safe-light orange, dark action text, and a
  `3.25rem` height.
- **Hover / Focus:** shared primary darkens to the accent-dark token; landing primary shifts to a
  brighter orange. All buttons retain the shared visible `3px` accent focus outline with a `3px`
  offset.
- **Quiet / Outline:** quiet actions use transparent backgrounds and gain a surface tint on hover;
  outline actions expose the strong line and darken it on hover. Landing's quiet action is an
  underlined, border-bottom control that gains a paper tint on hover.

### Cards / Containers

There is no card grid in the landing. Full-width color fields, ruled facts, and image stages do the
structural work. Import and recovery alerts are warm-paper callouts with `1.2rem` padding and the
single landing alert shadow. In the editor, panels are flat sections separated by one-pixel lines;
fields sit on the raised surface token rather than inside floating cards.

### Inputs / Fields

Editor selects, text inputs, number inputs, and textareas use the surface token, a strong one-pixel
line, a `0.3rem` radius, and a `2.75rem` minimum height. Slider controls use the shared accent
through the native `accent-color` property. Focus is always the visible accent outline; disabled
fields move to the raised surface and muted text.

### Navigation

The landing navigation is a sparse ruled bar with the wordmark at left, centered anchor links, and
an underlined sample action at right. It loses the center links below `900px` and remains a two-item
brand/action row. The editor topbar is a light, centered flex row with a one-pixel bottom rule,
wordmark, and renderer/storage status at the edges; status hides on narrow phone widths.

### Panels and Disclosures

Editor panels and disclosure groups are flat, full-width sections. Headers use the sans title scale,
supporting descriptions use muted ink, and open/closed state is shown by a small rotating chevron.
Each summary keeps the shared touch target and visible focus treatment.

### Before-and-After Demo

The landing's signature interaction is a full-frame range-controlled comparison. A one-pixel white
divider and outlined circular handle move with the range input; `Film-inspired` and `Source` labels
stay pinned to opposite lower corners. The surrounding six-cell control strip makes the editor's
actual groups legible without turning the landing into a feature grid.

## Do's and Don'ts

### Do:

- **Do** let the photograph lead the first viewport and the comparison frame.
- **Do** use the simple open circle beside the OpenFilm wordmark; keep the name readable.
- **Do** use warm paper, near-black fields, exposed one-pixel rules, and a restrained orange signal.
- **Do** state local processing, reversible edits, and the no-account/no-upload model plainly.
- **Do** keep controls keyboard-visible and at least `2.75rem` high.
- **Do** let the landing feel editorial while preserving the editor's lighter shared control system.

### Don't:

- **Don't** use the existing OF monogram or replace the wordmark with a competing logo.
- **Don't** turn the landing's near-black composition, square actions, or 16:9/4:5 framing into a
  global editor rule.
- **Don't** introduce a feature-grid SaaS layout, card-heavy chrome, or decorative gradients over the
  photograph.
- **Don't** imply accounts, remote uploads, or unsupported product claims.
- **Don't** overwrite the source photograph; edits and exports stay reversible and local.
