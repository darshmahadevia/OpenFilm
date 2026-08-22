# OpenFilm

OpenFilm is a browser photo editor for applying and sharing reusable film-inspired adjustments without accounts or a backend.

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

**Source photograph**:
The photograph loaded into an Edit. OpenFilm does not alter or upload it.
_Avoid_: Original, input image

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
