# Drawer boxes

This post-V1 extension was requested by the user. It supersedes the V1 drawer-box non-goal only for simple drawer boxes; `technical-specification.md` remains frozen and governs existing V1 behavior.

## Reusable designs

- A project owns a library of drawer designs (`Project.drawerDesigns`). A design is a construction recipe, not a placed object: it stores a stable ID, a name, the slide type, and integer-mm measurements. Width and automatic height are never stored.
- A drawer front may reference one design through `drawerDesignId`. The same design can be applied to any number of spaces; editing it updates every drawer that uses it. A drawer front without a design remains a front only.
- Only undermount slides are supported (`slideType: 'undermount'`). No hardware, grooves, notches or drilling are generated.
- Designs in use cannot be deleted; remove the box from those drawers first. Commands reject internally inconsistent designs (blank name, non-integer measurements, side gap below 3 mm, a box too shallow for its walls, or a bottom that does not fit below a fixed side height).

## Construction

A drawer consists of five box panels plus the existing overlay drawer front:

```text
openingWidth  = space internal width (between supporting sides/dividers)
boxWidth      = openingWidth − 2 × sideClearance        (sideClearance ≥ 3 mm)
boxHeight     = fixed height, or round(spaceHeight / 2)  (all four walls equal)
sides         = boxHeight × depth × wallThickness        (full depth, outside)
box front/back= boxHeight × (boxWidth − 2 × wall) × wallThickness (between sides)
bottom        = (boxWidth − 2 × wall) × (depth − 2 × wall) × bottomThickness
```

- The box sits `sideClearance` from each side of the opening, `bottomClearance` above the opening bottom, and starts at the carcass front (z = 0). The bottom sits between all four walls, raised by `bottomRecess` above their lower edge to clear the undermount slides.
- Automatic height is a placement choice and rounds to the nearest whole millimetre, like centred shelves. All other manufacturing dimensions remain exact and are never rounded.
- A drawer fits when `height + bottomClearance + topClearance ≤ spaceHeight` and `depth + rearClearance ≤ carcassDepth`, and every panel is a positive integer size. Applying a design that does not fit every target is rejected atomically. Later edits (moving shelves, resizing cabinets, changing the design) may leave a non-fitting drawer persisted for repair; validation reports it and the Cut List is unavailable until it is fixed.
- Splitting a space that holds a drawer creates two drawer fronts that keep the same design; each box is re-derived for its own space.

## Editing

The drawer designer is a separate workspace. Open it from one or more selected spaces (**Add drawer…**) or from a selected drawer front (**Open drawer designer**). It lists the design library, previews the selected design in the first target space, and applies the design to every target in one undoable action. Spaces covered by a door are never replaced. The **Drawers** section of the left menu opens the same workspace without target spaces: it lists every design for editing, previews a design in a drawer that uses it, and offers no apply action. A drawer front's properties also let you switch its design or remove its box. Designer context is editor state and is never saved.

## Persistence

Schema version 4 adds `drawerDesigns` and the optional `drawerDesignId` on drawer fronts. Version 1–3 saves and imports migrate with an empty library and unchanged designs. Box panels, widths, automatic heights and fit results are derived, never saved.
