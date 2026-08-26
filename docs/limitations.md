# Browser and release limitations

OpenFilm's measured release evidence comes from current Chromium on macOS. Windows, Brave, Safari,
Firefox, and other browsers have not yet received the same hardware-specific performance and
assistive-technology pass. OpenFilm depends on directory selection, IndexedDB, Web Workers, Canvas,
Web Crypto, and WebGL2. Browsers without writable directory handles use a Browser Library: they ask
for the Source folder again after reload, keep the versioned Library file in browser storage, and
cannot use resumable folder Export. A lost WebGL2 context pauses rendered preview and Export until
the browser restores the context or the page is reloaded. OpenFilm does not ship a desktop shell,
installer, or application updater.

## Formats and color

Source discovery accepts JPEG, PNG, and WebP by extension or supported MIME type. Decoding,
orientation, and encoding ultimately depend on the browser. RAW, HEIC/HEIF, TIFF, guaranteed AVIF,
camera profiles, soft proofing, archival metadata, and professional color management are out of
scope. Export assumes sRGB, re-encodes the rendered result, and strips source metadata. It is not an
archival or print-fidelity master.

## Scale and resource bounds

The browser release gate exercises a deterministic 2,000-record Library with logical 45-megapixel,
24-megabyte Sources. Only four records contain a physical fixture; the remaining records carry the
same declared scale while marked Missing. The separate generator creates 2,000 decodable 45 MP,
24 MB logical JPEG paths through hard links. Together these validate directory scale, application
state, virtualization, bounded DOM use, selected-source decode, and interaction latency. They do not
measure independent-disk storage throughput, 2,000 simultaneous full-Source decodes, or every device.

Grid cells use fingerprint-versioned thumbnails held under a 96 MiB least-recently-used cache.
Loupe reads the active Source through the shared scheduler and one-full-Source admission gate.
Comparison deliberately uses bounded 640-pixel derivatives and always says
`Resolution limited · Fit`; it does not claim a true 100-percent view. The thumbnail cache and work
scheduler enforce byte, concurrency, retry, and generation bounds.

The download-only Export fallback is limited to 12 photographs and cannot resume after reload.
Folder Export uses a manifest, never overwrites an existing path, and can reconcile completed files
by checksum before resuming.

## Analysis boundary

Deterministic Burst grouping is shipped. The repository also contains versioned perceptual-hash and
relative-sharpness analysis modules with cache invalidation and time-neighborhood candidate
generation. Those signals are not exposed in the product because the project does not have a
rights-cleared, labeled camera corpus that passes the required precision and recall gate. OpenFilm
does not present them as authoritative quality rankings.

Admission requires a documented rights-cleared corpus, Similarity precision of at least 0.90 and
recall of at least 0.75 on its labeled near-duplicate pairs, zero automated culling or group changes,
p95 derivative analysis below 100 ms on the recorded M4 baseline, and scheduler/cache budgets that
remain within the large-Library gate. The current release fails the corpus requirement, so the
signals remain omitted.

## Recovery boundaries

For a folder-access Library, `.openfilm/library.json` is authoritative. Pending and previous
sidecars support interrupted-commit recovery; IndexedDB holds recent handles and a working copy. For
a Browser Library, IndexedDB holds the authoritative versioned Library envelope and the photographer
can download or import a Library backup. Neither mode backs up Source photographs. Permission loss,
a conflicting revision, or an invalid Library file produces an explicit read-only or unsaved state
instead of silently replacing durable data.

Path plus cheap fingerprint preserves identity for unchanged Sources. Changed bytes at the same path
create a new record and leave the previous record Missing. Explicit Refresh computes content hashes
as low-priority work for later reconciliation; initial scan stays on cheap fingerprints. A moved
Source relinks only when one cached hash matches. Ambiguous matches stay unresolved until the
photographer chooses which Missing record supplies the state.

Version-1 Library migration preserves valid Looks and quarantines recoverable malformed Edit state.
Unrecognized or unsafe state opens read-only. Legacy identity conflicts are resolved once and stored
as durable fingerprints.

Browser storage quotas, GPU memory, file-system permissions, and directory picker behavior vary by
device. The measured release evidence is therefore a bounded implementation result, not a broad
compatibility guarantee.
