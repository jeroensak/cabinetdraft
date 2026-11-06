# Cabinet Designer V1 implementation contract

The [frozen specification](../technical-specification.md) governs functional/domain behaviour. Use the [section index](SPECIFICATION_INDEX.md) before every implementation step. Never modify the specification without explicit instruction.

[Figma](https://www.figma.com/design/donKXEbUuouv3eFmWolZKY) governs visual layout/style: Designer — Preferred Direction, Designer — Fronts, and Cut List. When mockups and behaviour conflict, use the functional specification for behaviour and Figma for presentation. Do not invent additional V1 functionality.

## Architecture invariants

- Project JSON is the only persisted source of truth.
- `src/domain/**` is pure TypeScript. It must not import React, Zustand, DOM APIs, SVG APIs, Tailwind, or localStorage. Dependencies point toward the domain.
- Designer and Cut List are sibling consumers of derived domain data. Neither consumes the other's output.
- Manufacturing dimensions must never originate from SVG measurements. SVG must never read Cut List output.
- Every manufacturing formula has one canonical domain implementation. Both consumers use derived physical geometry/panels.
- Persistent objects are Project, CabinetModule, Shelf, and Front. Never persist spaces, physical panel geometry, cut-list items, SVG coordinates, total width, or validation results. Editor state is separate from Project JSON.
- All persisted measurements and manufacturing dimensions are integer millimetres, never strings such as `800mm`. Entered dimensions are outside dimensions. Derived rendering coordinates may be fractional; non-integer manufacturing sizes are invalid and must not be silently rounded.
- Module array order is left-to-right physical order. Do not persist module X coordinates or order fields.
- UI project mutations go through domain commands. React components must not mutate project arrays directly.
- Commands preserve structural invariants, including valid boundary references and non-overlapping fronts. Geometrically invalid project state may remain persisted, reloaded, exported, and imported. Never silently clamp, reposition, delete, or repair it.
- A project-wide cut list is usable only if all modules are valid.

## Construction semantics for later slices

Corpus thickness and construction settings are global. Top/bottom panels sit between full-height sides. A back panel sits behind the carcass and covers full outside width/height; carcass depth excludes its thickness when enabled. Shelves span internal width and full carcass depth, storing the absolute bottom face. Spaces are derived.

Overlay fronts reference module bottom, stable shelf IDs, or module top. A door spans contiguous spaces; a drawer front covers exactly one space. A double door is one semantic door with two leaves. Use specification sections 20–23 for canonical front gap/geometry rules, and sections 24–25 for atomic structural editing behaviour.

## Scope and sequence

No backend, accounts, cloud saving, WebGL/Three.js, materials, wood textures, hardware/hinges, drawer boxes, sheet optimization, vertical dividers, stacked modules, upper cabinets, i18n framework, mobile editor, or dark mode.

1. Foundation
2. Project model
3. Cabinet geometry + spaces
4. Front geometry
5. Validation + cut list
6. Domain commands
7. Store + history + persistence
8. Application shell
9. Isometric SVG renderer
10. Designer interaction
11. Fronts mode
12. Cut List
13. Import/export + integration
14. E2E + hardening

Every slice must leave typecheck, tests, lint, and build passing. Foundation contains only tooling, directory boundaries, documentation, and route placeholders; no project model, persistence, or cabinet calculations yet.

## Subsequent placement decision

The user approved rounding newly centred shelf positions to the nearest integer millimetre. Half-millimetre ties round toward the module top. Free spaces may consequently differ by 1 mm. This applies only to shelf placement; fractional manufacturing dimensions remain invalid. The frozen source specification is unchanged.

## Cut List PDF export

The user requested a downloadable PDF from the Cut List. Export uses validated canonical cut-list rows, includes millimetre units, and is unavailable for invalid or empty projects. PDF generation is presentation code and never persists derived data.

## Approved post-V1 extension: vertical dividers

The user explicitly requested space-level vertical dividers after V1. This supersedes the V1 vertical-divider non-goal only for this extension; the frozen specification remains unchanged. [Divider construction and editing rules](VERTICAL_DIVIDERS.md) govern the new behavior. The same Project JSON → pure domain → independent SVG/Cut List pipeline applies.

## Approved post-V1 extension: drawer boxes

The user explicitly requested simple drawer boxes after V1: reusable designs with four equal-height walls, a bottom and the existing overlay front, on undermount slides only. This supersedes the V1 drawer-box non-goal only for this extension; the frozen specification remains unchanged. [Drawer box construction and editing rules](DRAWER_BOXES.md) govern the new behavior. The same Project JSON → pure domain → independent SVG/Cut List pipeline applies.

## Approved post-V1 extension: drawer front options

The user explicitly requested a choice of drawer fronts: full or wave top, overlay or inset, and an adjustable front height. This supersedes the overlay-only front geometry of specification sections 20–23 only for drawer fronts linked to a drawer design; the frozen specification remains unchanged and doors are unaffected. [Drawer front rules](DRAWER_BOXES.md#drawer-fronts) govern the new behavior.

## Cut List parts lists

The user requested a shorter-reading Cut List. The Cut List page and PDF present the canonical rows in up to four lists, in this order: cabinet bases (sides, top, bottom, back), shelves and dividers, doors, and drawers (each drawer's front and box together). Empty lists are left out. Grouping is presentation only: `deriveCutList` output, identifiers and the columns of specification section 32 are unchanged.

The user also requested merging identical parts into one row with a quantity, the future use specification section 32 anticipates. This supersedes the one-row-per-panel rule of section 30 for display only. It is on by default, parts match on name and size across cabinets, and a merged row lists every part's ID. A checkbox restores one row per panel, on the page and in the PDF. A cabinet's top and bottom count as one part here, like left and right sides, shown as Top / bottom.

## Approved post-V1 extension: grooved drawer bottoms

The user requested a groove, half the wall thickness deep, in all four drawer walls to hold the bottom. This supersedes the "no grooves" rule of the drawer box extension. The groove depth is the one manufacturing measurement that may be a half millimetre, because it follows the wall thickness exactly; panel cut sizes remain whole millimetres. [Drawer box rules](DRAWER_BOXES.md) govern the construction.

## Approved post-V1 extension: local designs

The user requested several named designs in one browser, chosen from a dropdown above the cabinets, and starting templates for new designs. This is still local only: there is no backend, sign-in or real account. The open design stays under the existing project storage key, so its autosave and error handling follow specification section 59. The other designs live under `cabinet-designer:designs:v1`, which is never written while either key is unreadable. Switching, creating or deleting a design clears undo history. Deleting asks for confirmation, removes the open design permanently and opens a neighbouring one; the last design can't be deleted. Import still replaces the open design as specification section 62 requires, and takes a new ID only if its ID belongs to another saved design.

Duplicating copies the open design under a new ID, keeping its unit, and opens the copy.

A first visit with nothing saved opens the New design dialog instead of the example cabinet of specification section 5, which this supersedes. The dialog must be completed, the workspace stays empty behind it and nothing is stored until a design is created. Cancel appears only if saving fails. The default project remains as the fallback for browsers that can't store anything, and it never enters the design library.

Templates are project exports in `src/design-templates/`, named `template-1.json` to `template-5.json`. They appear in file name order under the project name inside each file, and are bundled at build time. A design made from a template gets its own new ID.

## Approved post-V1 extension: translations

V1 is complete, and the user explicitly requested English, Dutch, German and French, and approved a localization framework. This supersedes specification section 76 and the i18n non-goal above; the frozen specification remains unchanged. The app uses i18next with react-i18next. Locale files are `src/i18n/locales/{en,nl,de,fr}.json`, English is the source and the fallback, and a test fails if any language has different keys or placeholders.

The language is an editor preference stored under `cabinet-designer:language`, never in Project JSON. A saved choice wins, then the browser's language, then English. Domain code stays free of i18n: drawer issues expose a `reason` and `values` for the UI to word, and default names are passed in. Names already in a project are user data and are not translated. The static build metadata and `public/404.html` stay English; client-side metadata follows the language.

## Approved post-V1 extension: inset doors

The user requested doors that are either overlay or inset. This supersedes specification sections 10 and 20–23 only for inset doors; the frozen specification remains unchanged. A door may store `mount: 'inset'`; omitted means overlay, so existing projects need no migration and overlay is never written out.

An inset door sits inside its opening with `frontGap` on all four sides, its face flush with the carcass front. A double door's leaves divide the width as they do for overlay, so a non-integer leaf remains a validation problem. Any shelf or divider inside the opening of an inset door would block it, so it is set back by `frontThickness + frontGap` and its depth shrinks by the same amount. `insetDoorSetback` is the one canonical rule. The setback is derived, never stored, and panels that only bound the opening do not move.

The position last chosen for a door is an editor preference stored under `cabinet-designer:door-mount`, never in Project JSON. Every new door takes that position until another is chosen. Existing doors never change with it.

The Designer's Both view sits between Structure and Fronts. It draws the fronts see-through over the structure and keeps Structure's selection: spaces, shelves and dividers, not the fronts themselves. It changes presentation only.

## Approved post-V1 extension: inch designs

The user requested designs in inches, in the fractional notation used in America, next to millimetres, with the unit set per design so that free switching can't cause rounding errors. This supersedes the measurement rule of specification section 6 for inch designs only; the frozen specification remains unchanged.

A project with `settings.unit: 'inch'` stores every measurement as a whole number of 1/32 inch units. Omitted means millimetres, so existing projects need no migration. All domain formulas stay unit-agnostic and still require whole numbers, which keeps inch sizes exact: 1/16 inch has no whole-millimetre value, and a halved 1/16 inch size is still a whole unit. Percentage heights and centred placements round to a whole 1/32 inch, as they round to a whole millimetre otherwise. Groove depths may be half a unit, shown in 1/64ths.

Sizes of 4 feet and more are displayed in feet and inches, such as 6' 8 1/2". This is notation only: entry fields and the Cut List stay in plain inches.

The unit is chosen in the New design dialog and can't be changed afterwards. Templates are millimetre files, converted once at creation by `convertToInches`: sheet thicknesses to the nearest 1/8 inch, everything else to the nearest 1/16 inch. That rounding is why no conversion exists for a design already in use. An imported project keeps its unit. Formatting and parsing live in `src/units`; input finer than 1/32 inch is refused, never rounded.

## Cut List PDF assembly pages

The user requested a printable assembly view. After its lists, the PDF adds one page per cabinet: the structure and the fronts side by side, labelled with the cut list IDs. `deriveLabelledPanels` is the one source of those IDs for both, and the drawing uses canonical panels with the Designer's projection helpers only. The Cut List page draws only the sheet layout below.

## Approved post-V1 extension: sheet layout

The user requested a visual cut list: choose a sheet size and a saw kerf, and see the parts on the sheet, optimised for the fewest cuts above all, then for material. This supersedes the sheet nesting and optimization non-goals; the frozen specification remains unchanged. It answers none of its other V2 items: there are no materials, grain direction or purchase quantities beyond the sheets shown.

`deriveSheetLayout` in `src/domain/cutlist/sheetLayout.ts` is the one implementation. It reads validated Cut List rows, so it is another consumer of those rows and it can't change them. Parts are grouped by thickness, because the project has no materials, and may be turned, because it has no grain direction. Only guillotine cuts are used: each cut runs right across the piece it splits, with the kerf taken from the far side of the cut. A cut is counted per saw pass through one piece; stacked boards and sheet edge trimming are not considered. Plans rank by the chosen priority: fewest cuts then fewest sheets, the default the user asked for, or fewest sheets then fewest cuts. A cuts-first plan may use another sheet to save only a few cuts, which is why the choice exists. The search is repeatable, not exhaustive, so the same design always gets the same plan, which is good but not proven the best possible. Parts that fit a sheet neither way are named on the page, never dropped silently.

The Cut List page shows the layout as a Sheets view next to Parts. The PDF adds one page per sheet between its lists and its assembly pages, always, using the same saved settings and the same drawing rules, so a page can go to the saw. Parts too large for the sheet get their own page instead of being left out. Where one line of a part's ID would be too small to read, the ID breaks onto two lines, on the page and in the PDF, so a sheet at the saw still names its parts. Sheet size, kerf and priority are editor preferences stored per unit under `cabinet-designer:sheet-stock`, never in Project JSON: they describe the workshop, not the design. They default to fewest cuts on 2440 × 1220 mm with a 4 mm kerf, or on 8' × 4' with a 1/8" kerf. Like every size in a design, they are whole millimetres or 1/32 inches.

## Approved post-V1 extension: share links

The user requested sharing a design by link. There is still no backend: the design's project JSON is gzipped into the URL fragment, which browsers don't send to servers, and analytics already strip fragments. Opening a link goes through the same parse, validate and migrate boundary as a file import, asks for confirmation, and adds a new design with its own ID and its original unit instead of replacing anything. The fragment is cleared from the address bar once read. A link expanding past 5 MB is refused.

## Approved post-V1 extension: edge banding

The user requested edge banding on the Cut List: which edges of each part are banded and how much band to buy. This supersedes the edge banding non-goal of specification section 4 only for this extension, and answers that one V2 item of section 81; the frozen specification remains unchanged.

`settings.edgeBanding: true` turns it on. Omitted means off, so existing projects need no migration, and off is never written out. It is a project setting rather than an editor preference because it describes how the design is built.

`deriveEdgeBanding` in `src/domain/cutlist/edgeBanding.ts` is the one implementation. It reads Cut List rows, so it is another consumer of them and can't change them: `deriveCutList` output and the sheet layout are the same with banding on or off. Sides, tops, bottoms, shelves and dividers are banded along the one front edge, which is always their Length. Doors, including each leaf of a double door, and drawer fronts are banded on all four edges. Back panels and drawer box parts get nothing.

A wave top drawer front is treated as a straight blank, and its whole four-edge length is multiplied by 1.25 to cover the curve. A front's perimeter is an even whole number, so that result can be a half unit, like a groove depth. It is exact and never rounded, and it is only a length to buy: cut sizes stay whole units. The band's thickness is not subtracted from them.

A row's banding counts its quantity, so merged and separate rows of the same parts give the same total. The Cut List page and PDF show the banded edges per row as the last column, and the total on the Parts view and in the summary line of the PDF's list pages, in plain inches for inch designs. Derived banding data is never persisted.

## Usability and safety rules

Canvas shortcuts do nothing while a dialog is open. Tabs follow each other: a tab receiving another tab's save adopts it, clears its undo history and says so, so an older copy can't silently overwrite newer work. Names can't be blank. Cabinet sizes must be above zero and at most 100 m or 4,000 inches, which catches typing slips without setting furniture minimums. An invalid design explains why on the Designer and Cut List pages. The canvas view is editor state and survives navigation, and Settings no longer repeats the design name.
