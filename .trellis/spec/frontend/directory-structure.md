# Frontend Directory Structure

## Current Layout

```text
src/
├── app/                    # React composition root, router, shell, global CSS
├── application/            # UI-facing use cases and repository ports
├── domain/                 # Framework-free business contracts and projectors
├── infrastructure/db/      # Dexie adapters; never imported by leaf UI components
└── main.tsx                # Browser entry point
```

`src/app/application.ts` is the current composition root: it opens the database and wires application services to Dexie adapters. `src/app/router.tsx` owns route-level shell composition. Domain modules are grouped by capability (`schedule`, `task`, `recurrence`, `reminder`) and expose public barrels.

## Placement Rules

- Put reusable business behavior in `src/domain`, not in components.
- Put commands that coordinate repositories in `src/application/<capability>`.
- Put Dexie records, indexes, codecs, and adapters in `src/infrastructure/db`.
- Put browser/React composition in `src/app`; a leaf component must not import a Dexie table or repository implementation.
- As feature UI grows, create `src/features/<feature>/` for its components and hooks; keep only app-wide providers and routing in `src/app`.
- Tests mirror the layer under `tests/domain`, `tests/application`, and `tests/infrastructure`.

## Naming

- React components and their files use `PascalCase.tsx`.
- Non-component modules use `kebab-case.ts`.
- Zod schemas use `camelCaseSchema`; inferred domain types use `PascalCase`.
- Repository interfaces name the domain aggregate (`SingleTaskRepository`); adapters name the technology (`DexieSingleTaskRepository`).

Good references: `src/app/TimeZoneChangePrompt.tsx`, `src/application/settings/time-zone-settings.ts`, and `src/infrastructure/db/repositories.ts`.
