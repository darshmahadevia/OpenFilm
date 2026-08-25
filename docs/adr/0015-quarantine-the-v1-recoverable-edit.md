---
status: accepted
---

# Quarantine the v1 recoverable Edit

OpenFilm v2 preserves valid Looks but does not silently turn the v1 recoverable Edit into Library state or clear it during migration. It keeps that record isolated until the user exports or discards it, protecting in-progress work without forcing the v2 model to support an ambiguous migration.
