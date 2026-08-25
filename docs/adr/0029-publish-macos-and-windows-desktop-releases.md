---
status: accepted
---

# Publish macOS and Windows desktop releases

OpenFilm ships the same sandboxed Electron workstation on macOS and Windows so photographers can use
the local Library workflow without relying on a browser deployment. Each tagged release builds a
universal macOS DMG and ZIP on macOS and an x64 Windows NSIS installer on Windows, then publishes all
three stable asset names in one GitHub Release. Preview builds remain unsigned until platform signing
credentials are configured, and the download page states that limitation rather than implying a
signed release.
