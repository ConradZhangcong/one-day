# Database Guidelines

## Source of Truth

Dexie 4 over IndexedDB is the only persisted source of truth. `OneDayDatabase` declares the current schema. The logical first schema is `DATABASE_VERSION = 1`; table declarations are centralized in `V1_STORES`.

Tables store domain payloads plus minimal rebuildable indexes. Examples are `plannedLocalDate`, `normalizedTitle`, and `archivedValue`. Nested discriminated unions are not queried directly. Every repository decodes records through the shared domain Zod schema before returning them.

## Writes and Transactions

- React components must call application services/commands, never table methods.
- A command with one or more writes runs through `UnitOfWork.write` or an explicitly scoped Dexie transaction.
- Multi-table invariants are atomic. `deleteListAndMoveContentsToInbox` moves tasks/series and deletes the list in one transaction.
- First-run system data uses idempotent transactions (`ensureInbox`, time-zone inspection).
- Failure must reject and roll back; do not catch and continue inside a transaction.
- A Dexie transaction must not `await` a promise that resolves without issuing an
  IndexedDB request between database operations. Guard empty bulk writes at the
  call site (`if (items.length > 0)`) so the transaction cannot commit early with
  `PrematureCommitError` before the next write.

Repository `save` methods are low-level ports for use cases, not permission for UI writes.

## Schema and Migrations

- Increment `DATABASE_VERSION` for any persisted shape/index change; never edit a released version in place.
- Add a new `version(n).stores(...).upgrade(...)` path and preserve forward compatibility.
- Keep a frozen persisted-row fixture per released schema in `tests/infrastructure/db/migration-fixtures.ts`.
- Migration tests seed the old record shape, reopen with the current database, and decode through repositories.
- Backup schema versioning is separate from Dexie schema versioning.

## Test Databases

Use `createTestDatabase`, which generates a unique name, installs the inbox by default, and exposes idempotent cleanup. Always call `cleanup()` in `finally` or `afterEach`; cleanup closes the current handle and deletes the named IndexedDB database. Raw table access is allowed only for persisted fixtures and rollback assertions.

## Forbidden Patterns

Storing `Date`, persisting derived overdue/missed flags, indexing nested schedule unions directly, returning raw records to UI, silently changing the application time zone, or destructive schema changes without a fixture-backed upgrade.

## Scenario: Reminder delivery identity and atomic claiming

### 1. Scope / Trigger

Use this contract whenever a task/series schedule, snooze, application time zone, or reminder runtime changes. It prevents duplicate delivery across timer, focus, visibility, reload, and concurrent reconciliation.

### 2. Signatures

```ts
ReminderRepository.claimDelivery(reminderId: string, deliveryKey: string): Promise<boolean>
ReminderRuntime.reconcile(): Promise<void>
```

The persisted reminder owns `scheduleRevision`, `snoozeRevision`, `lastDeliveryKey`, and optional `snoozedUntil`.

### 3. Contracts

- Delivery key is `reminder id + scheduleRevision + resolved trigger Instant + snoozeRevision`.
- Schedule changes increment `scheduleRevision` and clear `snoozedUntil`; a no-op edit does neither.
- Snooze increments `snoozeRevision` even when the chosen Instant repeats and never edits plan/deadline.
- Claim happens inside `UnitOfWork.write` before any system/application notification is shown.
- Deleting a task deletes its owned reminders in the same transaction.

### 4. Validation & Error Matrix

- Missing owner -> `REMINDER_OWNER_NOT_FOUND`.
- Referenced plan/deadline is `none` -> `REMINDER_TARGET_MISSING`.
- Missing reminder on update/snooze -> `REMINDER_NOT_FOUND`.
- Already claimed delivery key -> return `false`, do not throw or show again.
- Malformed stored reminder -> shared Zod decoder rejects; do not default corrupted fields.

### 5. Good/Base/Bad Cases

- Good: timer and focus race; one transaction claims and exactly one delivery appears.
- Base: target is in the future; runtime installs/replaces a timer without writing delivery state.
- Bad: show a notification and then persist `lastDeliveryKey`; a crash/reload can show it twice.

### 6. Tests Required

- Concurrent `reconcile()` and a new runtime over the same DB produce one delivery.
- Exactly 15 minutes late is delivered; older than 15 minutes is dropped.
- Schedule edits clear snooze and change identity; no-op edits preserve it.
- Task deletion leaves zero reminders for that owner.

### 7. Wrong vs Correct

```ts
// Wrong: side effect first, best-effort persistence later.
notify();
await reminders.save({ ...reminder, lastDeliveryKey: key });

// Correct: atomically claim, then perform the non-transactional side effect.
const claimed = await unitOfWork.write(({ reminders }) =>
  reminders.claimDelivery(reminder.id, key),
);
if (claimed) await notify();
```

## Scenario: Optional recurrence-template goal linkage

### 1. Scope / Trigger

Apply when a recurrence series is linked to a long-term goal or when the persisted `TaskTemplate` shape changes without adding an IndexedDB index.

### 2. Signatures

```ts
TaskTemplate.goalId?: string
TaskOccurrenceView.goalId?: string
DATABASE_VERSION = 3
V3_STORES = V2_STORES
```

### 3. Contracts

- `goalId` belongs to the series template and is projected to active, virtual, and historical occurrence views through the matching template or snapshot.
- Create/update commands validate that the goal exists and is not archived before commit.
- Older v2 rows omit `goalId` and remain valid after upgrade; the migration must not invent a relationship.
- No new index is added because goal filtering is not a v3 query requirement.

### 4. Validation & Error Matrix

- Missing referenced goal -> `GOAL_NOT_FOUND` and full rollback.
- Archived new goal -> `ARCHIVED_GOAL` and full rollback.
- Absent `goalId` -> valid unlinked series.
- Frozen v2 row without `goalId` -> decode unchanged after v3 open.

### 5. Good/Base/Bad Cases

- Good: create a linked series; its active occurrence query returns the same `goalId`.
- Base: upgrade an unlinked v2 series; it remains unlinked.
- Bad: accept `goalId` in a draft, validate it, then destructure it away before persisting the template.

### 6. Tests Required

- Application test covers linked create and occurrence projection.
- Migration test opens a frozen v2 recurrence row under v3 and asserts no `goalId` is invented.
- Typecheck locks optional-property behavior under `exactOptionalPropertyTypes`.

### 7. Wrong vs Correct

```ts
// Wrong: validated input is silently dropped.
const { goalId: _goalId, ...template } = draft;

// Correct: optional linkage survives in the persisted template.
const { rule: _rule, tagNames: _tagNames, ...template } = draft;
```
