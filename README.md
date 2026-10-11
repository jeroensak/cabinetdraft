# Cabinet Designer V1

A desktop cabinet editor built with Vite, React, TypeScript, Tailwind CSS, React Router, and Zustand. The Designer supports module management, shelves, semantic fronts, and undo/redo. The independent Cut List derives manufacturing panels from the same pure domain geometry and blocks output for invalid projects.

Project settings and names are editable. Only Project JSON is autosaved; editor state and drag previews remain transient. Export creates readable V1 JSON. Import validates schema and structural invariants before confirmation, accepts invalid geometry without repair, and replaces the design as one undoable action.

Read the [implementation contract](docs/IMPLEMENTATION_CONTRACT.md) and [frozen specification index](docs/SPECIFICATION_INDEX.md) before making changes. The specification must not be edited without explicit instruction.

## Development

Use Node.js 24 LTS (`.nvmrc`) and pnpm (version recorded in `package.json`).

```sh
pnpm install
pnpm dev
```

Open `/designer` or `/cut-list`. The root redirects to `/designer`.

```sh
pnpm format:check
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

`pnpm format` formats maintained source and documentation; `pnpm format:check` checks formatting. The frozen specification and generated lockfile are excluded.

`pnpm test` runs Vitest once. Domain tests default to Node; UI tests explicitly opt into jsdom. `pnpm preview` serves the production build locally. Production hosting must rewrite SPA routes to `index.html`.

Tooling was initialized with `pnpm create vite@latest --template react-ts`. Tailwind uses its [official Vite integration](https://tailwindcss.com/docs/installation/using-vite).

## Domain commands

Import commands from `src/domain/commands`. Each command returns a new `Project` or throws a `CommandError` with a machine-readable `code` and `data`. Input projects are never mutated, including on failure. Structural conflicts are rejected; geometric invalidity remains representable. ID-creating commands accept a replaceable ID generator.

Shelf and front selections use stable bottom/top boundaries. `addShelfToSpace` resolves the current space from those boundaries; it ignores any caller-supplied derived measurements. `addDoor` covers every contiguous space between its endpoints, while `addDrawerFront` requires adjacent boundaries.

Shelf centring accounts for thickness. New shelf placement rounds to the nearest whole millimetre, with half-millimetre ties toward the module top. This placement rule does not round manufacturing dimensions. Moving a shelf may leave invalid geometry but cannot break a front's structural range. Removing a shelf deletes the entire losing front, including a losing door that extended beyond the merged space, as specified.

Persistence exposes load/save errors and unsaved status in the store. Unreadable saved data stays untouched and is available as `persistence.recoveryData`; autosave stays blocked to prevent accidental replacement until the user explicitly confirms importing a replacement project. Failed writes can be retried with `retrySave()`.
