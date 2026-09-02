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

## Scenario: Versioned full backup and atomic restore

### 1. Scope / Trigger

Use this contract whenever a recoverable domain entity, persisted setting, backup version, or full-database restore flow changes. It prevents physical Dexie records, partial writes, or dangling references from becoming a user backup.

### 2. Signatures

```ts
BackupService.createExport(): Promise<OneDayBackupV1>
BackupService.inspect(text: string): BackupInspection
BackupService.restore(inspection: BackupInspection): Promise<BackupSummary>
BackupRepository.readSnapshot(): Promise<BackupDataV1>
BackupRepository.replaceAll(data: BackupDataV1): Promise<void>
```

The v1 envelope is `format: "one-day-backup"`, `version: 1`, `exportedAt`, `timeZone`, and `data`. `data` owns domain entities plus explicit recoverable settings; it never owns record-only indexes or runtime caches.

### 3. Contracts

- Backup format versioning is independent from `DATABASE_VERSION`; adding a backup version does not imply a Dexie migration.
- `readSnapshot` reads every recoverable table and setting inside one Dexie read transaction, then decodes records to domain entities.
- Import parsing routes by exact format/version, decodes `unknown` once, and validates unique identities, the canonical inbox, cross-entity references, active occurrence ownership, reminder owners/targets, normalized tag-name uniqueness, and time-zone agreement before writing.
- `replaceAll` is called only inside `UnitOfWork.write`; it clears every table, rebuilds record projections through shared encoders, and writes the complete replacement graph.
- Internal `meta`, UI drafts, derived status, service-worker state, and index projections are excluded. `meta` is cleared and rebuilt by the current application when needed.
- A successful restore publishes one commit invalidation and then reconciles reminders. Reminder delivery/snooze revisions remain in the backup so reconciliation cannot rediscover an already claimed delivery.

### 4. Validation & Error Matrix

- Invalid JSON -> `BACKUP_INVALID_JSON`, no database operation.
- Foreign format -> `BACKUP_INVALID_FORMAT`, no database operation.
- Unknown version -> `BACKUP_UNSUPPORTED_VERSION`, no guessing or partial import.
- Zod failure, duplicate identity/index value, non-canonical inbox, dangling reference, active occurrence mismatch, reminder target mismatch, or time-zone disagreement -> `BACKUP_INVALID_DATA` before the restore transaction.
- Dexie constraint/encoding/write failure -> propagate the storage error; the encompassing transaction restores every pre-restore table and emits no commit invalidation.

### 5. Good/Base/Bad Cases

- Good: export a non-empty v3 database, restore it over unrelated data, then re-export semantically identical domain entities with rebuilt indexes and preserved reminder delivery identity.
- Base: export an inbox-only installation and restore it to a clean current database.
- Bad: clear tables first, parse each array while writing, then discover a dangling reminder owner; this can destroy good data before validation completes.

### 6. Tests Required

- Domain tests cover envelope routing, strict v1 decoding, duplicate ids/normalized tag names, canonical inbox, all cross-references, active occurrence ownership, reminder targets, and time-zone equality.
- Application tests assert deterministic export metadata, inspection performs zero writes, restore invokes its post-commit hook once, invalid data never invokes it, and every entity/settings kind survives round-trip.
- Database tests assert a consistent decoded snapshot, old-row removal, record-index reconstruction, and injected late unique-index failure rolling every table back byte-for-byte.
- UI tests assert JSON download cleanup, summary counts, cancel-without-write, destructive confirmation, stable Chinese errors, and no raw backup content in errors.

### 7. Wrong vs Correct

```ts
// Wrong: physical records leak into the format and writes can partially commit.
const backup = await db.tables.map((table) => table.toArray());
await db.delete();
await importRows(JSON.parse(text));

// Correct: decode a closed domain graph, then replace it in one transaction.
const inspection = backupService.inspect(text);
await unitOfWork.write(({ backup }) => backup.replaceAll(inspection.backup.data));
```
