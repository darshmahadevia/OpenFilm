---
status: accepted
---

# Block mutations while a Library is Unsaved

When a Library-file commit fails, OpenFilm retains the failed command in memory and its IndexedDB recovery copy, marks the Library Unsaved, and allows navigation and viewing. Further mutations wait until Retry, Save a copy, or Revert succeeds. This bounds divergence between the working copy and durable state instead of queuing an uncertain chain of edits.
