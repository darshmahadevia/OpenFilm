---
status: accepted
---

# Persist current Edits, not durable history

Each Photograph record persists its current non-destructive Edit and a revision number. Undo and redo remain bounded to the active session. The only first-release multi-photo edit is copying a Look to selected photographs, avoiding the storage and recovery cost of durable per-photo histories and arbitrary batch geometry.
