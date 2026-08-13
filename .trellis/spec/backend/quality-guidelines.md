# Domain and Persistence Quality Guidelines

## Required Patterns

- One Zod decoder per untrusted contract.
- Pure Temporal-based time comparison using the configured IANA zone.
- All-day values remain local dates; timed values resolve with Temporal `compatible` behavior.
- Stable occurrence identity is based on series, revision, and original local anchor.
- Persisted lifecycle is only pending/completed/skipped; recovery flags are derived.
- Cross-table/settings writes are transaction-backed application commands.

## Tests

Domain tests cover malformed formats, mixed plan/deadline ordering, exact-boundary status, Asia/Shanghai, and a DST zone. Database tests use fake-indexeddb for reopen, decoding, rollback, system data, list movement, settings, cleanup, and frozen schema fixtures.

Before handoff run:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

## Review Checklist

- Does the change preserve dependency direction?
- Is every unknown decoded once at its owner?
- Are record-only index fields rebuilt centrally?
- Can any UI path bypass the use case/transaction boundary?
- Does a schema change increment the version and include an old-shape fixture?
- Are exact instant/date boundaries and rollback paths tested?

## Forbidden Patterns

JavaScript `Date` in domain/persistence, local timezone defaults in calculations, duplicated recurrence/status projectors, direct component writes, mutable future occurrence projections, and tests that leak named IndexedDB databases.
