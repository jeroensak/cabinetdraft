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
