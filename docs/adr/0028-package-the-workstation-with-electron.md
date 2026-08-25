---
status: superseded by ADR-0029
---

# Package the workstation with Electron

OpenFilm ships the workstation in an Electron desktop shell for macOS. Vite produces two pages: the
public download site at `index.html` and the workstation at `app.html`. Electron loads only the
packaged workstation page and keeps the renderer sandboxed with Node integration disabled and
context isolation enabled.

The shell continues to use Chromium's File System Access API, IndexedDB, Web Workers, WebGL2, and the
existing local-first Library model. It does not add a preload bridge, application backend, account
system, network dependency, or a second persistence path. External web links open in the system
browser.

The macOS release is a universal DMG and ZIP built with electron-builder. The repository can create
unsigned local artifacts, but a public release requires Apple Developer signing and notarization
credentials. The static Vercel deployment remains the download site, not the workstation runtime.
