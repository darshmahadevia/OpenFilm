# Browser limitations

OpenFilm needs WebGL2 for preview and export. Browsers without WebGL2, or browsers that lose the
WebGL2 context, cannot render an Edit until the page is reloaded or the browser recovers the context.
The application relies on each browser's JPEG, PNG, WebP, File, Canvas, IndexedDB, and WebGL2
implementations.

## Resource limits

OpenFilm checks these limits before resource-heavy operations:

| Area                      | Limit                                              | Recovery                                             |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| Source photograph bytes   | 20 MiB                                             | Choose a smaller JPEG, PNG, or WebP.                 |
| Decoded source dimensions | 16,384 pixels per edge and 80,000,000 total pixels | Choose a smaller photograph.                         |
| Preset file bytes         | 64 KiB of UTF-8 JSON                               | Export or choose a smaller preset.                   |
| Rendered image export     | 16,384 pixels per edge and 80,000,000 total pixels | Crop the Edit or choose a smaller maximum long edge. |

The preview drawing buffer is limited to 4,096 pixels on its longest side. Exports at or above
24,000,000 pixels, or with an 8,192-pixel edge, receive a browser pixel-memory warning before
allocation. A device may still fail to allocate a smaller image because GPU and canvas memory vary.

## Import and export behavior

The import path accepts JPEG, PNG, and WebP files. After browser decoding, it checks the dimension
and total-pixel limits above. EXIF-oriented photographs use the browser's `from-image` orientation
behavior. Failed type checks, oversized files, invalid dimensions, and decode failures do not replace
the current source photograph.

Import uses a browser object URL and does not upload the source photograph or make a runtime network
request. OpenFilm releases object URLs and temporary decoder resources when an import is replaced or
fails.

Export re-encodes the current Edit as JPEG, PNG, or WebP. JPEG and WebP expose a quality control.
Exports can keep the rendered source dimensions or use a smaller maximum long edge without
upscaling. The estimated dimensions include the current crop and rotation. Browser re-encoding
strips source metadata and creates a new download without overwriting the source.

## Recovery and unsupported formats

IndexedDB may store the latest Edit, including source bytes, its current Look, geometry, history, and
grain seed. If source bytes are unavailable, OpenFilm restores the settings and asks for the source
photograph again. Attaching a replacement source keeps those recovered settings. Storage failure
leaves the current in-memory Edit usable, but browser storage is not a backup.

The tone curve is limited to eight ordered points and one shared RGB mapping. Preset files use
OpenFilm format version 1.1 and accept the previous 1.0 minor version. The format rejects unknown
major versions, unsupported adjustment values, oversized metadata, and Edit state such as geometry,
source bytes, history, or the grain seed.

RAW, HEIC, HEIF, TIFF, guaranteed AVIF support, professional color management, and real-device
compatibility matrices are out of scope.
