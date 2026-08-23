# OpenFilm

OpenFilm is a quiet, browser-based photo editor for reusable film-inspired Looks. It processes
photographs locally and is designed to deploy as static files without accounts, a backend, or paid
services.

The current application is a canvas-first editor workspace with one active control area, local UI
primitives, source-photograph import, and a single WebGL2 preview path. It validates JPEG, PNG, and
WebP files selected by picker or drag and drop, prepares a bounded preview texture, sends the six
core Adjustments, vignette, grain, and one RGB tone curve through the fragment shader, and exports
the visible result as JPEG, PNG, or WebP. Lossy exports have a quality control, and every export
reports its estimated dimensions before download. Each scalar control has a slider and a numeric
field. The tone curve
has a bounded plot, ordered points, pointer dragging, arrow-key movement, and numeric input.
Individual resets, vignette and grain group resets, the all-adjustments reset, undo, and redo use
the shared Edit history. One history covers Adjustments, curve changes, and geometry. It keeps the
latest 50 committed changes, and a slider or drag gesture commits one entry when it ends. A bundled
sample photograph lets someone try the controls without choosing a file. The Geometry tool provides
a free or common-ratio crop, normalized crop fields, 90-degree rotation, horizontal and vertical
flips, and the same WebGL2 transform for preview and every export format. Geometry stays in the Edit rather
than a reusable Look. The canvas offers a persistent before-and-after toggle and a deferred
luminance histogram so histogram sampling does not run on every control event. The Looks tool
includes seven bundled starting points and lets users save, rename, apply, duplicate, and delete
custom Looks. IndexedDB stores custom Looks and the latest recoverable Edit, including source bytes
when the browser permits it. Replacing a changed Edit asks for confirmation before returning its
adjustment and geometry state to neutral.
The Looks tool exports one Look as a readable, versioned JSON preset and previews imported presets
before applying them or saving a custom copy. Presets contain the Look title, optional description,
and supported adjustment values only.

## Core adjustments

The Adjust tool uses these ranges. The amount controls are neutral at zero. Vignette softness and
grain size use neutral midpoint values because their corresponding amounts default to zero; Fade
also starts at its neutral value of zero.

| Adjustment        | Range          | Neutral |
| ----------------- | -------------- | ------- |
| Exposure          | -4 to +4 stops | 0       |
| Contrast          | -100 to +100   | 0       |
| Temperature       | -100 to +100   | 0       |
| Tint              | -100 to +100   | 0       |
| Saturation        | -100 to +100   | 0       |
| Fade              | 0 to 100       | 0       |
| Vignette amount   | 0 to 100       | 0       |
| Vignette softness | 0 to 100       | 50      |
| Grain amount      | 0 to 100       | 0       |
| Grain size        | 1 to 100       | 50      |

Vignette amount darkens the image-relative frame edges. Softness moves the falloff toward the
corners; amount zero is the neutral state. Grain amount controls the strength of a deterministic
texture, and grain size maps from fine to coarse cells. Grain amount zero is neutral, so grain size
does not alter the neutral image.

The grain seed belongs to the Edit rather than its reusable Look. OpenFilm creates one bounded seed
when a source photograph is selected, sends that seed through the same WebGL2 path for preview and
JPEG export, and includes it in the recoverable editor-state representation. Adjustment/Preset JSON
contains the four effect values but never the Edit-specific seed.

The RGB tone curve starts as a neutral straight line from `(0, 0)` to `(1, 1)` and supports at most
8 ordered points, including those fixed input endpoints. Point inputs and outputs are normalized
from 0 to 1. One mapping is applied to red, green, and blue through a 256-sample lookup texture;
the curve is not a set of separate channel curves. Interior point inputs must remain strictly
between their neighbors, and endpoints cannot be removed.

## Requirements

The project pins its development runtime to Node.js `22.20.0` and npm `11.19.0`.

```bash
nvm install
npm ci
```

If `nvm` is not installed, use the versions above directly. The `packageManager` field in
`package.json`, `.nvmrc`, and the exact dependency versions keep local and CI installs aligned.

## Local development

```bash
npm run dev
```

Vite prints the local URL. The production bundle can be previewed with:

```bash
npm run build
npm run preview
```

## Verification scripts

| Script                 | Purpose                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `npm run dev`          | Start the Vite development server                                                     |
| `npm run typecheck`    | Run the TypeScript project build without emitting files                               |
| `npm run lint`         | Run ESLint                                                                            |
| `npm run format:check` | Verify Prettier formatting                                                            |
| `npm run format`       | Apply Prettier formatting                                                             |
| `npm run test:unit`    | Run the Vitest unit and component tests                                               |
| `npm run test:e2e`     | Run the Playwright Chromium import, editing, history, accessibility, and export flows |
| `npm run build`        | Create the static production bundle                                                   |
| `npm run check`        | Run formatting, lint, typecheck, tests, and build in sequence                         |

## Architecture

The source is intentionally split into a few plain module folders:

- `src/editor` contains editor state, the shared adjustment values, normalized Edit geometry, the
  Edit-specific grain seed, and the shared 50-entry Edit history independent of React components.
  The tone curve model owns bounded points, interpolation, lookup generation, ordering rules, and
  JSON serialization. The preset model owns the versioned JSON format and strict runtime checks.
  Editor-state serialization preserves geometry and the seed for local recovery without making
  either part of a Look.
- `src/import` validates common source-photograph files, decodes them through browser APIs, and
  owns local object-URL cleanup.
- `src/rendering` contains the bounded WebGL2 preview renderer, geometry uniforms and output sizing,
  the tone curve lookup texture, image-relative vignette, deterministic grain, deferred luminance
  histogram sampling, format-aware export sizing and encoding, resize handling, and context-loss
  recovery.
- `src/storage` contains the IndexedDB adapter for custom Looks and the latest recoverable Edit,
  plus the product-language boundary for storage failures and the non-backup warning. Source bytes
  stay in the recovery record and never enter a reusable Look.
- `src/ui` contains design tokens, layout styles, and small reusable controls: buttons, icon
  buttons, fields, sliders, panels, and dialogs.

The app uses one Vite entry point and one React tree. There is no general-purpose component kit,
remote font, analytics script, server route, or API client.

## Known limits

OpenFilm applies these bounded browser limits before it attempts the corresponding resource-heavy
operation:

| Area                      | Limit                                              | Recovery                                             |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| Source photograph bytes   | 20 MiB maximum                                     | Choose a smaller JPEG, PNG, or WebP.                 |
| Decoded source dimensions | 16,384 pixels per edge and 80,000,000 total pixels | Choose a smaller photograph.                         |
| Preset file bytes         | 64 KiB of UTF-8 JSON                               | Export or choose a smaller preset.                   |
| Rendered image export     | 16,384 pixels per edge and 80,000,000 total pixels | Crop the Edit or choose a smaller maximum long edge. |

The preview drawing buffer is independently bounded to 4,096 pixels on its longest side. Exports
at or above 24,000,000 pixels, or with an 8,192-pixel edge, receive a browser pixel-memory warning
before allocation. These are practical browser limits, not guarantees that every device can
allocate the maximum; an allocation failure remains recoverable by choosing a smaller export.

The current import path accepts JPEG, PNG, and WebP files at most 20 MiB. After browser
decoding, it accepts photographs up to 16,384 pixels on either side and 80 million total pixels;
these limits keep ordinary phone and camera photographs practical for a browser preview. The
preview uses the browser's `from-image` orientation behavior, so EXIF-oriented photographs are
shown in their intended orientation. Failed type checks, oversized files, invalid dimensions,
and decode failures are reported without replacing the current source photograph.

Import is local-only: it uses a browser object URL and does not upload the source photograph or
make a runtime network request. Object URLs and temporary decoder image resources are released
when an import is replaced or fails.

The application stores the latest Edit locally when IndexedDB is available. A recoverable source
photograph is reopened with its current Look, geometry, history, and grain seed. If
source bytes are unavailable, OpenFilm restores the settings and asks for the source photograph
again; attaching a replacement source keeps those recovered settings. Storage failure leaves the
current in-memory Edit usable, and browser storage is not a durable backup. Export re-encodes the current Edit as JPEG,
PNG, or WebP, exposes quality for JPEG and WebP, and lets the user keep the rendered source
dimensions or choose a maximum long edge without upscaling. The estimated dimensions include the
current crop and rotation. Export re-decodes the local source photograph at the requested render
size and sends it through the same WebGL2 adjustment, curve, effect, grain, and geometry path as
the preview; browser re-encoding strips source metadata and creates a new download without
overwriting the source. Very large source-dimension exports can exceed a browser's WebGL2 texture
or canvas allocation limit; OpenFilm reports that failure and suggests a smaller maximum long edge.
The preview texture and canvas drawing buffer are bounded to 4,096 pixels on their longest side;
the export edge and total-pixel limits above are checked before allocation.
The tone curve is intentionally limited to eight ordered points and one shared RGB mapping. WebGL2
is required; the interface explains how to recover when the capability is missing or its context is
lost. Preset files use OpenFilm format version 1.1 and accept the previous 1.0 minor version. The
format rejects unknown major versions, unsupported adjustment values, oversized metadata, and Edit
state such as geometry, source bytes, history, or the Grain seed.

Browser storage is intended for recovery and is not a backup. WebGL2 is the rendering path; the
interface reports when the capability is unavailable.

## Deployment

`npm run build` creates a static `dist/` directory suitable for Vercel's static deployment. The
project does not require server functions, a database, paid APIs, or a paid hosting feature.
