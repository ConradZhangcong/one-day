# Domain and Persistence Directory Structure

## Layout and Dependency Direction

```text
src/domain/                  # Zod contracts, value objects, pure validation/projectors
src/application/
├── repositories/            # Technology-neutral persistence ports and UnitOfWork
└── settings/                # Use cases coordinating ports
src/infrastructure/db/       # Dexie database, records, codecs, repositories, transactions
tests/domain/                # Pure domain tests
tests/application/           # Use-case and transaction-boundary tests
tests/infrastructure/db/     # fake-indexeddb, frozen migration fixtures
```

Dependencies point inward: infrastructure imports application ports and domain contracts; application imports domain and ports; domain imports neither React nor Dexie. `src/app/application.ts` is the outer composition root.

## Module Rules

- Domain capability barrels (`schedule/index.ts`, etc.) expose the public contract.
- Repository interfaces use domain types and never expose Dexie `Table` or persisted record projections.
- `records.ts` owns IndexedDB-only index fields; `projections.ts` is the single domain↔record codec location.
- Cross-table commands live behind an application use case/port and run in a transaction.
- Tests may access raw tables to seed persisted fixtures or verify rollback; production UI may not.

## Naming

Use `*Schema`/`decode*` for boundaries, `*Repository` for ports, `Dexie*Repository` for adapters, `*Record` for persisted shapes, and `*Service` for application use cases.
