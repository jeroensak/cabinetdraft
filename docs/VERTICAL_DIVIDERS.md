# Space-level vertical dividers

This post-V1 extension was requested by the user. The subsequent request to add shelves and fronts inside divided openings supersedes the initial full-width-only restriction. `technical-specification.md` remains frozen and governs existing V1 behavior.

## Spaces and construction

- A divider splits one space into two independently selectable spaces. A shelf splits a chosen space vertically. Both can be nested; spaces and their dimensions are always derived, never persisted.
- Dividers store a stable ID, integer-mm absolute left-face position, and bottom/top shelf or module boundary references. Shelves store a stable ID, absolute bottom-face position, and optional left/right divider references. Omitted horizontal references mean the cabinet sides.
- A shelf ends at the inside faces of its supporting side panels or dividers. A divider ends at the inside faces of its supporting horizontal panels. All use global corpus thickness and full carcass depth. Placement is centered and rounded to the nearest millimetre, with ties toward the top/right.
- Supporting references determine derivation order, regardless of persisted array order. References may not be missing or cyclic. Physical panel sizes feed the SVG and Cut List independently.

## Selection and editing

- Structure and Fronts use the same spaces; Fronts hides openings covered by an existing front.
- Shift-click an edge-adjacent space to extend selection. Shelves and drawers can be added to each selected space in one undoable action. A drawer front covers one space; multiple selected spaces receive separate drawer fronts.
- A door can cover one space or a rectangular union of adjacent spaces, vertically, horizontally, or both. An L-shaped group supports per-space actions, but cannot become one rectangular door.
- Adding a shelf or divider behind a door preserves that door. Splitting a space occupied by a drawer front creates two corresponding drawer fronts atomically.
- Removing a shelf uses the existing lower-front-wins merge rule within that shelf's column. A shelf supporting dividers cannot be removed until those dividers are removed. A divider supporting shelves or bounding fronts cannot be removed until those dependants are removed. Unrelated spaces are not modified.
- Dividers can be dragged left and right on the canvas, like shelves up and down: a live preview that commits one undo step on release, and Escape cancels it. Dragging does not snap.
- Resizing or moving panels may leave invalid geometry persisted for repair. Validation checks dimensions, supports, intersections, and the partition; an invalid project has no usable Cut List. Module properties list dividers so off-canvas positions remain repairable.

## Scoped overlay fronts

Fronts persist stable horizontal references in addition to their existing vertical references. A double door remains one semantic front with two leaves.

At an internal divider:

```text
dividerCentre = dividerLeft + corpusThickness / 2
leftFrontRight = dividerCentre - frontGap / 2
rightFrontLeft = dividerCentre + frontGap / 2
```

Outer horizontal edges retain the full front gap from the cabinet's outside edge. Vertical gaps retain the existing shelf-centre rules. For a double door, the available front span minus one center gap is divided equally between leaves. Fractional manufacturing dimensions remain invalid and are never rounded.

## Persistence

Schema version 3 adds optional horizontal shelf/front references to version 2's dividers. Version 1 saves migrate with empty divider arrays; version 2 saves retain all dividers. Legacy shelves and fronts remain full-width. IDs, dimensions and other existing data remain intact. The historic localStorage key is retained; exports use version 3. Derived rectangles, slots, coordinates and validation are not saved.
