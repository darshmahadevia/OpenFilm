---
status: accepted
---

# Ship the workstation in the browser

OpenFilm ships the landing page and full workstation as static Vite pages instead of packaging the workstation with Electron. This removes platform installers, desktop updates, signing requirements, and a second runtime while preserving the local Library workflow through Chromium's File System Access API, IndexedDB, Web Workers, and WebGL2. Browser support for directory handles is now an explicit product requirement, and unsupported mobile browsers remain outside the shipped workstation boundary.
