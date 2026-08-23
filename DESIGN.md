---
name: OpenFilm
description: A matte, local-first photo editor where the photograph stays in control.
colors:
  ink: '#f3f1ec'
  ink-soft: '#c8c3ba'
  muted: '#918c84'
  paper: '#090a0b'
  chrome: '#0b0c0d'
  control: '#0d0e0f'
  surface: '#131415'
  surface-raised: '#1a1b1c'
  canvas: '#050606'
  line: '#292928'
  line-strong: '#3d3b38'
  accent: '#c6a36f'
  accent-dark: '#d5b784'
  accent-ink: '#0b0c0d'
  success: '#70d7a3'
  warning: '#f0bd69'
typography:
  display:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    fontSize: 'clamp(2.65rem, 4.7vw, 5.6rem)'
    fontWeight: 700
    lineHeight: 0.94
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
    backgroundColor: '{colors.ink}'
    textColor: '{colors.accent-ink}'
    rounded: '{rounded.sm}'
    height: '{spacing.touch-target}'
  button-quiet:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    height: '{spacing.touch-target}'
  button-outline:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    height: '{spacing.touch-target}'
  field:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    height: '{spacing.touch-target}'
---

# Design System: OpenFilm

## Overview

**Creative North Star: The Matte Proof Studio**

OpenFilm is a quiet working surface, not a marketing template. Near-black chrome, warm-white type,
fine separators, and one restrained sand-colored signal frame the photograph. The landing page lets someone
start immediately, then provides only the workflow and local-processing facts worth scrolling for.
The editor keeps the image dominant and the controls compact.

The current direction supersedes the earlier generated category-standard comp. That comp pushed the
page toward familiar AI-SaaS staging: an oversized promise, repeated feature blocks, ornamental
imagery, and several competing calls to action. The implemented surface deliberately removes those
patterns. The supplied three-phone editor image is a visual reference for mobile topology only: a
compact utility bar, large photograph, and persistent bottom tool dock.

### Core rules

- The photograph is the strongest object in every state.
- Warm white carries primary actions. Sand is reserved for selection, focus, and direct manipulation.
- Local processing is stated plainly; no account, cloud, or unsupported privacy claims are implied.
- Every control is labeled, keyboard reachable, and at least `2.75rem` on coarse pointers.
- Depth comes from value and one-pixel rules. Shadows are reserved for true overlap.

## Landing page

The first viewport contains a slim wordmark bar, the direct heading “Open a photograph.”, one factual
sentence, one neutral “Choose a photo” action, a quiet sample action, supported formats,
and the real before/after comparison. The import action uses the standards-based file input; mobile
operating systems decide whether to present Photos, Files, or another valid source. Accepted formats
are JPEG, PNG, and WebP.

Below the comparison are two restrained regions:

1. A linear three-step workflow: choose, adjust, export.
2. A local-processing fact section covering browser-only editing, reversible edits, and fresh-file
   export.

There is no feature-card wall, lifestyle-image collage, giant closing slogan, testimonial, pricing
block, or repeated call to action.

## Editor layout

### Desktop — above 1000px

The editor fills `100dvh`. A compact top bar carries the wordmark, help, and Export. The photograph
occupies the remaining canvas while a flat `22rem` rail is docked to the right edge. Adjust,
Geometry, and Looks remain persistent. The rail owns edit history, histogram, active controls,
export settings, and the source/status footer. Its middle area scrolls independently.

### Tablet — 721px to 1000px

The canvas and control rail stack. The rail becomes document-height content below the image so the
full tool set remains available without a cramped split.

### Phone — 720px and below

The editor is a single `100dvh` workspace with safe-area padding. The compact utility bar remains at
the top, the photograph fills the upper region, and the lower `40dvh` becomes a persistent bottom
dock. Adjust, Geometry, and Looks stay visible at the top of that dock. Tool content scrolls inside
the dock; status and “Replace photo” stay anchored at the bottom. The before/current control
remains on the photograph. Short landscape viewports fall back to document scrolling so no control
is trapped offscreen.

## Controls

Adjustment rows show one visible numeric value: the editable number input. The slider announces its
formatted value through `aria-valuetext` but does not repeat it visually. Each row has a compact,
accessible reset icon; adjustment-group and global resets remain available. Numeric values use
tabular figures. Sliders use a thin neutral track, one sand-colored thumb, and an explicit focus ring.

Looks are a choice first and file management second. Each starting or saved Look has one visible
Apply action. Rename, duplicate, delete, save, and preset export sit behind a labeled More disclosure.
Preset-file transfer has its own disclosure. This keeps the common path readable without removing
power-user actions.

Fields and buttons use the small `0.5rem` radius. Selected tools use an underline rather than a pill.
Panels are full-width ruled sections, not floating cards. Histogram, crop handles, tone-curve points,
history, recovery, and export retain their existing semantics and behavior.

## Type and color

Use the neutral system sans stack throughout. Landing display type is bold but bounded; section and
editor headings remain compact. Supporting copy is cool gray and short. The token source of truth is
`src/ui/tokens.css`.

- Ground: `#090a0b`
- Chrome: `#0b0c0d`
- Control plane: `#0d0e0f`
- Canvas: `#050606`
- Foreground: `#f3f1ec`
- Muted foreground: `#918c84`
- Separator: `#292928`
- Interaction cue: `#c6a36f`
- Focus: `#e0c48f`
- Success and warning colors are status-only.

## Do / do not

Do keep start, active tool, image comparison, and export immediately findable. Do preserve visible
focus, reduced-motion behavior, safe areas, internal dock scrolling, and clear error/recovery copy.
Do let the source photograph keep its native aspect ratio rather than cropping it for decoration.

Do not add glassmorphism, gradients, blobs, generic equal-card grids, promotional badges, fake social
proof, decorative dashboards, repeated slogans, or a second accent family. Do not imply HEIC support,
remote upload, source backup, accounts, or analytics. Do not hide primary actions behind gestures.
