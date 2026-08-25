---
status: accepted
---

# Export final sets to a chosen folder

OpenFilm exports Picks or an explicit Selection to a newly authorized destination folder with deterministic collision-safe names and a resumable manifest. The manifest binds each output to its Photograph record, source fingerprint, Edit revision, renderer version, settings, completion checksum, and failure state. Resume skips only a matching completed output. OpenFilm never overwrites by default. First-release JPEG, PNG, and WebP output uses the browser's sRGB-assumed rendering, strips source metadata, and makes no archival, print-master, or professional color-management claim.
