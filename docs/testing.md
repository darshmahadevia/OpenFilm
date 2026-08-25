# Testing and release checks

## Automated commands

| Command                                                                      | Scope                                                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run check`                                                              | Prettier check, ESLint, TypeScript, all Vitest tests, production build                      |
| `npm run check:ui-slop`                                                      | Reject gradients, glass effects, social-proof copy, and generic slogans in the shipped UI   |
| `npm run test:e2e`                                                           | Chromium workflow, durability, accessibility, and responsive tests                          |
| `npm run perf:generate`                                                      | Build the deterministic 2,000-record logical corpus                                         |
| `npm run test:e2e:performance`                                               | Measure the browser performance gate and write `.artifacts/browser-performance-report.json` |
| `OPENFILM_CAPTURE_EVIDENCE=1 npx playwright test e2e/visualEvidence.spec.ts` | Refresh tracked wide, medium, and 200-percent-zoom screenshots                              |

Install the Playwright browser once with `npx playwright install chromium`. The suite starts Vite on
port `4187` unless `PLAYWRIGHT_BASE_URL` is set. Durability and performance fixtures use Origin
Private File System and therefore run only against the local server.

The top-level `npm run test:release` executes the main static, browser, anti-slop, and synthetic
performance checks. The general browser suite excludes the `@performance` test. Run that stricter
browser scale gate explicitly because it produces machine-specific evidence.

## What is covered

Vitest exercises the durable file protocol and recovery, scanner, metadata parser, virtualized Grid,
bounded scheduler/cache, review commands, atomic Look copy, groups, Comparison geometry, Edit
persistence, analysis cache invalidation, migration/quarantine, Source reconciliation, Export
planning/resume, renderer, and storage boundaries.

Playwright covers:

- creating and reopening a Library, progressive scan, invalid sidecar protection, permission and
  recovery states;
- Grid keyboard review, range Selection, auto-advance, Loupe, Comparison, Edit inspector focus, and
  Source/context-loss states;
- resumable mixed-success Export in the browser and every interrupted Library commit phase;
- axe-core checks at the start and populated workstation, visible focus, narrow widths, 200-percent
  zoom proxy, and reduced-motion preference;
- a 2,000-record performance fixture at baseline and 4× CPU throttling.

The performance gate records first usable Grid, Loupe and Comparison readiness, p95 selection and
general interaction latency, p95 frame time, JS heap, mounted Grid cells, live bitmaps/textures,
queue depth, and full-resolution reads during open. It treats the corpus as a logical scale fixture;
see [limitations](./limitations.md).

## Manual release pass

Before publishing, repeat these checks in the packaged Chromium runtime on macOS and Windows. The
recorded performance baseline remains macOS-specific:

1. Navigate the complete start, Grid, Loupe, Comparison, inspector, groups, Export, and recovery
   surfaces using only keyboard controls. Confirm the focus ring remains visible, focus returns after
   closing the inspector, and Tab cannot escape an open modal surface.
2. With VoiceOver on macOS and Narrator on Windows, confirm the Library heading, save status, scan
   progress, Grid cells, Active/Selection state, Comparison panes, sliders, numeric fields, dialogs,
   and recovery alerts have distinct names and useful state announcements.
3. At 1440 × 900, 900 × 760, and 360 × 844, and at 200-percent browser zoom, confirm controls remain
   reachable without document-level horizontal scrolling.
4. Enable `prefers-reduced-motion: reduce`; confirm selection, mode, save, and recovery changes remain
   understandable without decorative motion.
5. Exercise an unsupported file, decode failure, missing Source, lost WebGL2 context, storage failure,
   conflicting revision, permission loss, cancelled scan, cancelled Export, and failed Export entry.
6. Check the generated screenshots, asset provenance sidecars, README, release notes, and limitations
   for claims that exceed the measured evidence.

Automated accessibility checks and semantic inspection reduce risk but are not WCAG certification or
a substitute for testing on every browser, assistive technology, and device.
