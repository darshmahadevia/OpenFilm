---
target: src/landing/Landing.tsx
total_score: 28
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 3
timestamp: 2026-08-26T14-09-24Z
slug: src-landing-landing-tsx
---
### Design health score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3/4 | Mobile says “Coming soon” without explaining the boundary or next step. |
| 2 | Match with the real world | 4/4 | Folder, shoot, contact sheet, Pick, Reject, Library, and Export language fits photographers. |
| 3 | User control and freedom | 3/4 | Anchors and skip link are solid; mobile loses navigation and the film strip cannot be paused manually. |
| 4 | Consistency and standards | 3/4 | The visual system is coherent, but the mobile status looks like an enabled button. |
| 5 | Error prevention | 2/4 | Browser support, folder permission, and supported formats are not explained at launch. |
| 6 | Recognition rather than recall | 3/4 | The workflow is visible, but WebGL2, Looks, Geometry, and sidecar persistence need translation. |
| 7 | Flexibility and efficiency | 3/4 | Desktop navigation and shortcut references help; mobile has no equivalent path. |
| 8 | Aesthetic and minimalist design | 3/4 | Strong restraint, though the tall hero delays product proof and small labels reduce legibility. |
| 9 | Error recovery | 2/4 | No landing-page recovery guidance for denied permissions or unsupported browsers. |
| 10 | Help and documentation | 2/4 | Documentation exists only in the footer and is not tied to launch decisions. |
| **Total** | | **28/40** | **Good foundation with clear conversion friction.** |

### Design specificity verdict

The page is highly specific to OpenFilm. The real workstation frame, `.openfilm/library.json`, supported-format boundary, keyboard map, ruled layout, and matte proof-studio treatment could not be dropped onto an unrelated product unchanged.

The weaker moments are familiar photography-brand territory: moody darkroom imagery and “The shoot stays yours” carry atmosphere but little unique product evidence on their own. The concrete local-first story keeps the page from becoming generic.

The CLI detector found no static TSX violations. The browser detector found 19 targets with 22 rule instances. Several are intentional documentary treatments, but navigation, captions, secondary links, footer links, and path text share a genuine undersized-text problem.

### Overall impression

OpenFilm already feels composed, serious, and unusually honest. The biggest missed opportunity is simple: the first viewport sells the mood before it proves the workstation. At 1280×800, only the upper edge of the product frame is visible.

### What is working

- Near-black surfaces, warm-white text, fine rules, and sand interaction color form a disciplined visual system.
- Real product evidence replaces testimonials, fake metrics, and generic feature cards.
- The reading order is clean: launch, proof, workflow, local architecture, closing action.
- Alt text, landmarks, the skip link, and decorative-image semantics are strong.

### Priority issues

1. **[P1] The workstation proof is buried below the first viewport.** Reduce hero height and vertical separation, then lift the proof frame enough to show a readable slice of controls and photographs without breaking the single reveal.
2. **[P1] Mobile “Coming soon” is a false affordance.** Turn it into a clearly non-interactive status with a desktop requirement and a useful documentation or handoff link.
3. **[P1] Launch lacks capability and recovery guidance.** Add a concise, factual note near the primary action covering desktop browser support, JPEG/PNG/WebP, folder permission, and Browser Library behavior.
4. **[P2] Documentary text is consistently too small.** Raise the shared floor for navigation, captions, secondary links, footer links, and `.openfilm/library.json` while preserving hierarchy.
5. **[P2] Media and motion compete with proof.** Pause motion on hover/focus, preserve reduced motion, and lazy-load lower images with dimensions intact.

### Cognitive load

Moderate. Product proof is not prominent enough in the first viewport, six shortcut references exceed the preferred four-item chunk, and new visitors must retain several domain terms before receiving plain-language definitions.

### Emotional journey

The arrival feels quiet and credible. The facts strip and real workstation view build trust, and the four-step workflow makes the product feel manageable. The valleys are delayed proof, unexplained technical language, and the mobile dead end. The closing image lands emotionally, but “Open the workstation” would describe the action more clearly.

### Persona red flags

- **Jordan, first-time photographer:** “Open OpenFilm” does not name the destination, and Library, WebGL2, Looks, Geometry, and sidecars arrive without enough translation.
- **Riley, cautious evaluator:** No launch guidance covers folder denial, unsupported browsers, Browser Library storage, or the fact that Source files are not backed up.
- **Casey, mobile visitor:** Navigation disappears, the main action becomes a button-shaped non-action, and image weight is high on a slow connection.

### Minor observations

- The GitHub “Source” link leaves the site in the same tab without signaling it.
- `overflow: clip` is intentional, but high-zoom focus outlines should remain visible.
- “Every photograph” is broader than the supported JPEG/PNG/WebP boundary.
- The screenshot’s tiny labels cannot carry explanatory weight by themselves.

### Questions to consider

- Should the first eight seconds prove the Grid, the no-upload promise, or durable Library state?
- Is mobile “Coming soon” meant to be a product boundary or a handoff opportunity?
- Should every launch action say “Open the workstation” for clarity?
