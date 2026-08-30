# OpenFilm

The approved OpenFilm v2 model is a local-first browser workstation for culling, comparing, editing, and exporting photographs from a shoot without accounts or a backend.

## Language

**Look**:
An image-independent group of photographic adjustments that can be reused with different photographs.
_Avoid_: Filter, recipe, style

**Preset file**:
A versioned JSON representation of one Look that can be imported or exported independently of a photograph.
_Avoid_: Preset pack, project file

**Edit**:
One Source photograph together with its current Look, geometry, history, and Grain seed.
_Avoid_: Project, document

**Library**:
A snapshot of the supported photographs found recursively under one user-selected folder, together with their review and Edit state. A Library is reconciled when the user refreshes it and records Source photographs rather than owning their files.
_Avoid_: Catalog, collection, album

**Library file**:
The durable saved representation of a Library.
_Avoid_: Database, project file, cache

**Browser Library**:
A Library whose Library file is kept in browser storage because the browser cannot write beside its Source photographs. Its Source folder must be chosen again after reload.
_Avoid_: Temporary Library, fallback Library

**Unsaved Library**:
A Library whose latest command has not been durably saved. It remains viewable, but further changes wait for Retry, Save a copy, or Revert.
_Avoid_: Dirty state, offline Library

**Photograph record**:
The Library's stable identity and persisted state for one Source photograph. Its identity is distinct from the file fingerprint used to reconcile folder changes.
_Avoid_: Asset, item, image row

**Missing photograph**:
A Photograph record whose Source photograph is not currently available. Its review and Edit state remain with the record.
_Avoid_: Deleted photograph, broken image

**Source photograph**:
An image file referenced from a Library and used by an Edit. OpenFilm does not alter, upload, or copy it into browser-managed storage.
_Avoid_: Original, input image

**Culling**:
Reviewing a Library to record selection decisions without deleting or altering Source photographs.
_Avoid_: Cleanup, filtering

**Disposition**:
A Culling decision that marks a Photograph record as Unmarked, Pick, or Reject. Reject does not delete the Source photograph.
_Avoid_: Flag, status

**Rating**:
An optional zero-to-five-star ranking on a Photograph record, independent of its Disposition.
_Avoid_: Score, rank

**Active photograph**:
The one Photograph record that receives ordinary navigation, Rating, Disposition, and Edit commands.
_Avoid_: Current item, focused image

**Selection**:
An ordered set of Photograph records chosen for Comparison or an explicit multi-photo command. It is independent of the Active photograph.
_Avoid_: Picks, batch

**Grid**:
The Library view that presents many Photograph records as a contact sheet for scanning, ordering, filtering, and Selection.
_Avoid_: Gallery, thumbnail page

**Loupe**:
The Library view that gives the Active photograph the main stage while nearby Photograph records remain available for navigation.
_Avoid_: Single view, preview

**Comparison**:
A review of two to four Photograph records whose zoom scale and focal point may move together while each pane respects its own image bounds.
_Avoid_: Side-by-side, compare view

**Review group**:
A user-confirmed, ordered set of related Photograph records with an origin of Burst, Similarity, or Manual. A Photograph record belongs to at most one Review group, and changing membership makes its origin Manual.
_Avoid_: Stack, album, folder

**Burst group**:
A Review group proposed from consecutive Photograph records with equal camera serials and capture timestamps within the configured burst interval.
_Avoid_: Sequence, time group

**Similarity signal**:
A versioned, advisory measure of visual likeness between Photograph records. It never changes Disposition or Rating.
_Avoid_: Duplicate decision, match

**Sharpness signal**:
A versioned, advisory measure used to compare relative detail within related photographs. It is not a quality verdict and never changes Disposition or Rating.
_Avoid_: Quality score, best shot

**Final-set Export**:
The operation that turns Picks or an explicit Selection into Rendered images. It may target a resumable folder or bounded browser downloads.
_Avoid_: Batch export, output job

**Rendered image**:
An exported image whose pixels contain the adjustments and geometry from an Edit.
_Avoid_: Output file, flattened project

**Adjustment**:
One reusable image transformation within a Look, such as exposure, saturation, tone curve, vignette, or grain.
_Avoid_: Effect, setting

**Neutral Look**:
A Look whose Adjustments make no intentional visible change to a Source photograph.
_Avoid_: Empty preset, original mode

**Grain seed**:
An Edit-specific value that keeps the grain pattern stable. A Look stores grain amount and size, but not the seed.
_Avoid_: Grain preset, noise image
