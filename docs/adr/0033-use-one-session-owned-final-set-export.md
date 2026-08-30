---
status: accepted
---

# Use one session-owned Final-set Export

OpenFilm runs resumable folder Export and bounded browser downloads through one Final-set Export module owned by the open Library session. A run freezes its Photograph records and Edits, uses destination adapters behind one seam, and stops cancellation at safe durability checkpoints so the workstation does not own manifest or file-write ordering. Resume after reload starts a new run from current Edits and reuses only outputs that still validate against the manifest.
