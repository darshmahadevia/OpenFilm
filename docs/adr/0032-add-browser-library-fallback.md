---
status: accepted
---

# Add a Browser Library fallback

OpenFilm uses writable directory handles and `.openfilm/library.json` when the browser provides them. When writable folder access is unavailable, OpenFilm instead opens the selected folder through a directory input, keeps the versioned Library file in IndexedDB, asks the photographer to choose the Source folder again after reload, and supports Library backup download and import. Source photographs remain outside browser storage, and Export uses the bounded download path because this mode cannot write or resume a destination folder. This narrows ADR-0014 and ADR-0031: sidecars remain authoritative for folder-access Libraries, while IndexedDB is authoritative for a Browser Library.
