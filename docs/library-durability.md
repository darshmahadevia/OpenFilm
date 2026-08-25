# Library-file durability gate

Issue #40 tests the first v2 gate in isolation. The prototype keeps the Library file local to the selected folder and does not add a server, account, or network persistence.

## File layout

The browser adapter stores three files below the selected folder:

```text
.openfilm/
  library.json
  library.previous.json
  library.pending.json
```

`library.json` is authoritative. Each file contains a version, revision number, parent revision and checksum, write time, and the JSON Library payload. The checksum covers the complete envelope except the checksum field. Object keys are sorted before hashing, and the browser computes SHA-256 with Web Crypto.

## Commit sequence

The coordinator uses a Web Lock named for the Library file. If Web Locks is missing, it refuses to write because the browser cannot prove single-writer behavior.

1. Read and verify all three sidecars. The caller supplies the revision and checksum it opened.
2. Write the next revision to `library.pending.json`, close the stream, and read it back.
3. Recheck the authoritative revision. A newer external revision returns `conflict`.
4. Copy the verified current revision to `library.previous.json`, close it, and read it back.
5. Recheck the authoritative revision again.
6. Write the candidate to `library.json`, close it, and read it back. Only this read-back can produce `saved`.
7. Remove the pending copy. If cleanup is interrupted, the verified pending copy remains harmless because the next load prefers the verified authoritative revision.

The previous snapshot protects the old revision while `library.json` is replaced. The pending copy protects a complete new revision while the commit is in progress. A truncated or checksum-invalid file is ignored as a revision and is reported for inspection.

## Recovery and explicit outcomes

On open, the coordinator chooses a verified authoritative revision first. If that file is missing or invalid, it uses the previous snapshot. A verified pending revision whose parent matches the durable revision is exposed as an unsaved recovery. A pending revision based on another revision, equal-revision files with different checksums, or an unexpectedly newer previous snapshot produces `conflict`; OpenFilm never merges the files.

The session boundary exposes the actions required by ADR-0025:

- `permission-denied` keeps the working Library in memory, marks the session read-only, and asks for reauthorization.
- `retry` promotes a verified pending revision idempotently. If the failed write happened before the pending revision was verified, it retries the retained working Library.
- `saved-copy` commits the current working Library to a separately authorized destination without clearing the original unsaved state.
- `reverted` discards the pending revision. If `library.json` is damaged, it restores the previous verified snapshot and reads it back before completing.
- `blocked-unsaved` rejects another mutation until Retry, Save a copy, or Revert resolves the uncertain state.

## Measured evidence

The following runs were completed locally on 2026-08-24:

| Check                                                                                       | Result                                                                                  |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `npx vitest run src/library/libraryFile.test.ts src/library/libraryFilePersistence.test.ts` | 2 files passed, 11 tests passed                                                         |
| `npx playwright test e2e/libraryDurability.spec.ts`                                         | 1 test passed; 15 commit phases exercised against Chromium Origin Private File System   |
| `npm run check`                                                                             | Passed: formatting, lint, typecheck, 16 unit files with 125 tests, and production build |
| `npm run test:e2e`                                                                          | 34 tests passed, including the durability harness                                       |

The focused tests cover checksum tampering, truncated pending/previous/authoritative writes, write-then-read corruption, every exported interruption phase, competing tabs, newer external revisions, permission loss, Retry, Save a copy, Revert, and mutation blocking. The browser test uses the same File System Access file operations and Web Crypto path that the selected-folder adapter uses, with a synthetic interruption at each phase.

The gate passes for the current Chromium desktop target. This is a protocol and browser-API result. It does not claim that every host filesystem preserves a stream close across sudden power loss, and it does not make the rest of the v2 workstation complete.
