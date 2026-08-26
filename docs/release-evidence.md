# Release evidence — Library Workstation

Verdict: **Conditional pass on the verified target**. The workstation paths below pass, but the
release remains gated on a 2,000-file independent-content/storage-throughput run and the documented
analysis-validation corpus.

Evidence was collected on 2026-08-25 in current desktop Chromium on a MacBook Air with Apple M4,
10 CPU cores, and 16 GB memory. The repository state under review is the change set after `e38f6d0`.
Machine identifiers are intentionally omitted.

## Functional and durability gates

- `npm run check`: formatting, lint, typecheck, Vitest, and production build.
- `npm run test:e2e`: start/workstation journeys, keyboard culling, Loupe, Comparison, Edit focus,
  progressive scan, recovery, axe-core, responsive/reduced-motion behavior, interrupted commits, and
  mixed-success Export resume.
- Focused module tests cover filtering/order, auto-advance, atomic Look copy, groups, bounded cache,
  comparison geometry, analysis cache invalidation, Source reconciliation, migration/quarantine, and
  Export planning/checksum reconciliation.

The final local run passed 34 Vitest files / 180 tests and 11 Playwright tests; the screenshot-only
Playwright test was skipped by default and run separately with its capture flag.

## Measured browser performance

Fixture: 2,000 Photograph records, declared 8,000 × 5,625 pixels (45 MP) and 24,000,000 bytes per
Source. Four records have physical local fixtures and 1,996 are Missing logical records. Opening the
Library performed zero full-resolution reads.

`npm run perf:generate` separately creates 2,000 filesystem paths backed by a valid 8,000 × 5,625,
24 MB logical JPEG. It uses hard links so the reproducible directory-scale corpus occupies about
4 MB here; repeated content does not qualify it as a storage-throughput or photographic-quality
corpus.

| Metric                                |  Baseline | 4× CPU throttle |                Gate |
| ------------------------------------- | --------: | --------------: | ------------------: |
| First usable Grid                     |  150.5 ms |               — |          ≤ 5,000 ms |
| Loupe ready                           |   16.7 ms |               — |            measured |
| Comparison ready                      |   25.2 ms |               — |            measured |
| Selection latency p95                 |   17.2 ms |         25.0 ms |             < 50 ms |
| General interaction p95               |   17.3 ms |         31.7 ms |            < 100 ms |
| Frame time p95                        |   17.3 ms |         34.5 ms | baseline ≤ 33.34 ms |
| Live Grid cells                       |        35 |              35 |               < 100 |
| JS heap                               |   19.3 MB |         19.3 MB |            recorded |
| Thumbnail cache                       | 150.3 KiB |       150.3 KiB |     ≤ 96 MiB budget |
| Live bitmaps / textures / queued jobs | 0 / 2 / 0 |       0 / 2 / 0 |            recorded |

The report is generated at `.artifacts/browser-performance-report.json`. These numbers validate the
virtualized application path on the named machine, not 2,000 concurrent full-image decodes or every
device. The companion model harness is useful for regressions but is not substituted for this browser
measurement.

The bounded Comparison browser harness creates four 640 × 450 derivatives from one controlled
8,000 × 5,625 Source, admits 4,608,000 decoded bytes for two-, three-, and four-pane states, verifies
Source-coordinate focal mapping, evicts under a two-derivative pressure budget, and rejects a full
Source admission with `Resolution limited · Fit`.

## Accessibility and visual evidence

Playwright uses axe-core on the start and populated workstation and verifies keyboard operation,
focus containment/restoration, responsive widths, a 200-percent-zoom proxy, and reduced-motion
preference. The manual screen-reader/keyboard checklist is in [testing](./testing.md). This evidence
is not a WCAG certification.

- [Wide workstation](./screenshots/openfilm-workstation-wide.png)
- [Medium workstation](./screenshots/openfilm-workstation-medium.png)
- [200-percent zoom proxy](./screenshots/openfilm-workstation-200-percent-zoom.png)

`npm run check:ui-slop` scans the shipped shell for gradients, glass effects, generic promotional
copy, and social-proof patterns. The design contract in [DESIGN.md](../DESIGN.md) records the visual
decisions and prohibited patterns.

## Asset provenance

Bundled photographic assets were created with OpenAI ImageGen. Each `.webp` has an adjacent `.json`
file recording its prompt, creation timestamp, and source. The workstation screenshots are generated
from the shipped app by `e2e/visualEvidence.spec.ts`; they are documentation evidence, not synthetic
product mockups. The bundled Bodoni font and dependency notices remain covered by
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## Finish review

The tracked wide, medium, and zoom captures were inspected after the final responsive change.
Hierarchy remains Library/save state → modes → filters/commands → image stage; the 200-percent view
wraps every command into view instead of hiding it in a page-level horizontal scroller. Spacing and
type remain compact, focus uses the single sand outline, reduced motion removes nonessential
transitions, empty/filter states name the recovery action, and scan/Export progress stays textual and
cancellable. The four-photo fixture leaves intentional black stage space rather than enlarging or
cropping photographs decoratively.

Recorded deviations are functional: Comparison is a labeled bounded derivative rather than true
100 percent; Similarity/Sharpness controls are absent because their corpus gate failed; the tracked
zoom capture is an effective-width proxy rather than browser-chrome zoom; and a dated manual
VoiceOver pass has not been recorded. None of these deviations introduces decorative gradients,
glass, cards, fake activity, or promotional content.

## Conditional boundaries

- Similarity and Sharpness stay out of the UI until a rights-cleared labeled corpus passes their
  quality gate; deterministic Burst grouping ships.
- Comparison is fit-only on bounded derivatives and never claims 100-percent fidelity.
- Folder Export needs browser directory-write permission. Download fallback is capped at 12 and is
  not resumable after reload.
- JPEG, PNG, and WebP are supported. RAW/HEIC/TIFF, archival color management, cloud sync, and
  cross-device Libraries remain out of scope.

Those are intentional scoped decisions, not hidden pass claims. See [limitations](./limitations.md).
