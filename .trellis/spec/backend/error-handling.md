# Error Handling

## Domain Errors

Expected business conflicts use `DomainError` with a stable `DomainErrorCode`, such as `DEADLINE_BEFORE_PLAN` or `INVALID_OCCURRENCE_KEY`. UI code maps codes to Chinese copy; it must not parse exception messages. Add new codes centrally in `src/domain/errors.ts`.

Zod owns malformed boundary data. Public decoders (`decodeTimeZoneId`, `decodeRecurrenceSeries`) parse `unknown` once. Pure validation that is expected during form editing may return a typed result; assertion variants throw a coded domain error.

## Persistence and Application Errors

- Let Dexie errors escape the transaction so rollback occurs.
- Application services do not partially commit and then report success.
- UI boundaries catch failures to preserve the user's current operation and show actionable Chinese feedback.
- An invalid stored value is not silently replaced by a detected default; decoding fails so corruption remains visible.
- Infrastructure invariant failures currently use `TypeError` where no product-facing domain code exists (for example a missing system inbox). Add a domain code before exposing such a failure as a user workflow.

## Common Mistakes

Throwing generic strings, catching inside a transaction and continuing, using messages as machine contracts, defaulting malformed persistence, or logging sensitive task content.
