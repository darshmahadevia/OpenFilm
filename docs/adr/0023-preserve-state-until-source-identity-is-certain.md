---
status: accepted
---

# Preserve state until source identity is certain

A changed file at an existing path creates a new Photograph record while the previous record remains Missing with its state intact. A moved file relinks automatically only when one candidate has a matching content hash. Ambiguous matches require an explicit choice so OpenFilm never silently applies an Edit or Culling decision to different source bytes.
