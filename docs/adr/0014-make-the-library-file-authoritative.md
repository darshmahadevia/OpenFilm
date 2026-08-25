---
status: accepted
---

# Make the Library file authoritative

The versioned `.openfilm/library.json` sidecar inside the selected root folder is the durable authority for Library membership, review state, and Edits. IndexedDB holds a recoverable working copy and the serializable directory handle. OPFS or IndexedDB may hold discardable derivatives. OpenFilm reports a Library as unsaved or read-only whenever a sidecar commit does not succeed. This supersedes ADR-0001 only where that decision assigns recoverable Edit state to IndexedDB; its client-side and no-backend constraints remain.
