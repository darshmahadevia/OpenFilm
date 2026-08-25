# Testing and release checks

## Automated checks

`npm run check` runs these steps in sequence:

1. `npm run format:check`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test:unit`
5. `npm run build`

Other useful commands:

| Command                   | Purpose                                    |
| ------------------------- | ------------------------------------------ |
| `npm run dev`             | Start the Vite development server.         |
| `npm run format`          | Apply Prettier formatting.                 |
| `npm run test:unit:watch` | Run Vitest in watch mode.                  |
| `npm run preview`         | Serve the latest production build locally. |

The `check` script does not run Playwright. Run the browser suite separately:

```bash
npx playwright install chromium
npm run test:e2e
```

The suite starts a local Vite server on port `4187` unless `PLAYWRIGHT_BASE_URL` is set. To test the
production deployment:

```bash
PLAYWRIGHT_BASE_URL=https://openfilm.vercel.app npm run test:e2e
```

The Library durability gate has a source-module browser harness. Run it locally with:

```bash
npx playwright test e2e/libraryDurability.spec.ts
```

The harness writes the versioned sidecars to Chromium's Origin Private File System and injects an
interruption at every exported commit phase. The deterministic Vitest suite adds truncated and
corrupted writes, competing revisions, permission loss, Retry, Save a copy, Revert, and mutation
blocking cases.

CI installs Chromium with system dependencies before running the browser suite.

## Manual release checks

Before a release, check the following in a current desktop browser and a phone-sized viewport:

- Move through the landing page, tool tabs, disclosures, sliders, numeric fields, tone-curve points,
  crop handles, dialogs, Looks, and export controls with the keyboard. Confirm the focus ring stays
  visible and documented arrow-key controls work.
- At 200 percent browser zoom, confirm the editor keeps all controls reachable without horizontal
  scrolling. Repeat on a narrow phone viewport in portrait and landscape.
- With `prefers-reduced-motion` enabled, confirm state changes remain clear without decorative motion.
- Check approximately 1440 × 900 and 360 × 844 viewports. Review hierarchy, spacing, contrast, status
  messages, touch targets, and hover-independent actions.
- Try a supported file, an unsupported file, a decode failure, missing WebGL2, storage failure, a
  lost WebGL2 context, and a large export. Confirm each message explains the problem and its recovery.

These are practical release checks, not formal WCAG certification or a substitute for testing on
every browser and device.
