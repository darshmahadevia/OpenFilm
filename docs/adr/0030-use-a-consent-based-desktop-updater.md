---
status: superseded by ADR-0031
---

# Use a consent-based desktop updater

Installed OpenFilm builds check the latest GitHub Release at startup and every four hours, but never
download an update without the photographer's consent. A narrow sandboxed preload bridge exposes
only check, download, progress, and installer-launch actions to the renderer. The main process
accepts only the named OpenFilm `.dmg` or `.exe` asset from the project's HTTPS release path, bounds
its size, and verifies GitHub's SHA-256 digest when one is present. macOS opens the downloaded disk
image and Windows launches the downloaded NSIS installer. This manual replacement flow works for
unsigned builds and keeps signing and notarization optional for free distribution.
