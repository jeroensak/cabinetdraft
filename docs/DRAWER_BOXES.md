# Drawer boxes

This post-V1 extension was requested by the user. It supersedes the V1 drawer-box non-goal only for simple drawer boxes; `technical-specification.md` remains frozen and governs existing V1 behavior.

## Reusable designs

- A project owns a library of drawer designs (`Project.drawerDesigns`). A design is a construction recipe, not a placed object: it stores a stable ID, a name, the slide type, and integer-mm measurements. Width and the resulting height in millimetres are never stored; height is stored as a whole percentage of the space's inner height (1–100, default 50).
- A drawer front may reference one design through `drawerDesignId`. The same design can be applied to any number of spaces; editing it updates every drawer that uses it. A drawer front without a design remains a front only.
- Only undermount slides are supported (`slideType: 'undermount'`). All four walls are grooved to hold the bottom. No hardware, notches or drilling are generated.
- Designs in use cannot be deleted; remove the box from those drawers first. Commands reject internally inconsistent designs (blank name, non-integer measurements, side gap below 3 mm, a box too shallow for its walls, or a height outside 1–100%).

## Construction

A drawer consists of five box panels plus a drawer front:

```text
openingWidth  = space internal width (between supporting sides/dividers)
boxWidth      = openingWidth − 2 × sideClearance        (sideClearance ≥ 3 mm)
boxHeight     = round(spaceHeight × heightPercent / 100)  (all four walls equal)
sides         = boxHeight × depth × wallThickness        (full depth, outside)
box front/back= boxHeight × (boxWidth − 2 × wall) × wallThickness (between sides)
bottom        = (boxWidth − wall) × (depth − wall) × bottomThickness (in the grooves)
groove        = wall / 2 deep × bottomThickness wide, in all four walls
```

- The box sits `sideClearance` from each side of the opening, `bottomClearance` above the opening bottom, and starts at the carcass front (z = 0). The bottom slots into a groove in all four walls, half a wall thickness deep and as wide as the bottom is thick, raised by `bottomRecess` above their lower edge to clear the undermount slides. Panel cut sizes stay whole millimetres; with an odd wall thickness the groove depth is an exact half millimetre, such as 7.5 mm, and is never rounded. Grooves are derived, so saved projects need no migration, and the bottom panel of every existing design grows by one wall thickness each way.
- Percentage height is a placement choice and rounds to the nearest whole millimetre, like centred shelves. All other manufacturing dimensions remain exact and are never rounded.
- A drawer fits when `height + bottomClearance + topClearance ≤ spaceHeight`, the recessed bottom sits below the top of the walls, and `depth + rearClearance ≤ carcassDepth`, and every panel is a positive integer size. Applying a design that does not fit every target is rejected atomically. Later edits (moving shelves, resizing cabinets, changing the design) may leave a non-fitting drawer persisted for repair; validation reports it and the Cut List is unavailable until it is fixed.
- The box starts behind an inset front: `z = frontThickness`, and the depth check becomes `frontThickness + depth + rearClearance ≤ carcassDepth`.
- Splitting a space that holds a drawer creates two drawer fronts that keep the same design; each box is re-derived for its own space.

## Drawer fronts

A design also sets the front of every drawer that uses it. A drawer front without a design keeps the default full overlay front.

- `frontStyle`: `full` is the plain rectangle, on which a handle would typically go. `wave` keeps the same blank, with a top edge that stays at full height at both sides and dips smoothly to `waveDip = round(frontHeight × 0.15)` at mid-width.
- `frontMount`: `overlay` sits on the carcass front as before. `inset` sits inside the opening with `frontGap` on all four sides, its face flush with the carcass front.
- `frontHeightPercent` (1–100, default 100): `frontHeight = round(fullFrontHeight × percent / 100)`, where the full height is the overlay or inset height of that front. The bottom edge stays put and the top edge lowers. 100% leaves the exact full height unrounded.

The Cut List gives the uncut rectangular blank and names the wave dip. No handles, hardware or drilling are generated.

## Editing

The drawer designer is a separate workspace. Open it from one or more selected spaces (**Add drawer…**) or from a selected drawer front (**Open drawer designer**). It lists the design library, previews the selected design in the first target space, and applies the design to every target in one undoable action. Spaces covered by a door are never replaced. The **Drawers** section of the left menu opens the same workspace without target spaces: it lists every design for editing, previews a design in a drawer that uses it, and offers no apply action. A drawer front's properties also let you switch its design or remove its box. Designer context is editor state and is never saved.

## Persistence

Schema version 4 adds `drawerDesigns` and the optional `drawerDesignId` on drawer fronts. Version 1–3 saves and imports migrate with an empty library and unchanged designs. Schema version 5 replaces the stored `height` with `heightPercent`: an automatic height becomes 50%, and a fixed height becomes the closest whole percentage of the first drawer using that design (50% if none does), so a fixed box may change by a few millimetres and shared designs may change more. Schema version 6 adds `frontStyle`, `frontMount` and `frontHeightPercent` to designs; older designs migrate to `full`, `overlay` and 100%, so existing fronts are unchanged. Box panels, widths, heights in millimetres and fit results are derived, never saved.
