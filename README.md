# Cabinet Designer V1

Frontend foundation built with Vite, React, TypeScript, Tailwind CSS, React Router, Zustand, Vitest, and ESLint. Designer and Cut List currently render placeholders; the persistent domain model and default project factory are implemented. Canonical carcass/shelf physical panels and spaces are derived in the domain. Canonical front geometry derives door leaves and drawer panels with structured geometry issues. Project validation, cut lists, commands, and the store remain reserved for later slices.

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
