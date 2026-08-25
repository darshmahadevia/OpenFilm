---
status: accepted
---

# Arbitrate expensive work through one scheduler

Scans, EXIF parsing, thumbnail generation, hashing, analysis, and export preparation run through one priority-aware scheduler over a bounded worker pool. Visible thumbnails and the active Comparison outrank prefetch and background analysis. Jobs support cooperative cancellation, stale-result rejection, bounded retries, and checkpoints where restarting would waste material work.
