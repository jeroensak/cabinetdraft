# Cabinet Designer V1

Before every implementation step, read `docs/IMPLEMENTATION_CONTRACT.md` and the relevant sections of `technical-specification.md`, using `docs/SPECIFICATION_INDEX.md` for navigation.

`technical-specification.md` is frozen and authoritative for domain behaviour. Never edit it unless the user explicitly instructs you to do so. Figma is authoritative for visual layout/style: https://www.figma.com/design/donKXEbUuouv3eFmWolZKY (Designer — Preferred Direction, Designer — Fronts, Cut List).

Do not invent V1 functionality or skip ahead of the requested slice. Keep manufacturing formulas in one canonical pure TypeScript domain implementation. Keep Designer and Cut List independent consumers. Run `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm build` before finishing each slice; do not defer known failures.
