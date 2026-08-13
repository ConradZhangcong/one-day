# Type Safety

## Compiler Contract

The project uses strict TypeScript with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, and project references. Use `import type` for type-only imports. Vite transpilation is not a type check; `pnpm typecheck` and `pnpm build` must both pass.

## Runtime Boundaries

Zod schemas in `src/domain` are the only entry for `unknown` persistence, browser, form, or backup values. Export a decoder next to each schema (`decodeTimeZoneId`, `decodeSchedulePoint`) and reuse it rather than casting.

Branded strings distinguish `LocalDate`, `LocalDateTime`, `Instant`, `TimeZoneId`, and `OccurrenceKey`. Persistence contains JSON strings, never JavaScript `Date`. Indexed records add rebuildable scalar projections and are decoded back into domain entities by repositories.

## Patterns

- Prefer discriminated unions and exhaustive `switch` statements for `SchedulePoint`, task states, and recurrence variants.
- Keep optional properties truly absent under `exactOptionalPropertyTypes`; do not assign `undefined` unless the record type explicitly allows it.
- Use `unknown` at untrusted boundaries and narrow once with the shared schema.

## Forbidden Patterns

- `any`, unchecked `as` casts, or locally re-declared persistence payload shapes.
- Passing Ant Design/Day.js or FullCalendar types into the domain layer.
- Converting all-day dates through UTC.
- Parsing the same unknown value independently in multiple consumers.
