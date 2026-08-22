# OpenFilm

OpenFilm is a quiet, browser-based photo editor for reusable film-inspired Looks. It processes
photographs locally and is designed to deploy as static files without accounts, a backend, or paid
services.

The current application is a canvas-first editor workspace with one active control area, local UI
primitives, source-photograph import, and a single WebGL2 preview path. It validates JPEG, PNG, and
WebP files selected by picker or drag and drop, prepares a bounded preview texture, sends the six
core Adjustments and one RGB tone curve through the fragment shader, and downloads the visible result
as a JPEG. Each scalar control has a slider and a numeric field. The tone curve has a bounded plot,
ordered points, pointer dragging, arrow-key movement, and numeric input. Individual resets, the
all-adjustments reset, undo, and redo use the shared adjustment history. A bundled sample photograph
lets someone try the controls without choosing a file. Replacing a changed Edit asks for
confirmation before returning its adjustment state to neutral. The rest of the editing workflow
will land in the tickets that follow this increment.

## Core adjustments

The Adjust tool uses these ranges. Zero is neutral except for Fade, whose neutral value is zero and
whose range starts at zero.

| Adjustment  | Range          | Neutral |
| ----------- | -------------- | ------- |
| Exposure    | -4 to +4 stops | 0       |
| Contrast    | -100 to +100   | 0       |
| Temperature | -100 to +100   | 0       |
| Tint        | -100 to +100   | 0       |
| Saturation  | -100 to +100   | 0       |
| Fade        | 0 to 100       | 0       |

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

| Script                 | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `npm run dev`          | Start the Vite development server                                   |
| `npm run typecheck`    | Run the TypeScript project build without emitting files             |
| `npm run lint`         | Run ESLint                                                          |
| `npm run format:check` | Verify Prettier formatting                                          |
| `npm run format`       | Apply Prettier formatting                                           |
| `npm run test:unit`    | Run the Vitest unit and component tests                             |
| `npm run test:e2e`     | Run the Playwright Chromium import, reset, replace, and export flow |
| `npm run build`        | Create the static production bundle                                 |
| `npm run check`        | Run formatting, lint, typecheck, tests, and build in sequence       |

## Architecture

The source is intentionally split into a few plain module folders:

- `src/editor` contains editor state, the shared adjustment values, and undoable reducer actions
  independent of React components. The tone curve model owns bounded points, interpolation, lookup
  generation, ordering rules, and JSON serialization.
- `src/import` validates common source-photograph files, decodes them through browser APIs, and
  owns local object-URL cleanup.
- `src/rendering` contains the bounded WebGL2 preview renderer, shader uniforms, the tone curve
  lookup texture, JPEG export, resize handling, and context-loss recovery.
- `src/storage` contains browser-storage capability and product-language boundaries.
- `src/ui` contains design tokens, layout styles, and small reusable controls: buttons, icon
  buttons, fields, sliders, panels, and dialogs.

The app uses one Vite entry point and one React tree. There is no general-purpose component kit,
remote font, analytics script, server route, or API client.

## Known limits

The current import path accepts JPEG, PNG, and WebP files at most 20 MiB. After browser
decoding, it accepts photographs up to 16,384 pixels on either side and 80 million total pixels;
these limits keep ordinary phone and camera photographs practical for a browser preview. The
preview uses the browser's `from-image` orientation behavior, so EXIF-oriented photographs are
shown in their intended orientation. Failed type checks, oversized files, invalid dimensions,
and decode failures are reported without replacing the current source photograph.

Import is local-only: it uses a browser object URL and does not upload the source photograph or
make a runtime network request. Object URLs and temporary decoder image resources are released
when an import is replaced or fails.

The application does not yet persist an Edit, apply the complete Look adjustment set, or offer
selectable export formats, quality, or source-dimension sizing. The first JPEG export re-encodes
the visible WebGL2 result at the bounded preview dimensions, without source metadata. The preview
texture and canvas drawing buffer are bounded to 4,096 pixels on their longest side. The tone curve
is intentionally limited to eight ordered points and one shared RGB mapping. WebGL2 is required;
the interface explains how to recover when the capability is missing or its context is lost.

Browser storage is intended for recovery and is not a backup. WebGL2 is the rendering path; the
interface reports when the capability is unavailable.

## Deployment

`npm run build` creates a static `dist/` directory suitable for Vercel's static deployment. The
project does not require server functions, a database, paid APIs, or a paid hosting feature.
