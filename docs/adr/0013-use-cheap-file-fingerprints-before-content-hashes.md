---
status: accepted
---

# Use cheap file fingerprints before content hashes

Each Photograph record has a Library-local stable ID and reconciles against relative path, byte size, and last-modified time. OpenFilm computes a content hash only for ambiguous reconciliation or duplicate analysis, avoiding a full read of every Source photograph during ingest while refusing to transfer state when identity is uncertain.
