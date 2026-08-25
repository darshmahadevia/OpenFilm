---
status: accepted
---

# Bound decoded images and GPU resources by bytes

OpenFilm separates grid thumbnails, viewport-sized Comparison data, and full-resolution edit or export work. A byte-budgeted least-recently-used cache closes decoded bitmaps and deletes GPU textures on eviction. Whole-image full-resolution work admits one Source photograph at a time, while Comparison may request separately budgeted source regions or tiles after a prototype proves that browser decoding can keep those regions bounded. When a requested region cannot fit, OpenFilm keeps the best admitted derivative visible, labels the pane as resolution-limited, and does not call it 100 percent.
