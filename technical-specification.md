# Cabinet Designer — V1 Product & Technical Specification

**Status:** V1 specification  
**Language:** English UI  
**Platform:** Web, desktop-first  
**Primary goal:** Allow users to configure simple modular cabinets and generate a trustworthy cut list from that configuration.

---

# 1. Product vision

Cabinet Designer is a lightweight browser-based tool for people who want to build simple sheet-material cabinets themselves.

A user should be able to:

1. Build a cabinet arrangement consisting of multiple independent cabinet modules.
2. Configure each module with shelves, doors and drawer fronts.
3. Inspect the result in an interactive isometric view.
4. Generate a cut list containing every panel required to build the configured cabinet.

The application is not intended to be a full CAD system.

Its primary value is the connection between:

**cabinet configuration → accurate manufacturing dimensions**

The generated cut list must always originate from exactly the same project data as the visual representation.

---

# 2. Core architectural principle

There is one persisted source of truth:

```text
Project JSON
    ↓
Domain model
    ↓
Derived domain data
    ├───────────────┐
    ↓               ↓
Cabinet geometry   Cut list
    ↓               ↓
Isometric SVG      Table
```

The Designer and Cut List are two independent projections of the same domain model.

They do not know about each other.

In particular:

```text
Designer page
    ↓
domain geometry
    ↓
SVG
```

and independently:

```text
Cut List page
    ↓
deriveCutList(project)
    ↓
table
```

The cut list must never use measurements calculated by SVG components.

The SVG must never use measurements calculated by the cut-list implementation.

React components must not contain cabinet construction formulas.

---

# 3. V1 scope

V1 supports simple floor-standing cabinet modules.

Each module is an independent rectangular carcass.

Modules can only be positioned horizontally next to each other.

All modules:

- align along their front edge;
- align along their bottom edge;
- may have different widths;
- may have different heights;
- may have different depths.

Adjacent modules remain independent carcasses.

Therefore:

```text
Cabinet A | Cabinet B
```

contains two adjacent side panels rather than one shared divider.

Shared side panels or combined carcasses are explicitly outside V1.

---

# 4. Explicit V1 non-goals

V1 does not support:

- stacked cabinets;
- wall cabinets placed above other cabinets;
- shared vertical partitions;
- vertical subdivisions inside a module;
- arbitrary compartment grids;
- material selection;
- wood textures;
- grain direction;
- edge banding;
- hinges;
- drawer runners;
- drawer boxes;
- hardware calculations;
- drilling patterns;
- construction joints;
- dadoes or grooves;
- recessed back panels;
- sheet nesting;
- sheet optimization;
- calculating how many full sheets need to be purchased;
- accounts;
- cloud storage;
- collaboration;
- backend services;
- WebGL or true 3D;
- mobile editing;
- localization UI;
- dark mode.

Sheet optimization is a possible V2 feature.

---

# 5. Initial project

A new user starts directly in the Designer.

There is no dashboard.

A new project initially contains one example cabinet.

Default project name:

```text
Untitled cabinet
```

Default global settings:

```text
Corpus thickness:     18 mm
Back panel:           enabled
Back panel thickness: 3 mm
Front thickness:      18 mm
Front gap:            2 mm
```

Default cabinet:

```text
Width:  800 mm
Height: 2200 mm
Depth:  600 mm
```

It initially contains:

- one shelf;
- positioned so the two free interior spaces have equal height;
- one double-door front;
- spanning the complete cabinet height.

For the default dimensions this results in a shelf whose lower face is at:

```text
1091 mm
```

from the bottom outside edge of the cabinet.

---

# 6. Measurement conventions

All persisted measurements use:

```text
integer millimetres
```

Examples:

```ts
width: 800
height: 2200
```

No dimensional strings such as `"800mm"` are stored.

No floating-point millimetre values are stored in project data.

Derived rendering coordinates may use floating-point numbers.

All dimensions entered by the user represent **outside dimensions**.

---

# 7. Global project settings

Construction settings belong to the project rather than individual modules.

Conceptually:

```ts
interface ProjectSettings {
  corpusThickness: number;
  backPanelEnabled: boolean;
  backPanelThickness: number;
  frontThickness: number;
  frontGap: number;
}
```

All modules use the same:

- corpus thickness;
- back-panel state;
- back-panel thickness;
- front thickness;
- front gap.

The back panel is therefore globally enabled or disabled.

---

# 8. Cabinet construction

Given:

```text
W = outside width
H = outside height
D = outside depth
T = corpus thickness
B = back-panel thickness
```

When a back panel is enabled:

```text
carcassDepth = D - B
```

When no back panel is enabled:

```text
carcassDepth = D
```

The entered outside depth therefore always includes the back panel.

Example:

```text
Outside depth:        600
Back-panel thickness:   3
Carcass depth:        597
```

---

# 9. Carcass construction

The two side panels run the full outside height.

Top and bottom panels sit **between the side panels**.

For:

```text
800 × 2200 × 600
18 mm corpus
3 mm back
```

the basic carcass produces:

```text
Side panel
2 × 2200 × 597 × 18

Top/bottom
2 × 764 × 597 × 18

Back
1 × 2200 × 800 × 3
```

where:

```text
internalWidth = W - 2T
```

The back panel is mounted fully behind the carcass.

It covers the complete outside width and height.

---

# 10. Shelves

Shelves sit between the side panels.

Shelf dimensions are:

```text
shelfLength = internalWidth
shelfDepth  = carcassDepth
shelfThickness = corpusThickness
```

There is no front setback in V1.

A shelf therefore uses the entire available carcass depth.

---

# 11. Shelf coordinates

Each shelf has a stable ID and an absolute vertical position.

Conceptually:

```ts
interface Shelf {
  id: string;
  bottom: number;
}
```

`bottom` represents the vertical coordinate of the **bottom face of the shelf**, measured from the outside bottom of the module.

The UI does not normally present this absolute value.

Instead it presents the free vertical distance from the horizontal panel directly below it.

For the first shelf, the lower reference is the top of the cabinet bottom panel.

For later shelves, the lower reference is the top of the previous shelf.

Example:

```text
Shelf 2 bottom
──────────────

       ↑
     500 mm
       ↓

──────────────
Shelf 1 top
```

The user sees:

```text
Height above previous shelf: 500 mm
```

while the domain stores an absolute shelf coordinate.

This prevents moving one shelf from implicitly moving every shelf above it.

---

# 12. Spaces

Spaces are not persisted.

They are derived from:

- cabinet dimensions;
- bottom panel;
- top panel;
- sorted shelves.

For example:

```text
┌───────────┐
│ Space 3   │
├───────────┤ Shelf 2
│ Space 2   │
├───────────┤ Shelf 1
│ Space 1   │
└───────────┘
```

Conceptually:

```ts
deriveSpaces(module): Space[]
```

A derived space contains sufficient information such as:

```ts
interface Space {
  bottomBoundary: Boundary;
  topBoundary: Boundary;

  bottom: number;
  top: number;
  height: number;
}
```

Spaces do not have persistent IDs.

---

# 13. Boundaries

Fronts reference stable structural boundaries rather than generated space IDs.

A boundary is conceptually one of:

```ts
type Boundary =
  | { type: 'module-bottom' }
  | { type: 'shelf'; shelfId: string }
  | { type: 'module-top' };
```

This makes a front resilient when a new shelf is inserted behind it.

---

# 14. Adding shelves

A shelf is always added **to a selected space**.

There is no global "split largest space" behaviour.

When the user selects a space and chooses:

```text
Add shelf
```

the new shelf is placed halfway through the available free height.

The shelf thickness itself must be taken into account.

For a free space of 1000 mm using an 18 mm shelf:

```text
491 mm free
18 mm shelf
491 mm free
```

not:

```text
500 + 18 + 500
```

The newly created spaces are derived automatically.

---

# 15. Moving shelves

A shelf can be moved through:

- dragging in the Designer;
- entering an exact numeric value.

Numeric input allows exact integer-millimetre positioning.

Dragging may snap to 10 mm increments.

Snapping is a UX convenience only and is not a domain requirement.

While dragging:

- the SVG updates live;
- the current dimension is displayed.

On drag end:

- exactly one project mutation is committed;
- exactly one undo-history entry is created.

---

# 16. Front model

V1 supports two front types:

```text
door
drawer front
```

A front is semantic domain data.

It does not persist:

- X/Y rendering coordinates;
- calculated width;
- calculated height.

Those are derived.

Conceptually:

```ts
type Front =
  | DoorFront
  | DrawerFront;
```

---

# 17. Doors

A door may cover one or more **contiguous vertical spaces**.

A door always spans the full cabinet width.

Because V1 has no vertical partitions, partial-width compartments do not exist.

A door stores its vertical structural range:

```ts
interface DoorFront {
  id: string;
  type: 'door';

  bottomBoundary: Boundary;
  topBoundary: Boundary;

  leaves: 1 | 2;
}
```

A double door is one semantic `DoorFront` with:

```ts
leaves: 2
```

It is not persisted as two independent doors.

The geometry and cut-list derivations produce two physical panels.

---

# 18. Drawer fronts

A drawer front belongs to exactly one space.

Conceptually:

```ts
interface DrawerFront {
  id: string;
  type: 'drawer';

  bottomBoundary: Boundary;
  topBoundary: Boundary;
}
```

Drawer boxes are outside V1.

Only the visible front is generated.

A space can contain at most one drawer front.

---

# 19. Space/front exclusivity

Every derived space can have:

```text
no front
OR
one door
OR
one drawer front
```

Never multiple fronts.

A door may cover several spaces.

Those spaces are all considered occupied by the same door.

Overlapping front ranges are invalid and domain commands must prevent them from being created.

---

# 20. Horizontal front geometry

Let:

```text
W = cabinet outside width
G = front gap
```

A single full-width front has:

```text
frontWidth = W - 2G
```

It starts `G` from the left outside edge and finishes `G` before the right outside edge.

For two door leaves:

```text
availableWidth = W - 3G

leafWidth = availableWidth / 2
```

This accounts for:

- left outside gap;
- centre gap;
- right outside gap.

Example:

```text
W = 800
G = 2

availableWidth = 794
leafWidth = 397
```

Both resulting door leaves are:

```text
397 mm wide
```

If this division ever produces a non-integer millimetre result, the configuration must not silently round manufacturing dimensions.

It must instead be reported as a validation problem until a deterministic V1 rounding policy is explicitly introduced.

---

# 21. Vertical front geometry

Front gaps must visually and physically remain 2 mm.

Internal horizontal shelves are shared visually between the front below and the front above.

For an internal shelf:

```text
shelfBottom = S
shelfThickness = T
shelfCentre = S + T / 2
```

If two separate fronts meet at that shelf:

```text
lowerFrontTop = shelfCentre - G / 2
upperFrontBottom = shelfCentre + G / 2
```

This produces exactly:

```text
G
```

millimetres of gap centred over the shelf.

Each adjacent front therefore covers approximately half of the shelf face while respecting the configured gap.

A shelf lying **inside** one larger door range has no effect on that door's dimensions. The door simply covers the complete shelf behind it.

---

# 22. Outer front geometry

If a front touches the bottom of the cabinet:

```text
frontBottom = G
```

This means it covers the entire bottom panel except for the outer gap.

If a front touches the top of the cabinet:

```text
frontTop = H - G
```

This means it covers the entire top panel except for the outer gap.

Therefore a full-height front has:

```text
frontHeight = H - 2G
```

Example:

```text
H = 2200
G = 2

frontHeight = 2196
```

This rule applies equally to doors and drawer fronts.

---

# 23. Fronts bounded by internal shelves

For a front whose lower boundary is an internal shelf:

```text
frontBottom =
  lowerShelfCentre + G / 2
```

For a front whose upper boundary is an internal shelf:

```text
frontTop =
  upperShelfCentre - G / 2
```

Its physical height is:

```text
frontHeight = frontTop - frontBottom
```

The same calculation is used for:

- doors;
- drawer fronts.

This provides one consistent front geometry system.

---

# 24. Adding a shelf inside an existing front

Structural editing is allowed to deterministically update dependent front structure.

### Empty space

Adding a shelf to an empty space results in:

```text
empty space
→
empty space
shelf
empty space
```

### Door-covered space

Adding a shelf to a space covered by a door leaves the door unchanged.

The new shelf simply exists behind the door.

Example:

```text
one door covering A
```

becomes:

```text
one door covering A1 + A2
```

The door's persisted boundaries do not need to change when the newly inserted shelf lies inside its range.

### Drawer-covered space

Adding a shelf to a drawer space converts:

```text
1 drawer front
```

into:

```text
drawer front
shelf
drawer front
```

The original drawer-front object is removed and two new drawer fronts are created.

---

# 25. Removing a shelf

Removing a shelf merges its two adjacent spaces.

If the same door already spans both spaces, that door simply remains unchanged.

For other combinations the resulting merged space inherits one front configuration according to this priority rule:

```text
existing front > empty
```

If only one side has a front, that front survives and expands to cover the merged space.

If both sides contain different front configurations:

```text
the lower space wins
```

Examples:

```text
door + empty
→ door
```

```text
empty + drawer
→ drawer
```

```text
door above + drawer below
→ drawer
```

```text
drawer above + door below
→ door
```

Any losing front object is removed.

The surviving front's boundaries are updated to cover the newly merged space.

All of this occurs atomically inside the domain command.

---

# 26. Editing module dimensions

Changing:

- width;
- height;
- depth;

does not move shelves to try to preserve a valid layout.

Stored shelf coordinates remain unchanged.

Derived geometry recalculates from the new cabinet dimensions.

If a previously valid shelf position becomes impossible, the project becomes invalid.

The application must not silently:

- reposition it;
- delete it;
- clamp it.

Example:

```text
Cabinet height:
2200 → 800
```

with a shelf still positioned above the new valid interior region causes a validation error.

---

# 27. Validation philosophy

There are two layers:

## Domain commands

Commands prevent structurally impossible state.

Examples:

- overlapping front assignments;
- referencing a non-existent shelf;
- adding a drawer front to a space already occupied by another front.

## Validation

Validation detects geometrically impossible but representable project state.

Examples:

- shelf outside the usable interior height;
- impossible cabinet dimensions;
- negative internal width;
- back thickness greater than depth;
- front dimensions ≤ 0;
- non-integer physical panel size where no rounding policy exists.

The application may persist invalid projects.

Invalid projects remain invalid after:

- reload;
- export;
- import.

Nothing is silently repaired.

---

# 28. Minimum dimensional rules

V1 does not impose arbitrary furniture-design minimums such as:

```text
cabinet must be at least 200 mm wide
```

Instead the dimensions must only be geometrically constructible.

At minimum:

```text
width > 2 × corpusThickness
height > 2 × corpusThickness
```

and when a back panel exists:

```text
depth > backPanelThickness
```

Derived panels and spaces must have positive dimensions.

---

# 29. Cut-list availability

The Cut List page can be opened while the project is invalid, but it must not present invalid manufacturing dimensions as usable output.

The page should clearly communicate:

```text
Cut list unavailable
Resolve configuration errors in the Designer first.
```

A project-wide cut list is considered usable only when all modules are valid.

---

# 30. Cut-list derivation

The cut list is entirely derived.

It is never persisted in project JSON.

Conceptually:

```ts
deriveCutList(project): CutListItem[]
```

Each physical panel receives its own cut-list item.

V1 does not aggregate identical pieces from different modules.

This prioritizes identification and labelling over compactness.

Example:

```text
C1-S1
C2-S1
```

remain separate rows even when their dimensions are identical.

---

# 31. Cut-list identifiers

Human-readable identifiers should contain module context.

Examples:

```text
C1-SIDE-L
C1-SIDE-R
C1-TOP
C1-BOTTOM
C1-SHELF-1
C1-BACK
C1-DOOR-1-L
C1-DOOR-1-R
C2-SHELF-2
```

Exact presentation naming may evolve, but identifiers must be deterministic and understandable.

Persistent UUIDs do not need to be exposed directly to users.

---

# 32. Cut-list table

The V1 table contains at least:

| ID | Cabinet | Part | Qty | Length | Width | Thickness |
|---|---|---|---:|---:|---:|---:|

V1 generally uses:

```text
Qty = 1
```

because physical parts are listed independently.

The field remains useful for future grouped output.

Dimension convention:

```text
Side:
Length = cabinet height
Width  = carcass depth

Top/bottom/shelf:
Length = internal cabinet width
Width  = carcass depth

Back:
Length = cabinet height
Width  = cabinet width

Front:
Length = front height
Width  = front width
```

Thickness comes from the appropriate project setting.

---

# 33. Project model

Conceptually:

```ts
interface Project {
  schemaVersion: number;

  id: string;
  name: string;

  settings: ProjectSettings;

  modules: CabinetModule[];
}
```

---

# 34. Module model

Conceptually:

```ts
interface CabinetModule {
  id: string;
  name: string;

  width: number;
  height: number;
  depth: number;

  shelves: Shelf[];
  fronts: Front[];
}
```

Module array order represents physical left-to-right order.

No persistent fields such as these should exist:

```text
x
screenX
order
position
```

---

# 35. Module physical arrangement

If project modules are:

```text
A: 600 wide
B: 800 wide
C: 500 wide
```

their physical horizontal origins are derived as:

```text
A.x = 0
B.x = 600
C.x = 1400
```

Total project width is:

```text
1900 mm
```

All modules share:

```text
bottom = 0
front = 0
```

Different cabinet depths extend backwards.

Different cabinet heights extend upwards.

---

# 36. Total dimensions shown in Designer

The Designer always displays:

- total cabinet arrangement width;
- maximum cabinet height.

These remain visible even when nothing is selected.

Other measurements are contextual.

---

# 37. Persistent IDs

Persistent structural objects receive stable IDs:

- project;
- cabinet module;
- shelf;
- front.

Derived objects do not require stable persistent IDs.

In particular:

```text
spaces
SVG primitives
cut-list entries
geometry objects
```

are derived.

---

# 38. Module duplication

Each cabinet module exposes:

```text
Duplicate
```

Duplicating creates a complete independent copy.

It receives:

- new module ID;
- new shelf IDs;
- new front IDs.

Front boundary references to shelves are translated to the corresponding newly created shelf IDs.

No relation remains between original and duplicate.

The new module is inserted directly to the right of the source module.

Default naming:

```text
Wardrobe
→
Wardrobe copy
```

with collision-safe naming as needed.

---

# 39. Module creation

`Add cabinet` creates a new empty carcass using sensible default dimensions.

It does not copy the currently selected module.

Copying is explicitly performed through:

```text
Duplicate
```

---

# 40. Module ordering

Modules can be reordered using drag and drop in the module list.

They are not reordered by dragging the isometric rendering.

Changing order changes:

```text
project.modules[]
```

and therefore the derived physical layout.

---

# 41. Designer layout

Desktop is the primary editing environment.

Recommended application structure:

```text
┌────────────────────────────────────────────────────────────┐
│ Header / project controls                                  │
├──────────────┬─────────────────────────────┬───────────────┤
│ Cabinet list │                             │ Properties    │
│              │    Isometric Designer       │               │
│              │                             │               │
├──────────────┴─────────────────────────────┴───────────────┤
│ optional status / validation                               │
└────────────────────────────────────────────────────────────┘
```

The layout should feel like a modern productivity tool rather than traditional CAD software.

---

# 42. Visual design direction

The visual direction combines:

```text
modern developer tool
+
modern product configurator
```

Characteristics:

- light mode only;
- generous but not excessive whitespace;
- calm neutral surfaces;
- crisp typography;
- thin borders;
- clear hierarchy;
- limited accent colour;
- strong selection state;
- high enough contrast for technical work;
- minimal decoration;
- no visual noise;
- no faux wood;
- no textures;
- no photorealism.

The user should be able to think about dimensions without the interface competing for attention.

---

# 43. Designer rendering

The cabinet visualization uses:

```text
SVG
```

with an isometric 2D projection.

V1 explicitly does not use:

- WebGL;
- Three.js;
- 3D meshes.

The isometric renderer receives derived cabinet geometry and converts that geometry into SVG primitives.

No manufacturing dimensions originate in the renderer.

---

# 44. Structure and Front view

The Designer has a simple view toggle:

```text
Structure | Fronts
```

## Structure

Shows carcass structure such as:

- sides;
- top;
- bottom;
- shelves.

This is the primary editing mode.

## Fronts

Shows:

- doors;
- drawer fronts.

There is no need in V1 for:

- transparent fronts;
- animated hinges;
- opening doors;
- exploded views.

---

# 45. Selection

Selection is editor-only state.

Conceptually:

```ts
type Selection =
  | { type: 'module'; moduleId: string }
  | { type: 'shelf'; moduleId: string; shelfId: string }
  | { type: 'space'; moduleId: string; boundaries: SpaceBoundaries }
  | { type: 'front'; moduleId: string; frontId: string }
  | null;
```

Selection is not persisted in project JSON.

If an edit destroys the selected derived space:

```text
selection = null
```

The application does not attempt sophisticated selection migration.

---

# 46. Multiple space selection

Multiple adjacent spaces can be selected for creating a door spanning several spaces.

Desktop interaction:

```text
Shift + click
```

Only contiguous spaces can form a door range.

---

# 47. Linked module hover

Cabinet-module hover is synchronized between:

- module list;
- SVG.

Hovering a module in either location highlights the corresponding module in the other.

This does not change selection.

Shelves, spaces and fronts only require hover behaviour in the SVG.

---

# 48. Module list

The left-side list deliberately remains shallow.

Example:

```text
Cabinets

⠿ Cabinet 1
⠿ Cabinet 2
⠿ Cabinet 3

+ Add cabinet
```

Do not create a CAD-style object tree containing every:

- shelf;
- door;
- drawer;
- space.

Those elements are edited contextually through the visualization.

---

# 49. Contextual actions

Selecting a module may expose:

```text
Add shelf
Duplicate
Delete
```

Selecting a space exposes actions such as:

```text
Add shelf
Add door
Add drawer front
```

Selecting several contiguous spaces exposes:

```text
Add door
```

Selecting an existing front allows:

- front deletion;
- door leaf count changes when applicable.

Actions should be contextual rather than based on a separate drawing-tool palette.

---

# 50. Contextual dimensions

Most dimension lines are only shown for the current selection.

The interface must not permanently display every measurement.

Permanent high-level measurements:

```text
total arrangement width
maximum arrangement height
```

When a cabinet or component is selected, relevant local measurements become visible.

This keeps the visualization readable.

---

# 51. Properties panel

The right-side properties panel displays editable fields relevant to the current selection.

For a cabinet:

```text
Name
Width
Height
Depth
Duplicate
Delete
```

Global construction settings are exposed separately at project level.

They are not repeated for every module.

---

# 52. Input editing behaviour

Dimension inputs use draft state.

Typing:

```text
800
→
''
→
9
→
90
→
900
```

must not create multiple domain-history states.

A value is committed on:

```text
Enter
or
blur
```

One committed value change creates one undo operation.

---

# 53. Undo and redo

V1 supports undo/redo.

Keyboard shortcuts:

```text
Ctrl/Cmd + Z
Ctrl/Cmd + Shift + Z
```

History applies to meaningful project mutations.

Examples:

- add shelf;
- remove shelf;
- move shelf;
- resize cabinet;
- add/remove front;
- add module;
- duplicate module;
- reorder module.

Editor-only state is excluded.

Examples excluded from history:

- hover;
- selection;
- zoom;
- pan;
- open menus.

Conceptually:

```text
past[] ← present → future[]
```

No heavy undo framework is required unless implementation evidence shows one is beneficial.

---

# 54. Delete behaviour

Selected:

- module;
- shelf;
- front;

can be deleted using:

```text
Delete
Backspace
```

A visible delete action also exists in the relevant properties UI.

Deleting an entire module may request confirmation.

Deleting smaller reversible elements does not need confirmation because undo exists.

---

# 55. Canvas navigation

The SVG canvas supports:

- zoom;
- pan;
- Fit to view.

Mouse wheel / trackpad may control zoom.

Dragging empty canvas may pan.

The application should automatically fit the project when:

- initially loaded;
- adding a cabinet would otherwise place it outside the visible viewport.

It must not aggressively refit after every edit.

No minimap is required.

---

# 56. Designer errors

Invalid geometry should be clearly visible.

The UI may show:

```text
Cabinet 2 contains invalid geometry
```

and highlight the problematic module/component.

The application must distinguish:

```text
selected
hovered
invalid
```

visually.

Invalid state must not rely only on subtle colour differences.

---

# 57. Navigation

V1 contains two primary application views:

```text
Designer
Cut List
```

These may be implemented as SPA routes such as:

```text
/designer
/cut-list
```

or equivalent route-based navigation.

They share project state but not rendering logic.

---

# 58. Cut List view

The Cut List page is deliberately simpler than the Designer.

Its primary content is:

- project name;
- validation status;
- cut-list table.

It does not render the cabinet SVG.

It derives its output directly from the project/domain functions.

---

# 59. Local persistence

There is no backend in V1.

The current project is automatically persisted to:

```text
localStorage
```

Closing and reopening the browser restores the latest local project.

Persistence must serialize only project data.

Do not persist derived geometry or cut lists.

---

# 60. JSON export

Users can export the current project to a human-readable JSON file.

The export contains the persisted domain model.

Conceptually:

```json
{
  "schemaVersion": 1,
  "id": "...",
  "name": "...",
  "settings": {},
  "modules": []
}
```

The format should remain understandable when opened manually.

Avoid opaque compressed or normalized structures unless later migrations require them.

---

# 61. Schema versioning

Project JSON contains:

```text
schemaVersion
```

from V1 onward.

Imports must go through an import/migration boundary rather than directly assuming the imported object matches the current TypeScript interface.

Conceptually:

```text
raw JSON
   ↓
parse
   ↓
validate
   ↓
migrate
   ↓
current Project
```

This makes future schema migrations possible.

---

# 62. JSON import

Import replaces the current project.

Projects are not merged.

Before replacement, the UI asks for confirmation:

```text
Replace current design with imported project?
```

Imported data must be:

- syntactically parsed;
- schema validated;
- version checked/migrated;
- domain validated.

Malformed imports must never partially mutate the current project.

---

# 63. Project and cabinet names

Projects have editable names.

Cabinet modules have editable names.

Defaults:

```text
Untitled cabinet

Cabinet 1
Cabinet 2
Cabinet 3
```

Names appear where helpful in:

- module navigation;
- validation;
- cut list.

---

# 64. State architecture

A lightweight editor store is appropriate.

Zustand is the preferred V1 choice.

The store may contain:

```text
project
history
selection
hover
viewport state
```

but derived data must not be persisted as authoritative state.

Do not store redundant values such as:

```text
spaces
calculated front dimensions
cut list
SVG coordinates
total project width
```

when they can be deterministically derived.

---

# 65. Domain commands

UI components must not mutate project structures directly.

Forbidden style:

```ts
project.modules[2].shelves.push(...)
```

All project mutations go through explicit domain operations.

Representative commands include:

```text
createProject
addModule
duplicateModule
deleteModule
renameModule
reorderModules

setModuleDimensions

addShelfToSpace
moveShelf
removeShelf

addDoor
setDoorLeaves
addDrawerFront
removeFront

updateProjectSettings
```

Commands are responsible for preserving structural invariants.

---

# 66. Domain purity

The domain layer is pure TypeScript.

It must not depend on:

- React;
- DOM APIs;
- SVG;
- Zustand;
- Tailwind;
- localStorage.

Its behaviour should be runnable from:

```text
unit tests
Node
browser
future CLI
future backend
```

without UI dependencies.

---

# 67. Suggested code boundaries

Exact filenames may evolve, but architecture should resemble:

```text
src/
  domain/
    project/
    cabinet/
    spaces/
    fronts/
    geometry/
    validation/
    cutlist/
    commands/
    import-export/

  store/

  editor/
    canvas/
    module-list/
    properties/

  cut-list/

  components/

  app/
```

Dependencies should flow toward the domain rather than away from it.

---

# 68. Derived geometry pipeline

Conceptually:

```text
Project
  ↓
derive cabinet geometry
  ↓
world-space panel geometry
  ↓
isometric projection
  ↓
SVG primitives
```

The isometric projection is presentation logic.

The cabinet geometry preceding it is domain/geometry logic.

This distinction is important.

---

# 69. Cut-list pipeline

Conceptually:

```text
Project
  ↓
validate
  ↓
derive physical panels
  ↓
map panels to CutListItem[]
  ↓
render table
```

Ideally both Designer geometry and Cut List operate on a common representation of physical panels where appropriate.

For example:

```text
SidePanel
ShelfPanel
BackPanel
FrontPanel
```

may form a shared derived physical model.

Neither page should duplicate construction formulas.

---

# 70. Testing strategy

Domain correctness is more important than UI snapshot coverage.

Use:

```text
Vitest
```

from the start.

Unit tests are required for:

- carcass dimensions;
- back-panel depth reduction;
- shelf dimensions;
- space derivation;
- shelf insertion;
- shelf removal;
- front-range behaviour;
- drawer splitting;
- door persistence when adding shelves;
- front geometry;
- front gaps;
- one-door dimensions;
- two-door dimensions;
- validation;
- duplication;
- module ordering;
- cut-list generation;
- import/export;
- schema parsing/migration.

---

# 71. Critical calculation tests

Representative deterministic cases must be encoded as tests.

Example:

```text
Cabinet:
800 × 2200 × 600

Corpus:
18

Back:
3
```

must derive:

```text
2 × side:
2200 × 597 × 18

top:
764 × 597 × 18

bottom:
764 × 597 × 18

back:
2200 × 800 × 3
```

Full-height double doors with 2 mm gaps derive:

```text
height = 2196
width  = 397
thickness = frontThickness
quantity = 2
```

These calculations should never depend on UI tests.

---

# 72. End-to-end testing

Do not start the project with extensive E2E coverage.

After the editor has stabilized, add a small number of Playwright happy-path tests.

Representative flow:

```text
create/open project
→ add cabinet
→ add shelf
→ add door
→ switch to Cut List
→ verify expected parts
```

Domain tests remain the primary correctness guarantee.

---

# 73. Frontend technology

Required:

```text
TypeScript
Tailwind CSS
```

Preferred V1 application setup:

```text
Vite
React
TypeScript
```

React is a UI choice only.

The domain architecture must remain framework-independent.

A heavy UI/component framework is not required.

Reusable accessible primitives may be introduced where they reduce implementation complexity, but dependencies should remain conservative.

---

# 74. Project initialization

Codex receives an empty folder.

The initial implementation step should initialize the project using standard current CLIs so that current stable package versions are selected at implementation time.

Package manager:

```text
pnpm
```

The foundation step includes at least:

- Vite;
- React;
- TypeScript;
- Tailwind;
- Vitest;
- basic lint/typecheck tooling;
- initial folder boundaries.

Avoid manually pinning versions in prompts unless a compatibility issue requires it.

---

# 75. Deployment

V1 targets:

```text
Vercel
```

The application is fully client-side and does not require server functionality.

Deployment concerns must not leak into the domain architecture.

---

# 76. Internationalization

V1 supports English only.

Do not introduce a localization framework in V1.

However:

- domain errors should preferably use codes/data rather than UI sentences;
- business logic must not depend on English strings;
- UI copy should remain reasonably centralized and separable.

This should make future i18n straightforward without introducing premature infrastructure.

---

# 77. Responsive behaviour

Desktop is the supported editor environment.

Tablet support is secondary.

Mobile editing is explicitly outside V1.

On a viewport that is too narrow to use the editor effectively, the application may show an explanatory state asking the user to open the project on a larger screen.

Do not spend V1 development effort building a complex mobile cabinet editor.

---

# 78. Performance expectations

V1 targets normal hobbyist cabinet projects rather than industrial CAD scale.

A realistic project might contain:

```text
1–20 cabinet modules
dozens of shelves/fronts
```

The architecture should remain efficient for substantially more than the expected normal case, but no virtualization or spatial indexing should be added without evidence that it is necessary.

Prefer simple derived calculations and memoization at sensible boundaries.

Do not prematurely optimize the domain model.

---

# 79. Reliability rule

A manufacturing dimension must have exactly one implementation.

For example, the formula determining a door's physical height must not independently exist in:

```text
SVG rendering
Cut List
Properties panel
validation
```

There should be one canonical derived geometry function whose result is consumed wherever that dimension is needed.

This is one of the most important architectural requirements of the project.

---

# 80. V1 completion criteria

V1 is successful when a user can:

1. Open the application and start with the example cabinet.
2. Add multiple independent cabinet modules.
3. Set different dimensions per module.
4. Reorder and duplicate modules.
5. Add, position and remove shelves.
6. Add single or double doors over one or more contiguous spaces.
7. Add drawer fronts to individual spaces.
8. See those edits reflected in a clear isometric SVG.
9. Toggle between structural and front views.
10. Undo and redo edits.
11. Close and reopen the application without losing the project.
12. Export and import project JSON.
13. View configuration errors rather than having them silently corrected.
14. Open a separate Cut List page.
15. Receive an accurate list of all physical panels needed to construct the valid project.

The defining V1 acceptance test is:

> A user can configure a simple multi-module cabinet in the Designer, switch to Cut List, cut every listed panel at the specified dimensions, and those panels correspond to the cabinet configuration shown in the Designer.

---

# 81. Future V2 directions

Potential later extensions, not architectural requirements for V1:

```text
sheet nesting / cut optimization
required sheet quantity
material libraries
different corpus/front materials
edge banding
grain direction
drawer boxes and runner systems
shared partitions
vertical divisions
upper cabinets
true 3D/WebGL
saved cloud projects
accounts
project sharing
PDF/export formats
localization
```

The V1 domain architecture should make these possible without designing them prematurely.