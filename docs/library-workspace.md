# Library workspace contract

Issue #41 extends the Library-file durability boundary proved by issue #40. The application stays
static and local-first: the browser opens one selected folder, and the Library sidecars live beside
the Source photographs under `.openfilm/`.

## Authority and validation

`library.json` is the durable Library authority. `library.previous.json` and
`library.pending.json` are the recovery slots governed by the existing commit protocol. A valid
durability envelope is not enough to open a Library: the typed document must also have the supported
OpenFilm format, schema version, Library identity, root name, creation time, and Photograph record
shape. An invalid or conflicting file opens read-only and is never silently replaced by browser
storage.

The Library document stores Photograph records, not Source photograph bytes. Opening a folder never
copies or uploads the Source photographs.

## Recent Libraries and recovery

IndexedDB stores the recent Library identity, a serializable directory handle, the last durable
revision reference, and a recoverable working Library copy. That record is a recovery aid only. It
cannot make an invalid or missing sidecar Saved, and it is not a second persistence path.

The start workspace reports these recent states:

- `Ready`: the same folder and a valid saved Library file are available.
- `Reauthorize`: the stored handle needs permission again; reauthorization uses the existing handle
  or the system folder picker and accepts only the same directory entry.
- `Unsaved recovery`: a working copy is retained in browser storage and must be retried, copied, or
  reverted before another Library change.
- `Missing folder`: the stored folder or its Library sidecar is unavailable.

The workspace exposes `Saved`, `Saving`, `Unsaved`, and `Read-only` as visible outcomes. `Unsaved`
blocks another mutation until Retry save, Save a copy, or Revert completes. `Read-only` keeps the
working state visible and routes the user to reauthorization or the recent-Library list.

## Evidence

- Public application boundary: `src/library/libraryApplication.test.ts`
- Browser directory adapter: `src/library/libraryGateway.test.ts`
- Library document and recovery validation: `src/library/libraryModel.test.ts` and
  `src/storage/browserStorage.test.ts`
- Chromium browser journey: `e2e/libraryWorkspace.spec.ts`
- Existing commit durability protocol: `docs/library-durability.md` and
  `e2e/libraryDurability.spec.ts`
