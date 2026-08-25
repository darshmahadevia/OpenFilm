---
status: superseded by ADR-0028
---

# Target Chromium desktop browsers first

The first workstation release remains a browser application and targets current Chromium-family desktop browsers. A native wrapper and mobile workflow remain outside the release, while the core code should avoid depending on browser UI so a wrapper remains possible if filesystem permissions or resource limits fail real-shoot tests.
