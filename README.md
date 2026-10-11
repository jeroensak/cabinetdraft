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
pnpm test:e2e
```

`pnpm format` formats maintained source and documentation; `pnpm format:check` checks formatting. The frozen specification and generated lockfile are excluded.

`pnpm test` runs Vitest once. Domain tests default to Node; UI tests explicitly opt into jsdom. `pnpm preview` serves the production build locally. Vercel routing is configured in `vercel.json`.

Tooling was initialized with `pnpm create vite@latest --template react-ts`. Tailwind uses its [official Vite integration](https://tailwindcss.com/docs/installation/using-vite).

## Vercel deployment and search metadata

Import the GitHub repository `jeroensak/cabinetdraft` into Vercel and use the project name `cabinetdraft` if it is available. The configuration uses Node.js 24, Corepack with the pnpm version recorded in `package.json`, a frozen-lockfile install, and `pnpm build`, publishing `dist/`. No backend or secrets are required. Vercel assigns the actual deployment domain; confirm it before launch.

The default production origin is `https://cabinetdraft.vercel.app`. If Vercel assigns another hostname or you attach a custom domain, set `SITE_URL` in Vercel to the full origin (for example, `https://your-domain.example`) and redeploy. Set the same production value in both Production and Preview environments; preview URLs must not become canonical URLs. For local builds, use `.env.local` (see `.env.example`). Vercel normally adds `X-Robots-Tag: noindex` to preview deployments.

The build emits static titles, descriptions, canonical links, Open Graph/Twitter cards, WebApplication structured data, `robots.txt`, and `sitemap.xml`. Client-side navigation keeps metadata in sync. The sitemap includes `/designer`; `/cut-list` is `noindex, follow` because it presents browser-local project data. This is an indexing preference, not an access restriction. Social metadata never contains project names or cabinet dimensions.

The root permanently redirects to `/designer`. Only the two application routes are rewritten to their corresponding HTML documents; unknown URLs return the static 404 page. Hashed assets receive immutable caching. Browser-local persistence and file downloads work without server storage.

After deployment, verify direct visits and reloads on `/designer` and `/cut-list`, an unknown URL's HTTP 404 status, and the production canonical URL in page source. Submit `/sitemap.xml` through Google Search Console after verifying domain ownership. Metadata makes the app discoverable but does not guarantee indexing or rankings. A future public guide or landing page with useful cabinet-building content would offer more search value than indexing project tables.

The social preview source is `public/social-preview.svg`; `public/social-preview.png` is its 1200 × 630 raster export used by sharing platforms.

## Domain commands

Import commands from `src/domain/commands`. Each command returns a new `Project` or throws a `CommandError` with a machine-readable `code` and `data`. Input projects are never mutated, including on failure. Structural conflicts are rejected; geometric invalidity remains representable. ID-creating commands accept a replaceable ID generator.

Shelf and front selections use stable bottom/top boundaries. `addShelfToSpace` resolves the current space from those boundaries; it ignores any caller-supplied derived measurements. `addDoor` covers every contiguous space between its endpoints, while `addDrawerFront` requires adjacent boundaries.

Shelf centring accounts for thickness. New shelf placement rounds to the nearest whole millimetre, with half-millimetre ties toward the module top. This placement rule does not round manufacturing dimensions. Moving a shelf may leave invalid geometry but cannot break a front's structural range. Removing a shelf deletes the entire losing front, including a losing door that extended beyond the merged space, as specified.

Persistence exposes load/save errors and unsaved status in the store. Unreadable saved data stays untouched and is available as `persistence.recoveryData`; autosave stays blocked to prevent accidental replacement until the user explicitly confirms importing a replacement project. Failed writes can be retried with `retrySave()`.

## Browser integration tests

Install the test browser once with `pnpm exec playwright install chromium`, then run `pnpm test:e2e`. The suite builds and serves the production app on port 4173 in isolated Chromium contexts; no existing browser projects are changed. It covers default parts, cabinet/shelf/front editing and reload, invalid output blocking, undo/redo, file export/import, PDF downloads, static search metadata, and metadata updates during navigation. Vercel's redirects and HTTP 404 handling must also be checked on the deployed site; the local Vite preview server does not apply `vercel.json`.

Failed tests retain screenshots and traces in ignored `test-results/`; `pnpm exec playwright show-report` opens the HTML report. Unit tests remain the primary domain-calculation checks.

The Cut List includes a **Download PDF** button for valid, nonempty projects. It exports a landscape A4 table with repeated headings and page numbers. PDF libraries and the bundled Noto Sans font load on demand; the font license is in `src/assets/fonts/OFL.txt`.
