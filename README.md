# OpenFilm

OpenFilm is a quiet, browser-based photo editor for reusable film-inspired Looks. It processes
photographs locally and is designed to deploy as static files without accounts, a backend, or paid
services.

The current application is the editor shell: a canvas-first workspace, one active control area,
local UI primitives, and the seams for editor state, rendering, and browser storage. Image
processing and the full adjustment workflow will land in the tickets that follow this scaffold.

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

| Script                 | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `npm run dev`          | Start the Vite development server                             |
| `npm run typecheck`    | Run the TypeScript project build without emitting files       |
| `npm run lint`         | Run ESLint                                                    |
| `npm run format:check` | Verify Prettier formatting                                    |
| `npm run format`       | Apply Prettier formatting                                     |
| `npm run test:unit`    | Run the Vitest unit and component tests                       |
| `npm run build`        | Create the static production bundle                           |
| `npm run check`        | Run formatting, lint, typecheck, tests, and build in sequence |

## Architecture

The source is intentionally split into a few plain module folders:

- `src/editor` contains editor state and reducer actions independent of React components.
- `src/rendering` contains the WebGL2 capability seam used by the preview shell.
- `src/storage` contains browser-storage capability and product-language boundaries.
- `src/ui` contains design tokens, layout styles, and small reusable controls: buttons, icon
  buttons, fields, sliders, panels, and dialogs.

The app uses one Vite entry point and one React tree. There is no general-purpose component kit,
remote font, analytics script, server route, or API client.

## Known limits

This first scaffold does not yet decode or render a selected photograph, persist an Edit, apply a
Look, or export an image. The file picker and controls establish the interaction shell for those
later increments. Only JPEG, PNG, and WebP are advertised by the shell; unsupported formats and
the full validation path will be handled by the import ticket.

Browser storage is intended for recovery and is not a backup. WebGL2 is the planned rendering path;
the shell reports when the capability is unavailable.

## Deployment

`npm run build` creates a static `dist/` directory suitable for Vercel's static deployment. The
project does not require server functions, a database, paid APIs, or a paid hosting feature.
