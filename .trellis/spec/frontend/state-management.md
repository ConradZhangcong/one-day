# State Management

## State Categories

- **Persistent domain state**: IndexedDB through repository ports and application use cases.
- **Derived domain state**: pure projectors such as `deriveTaskStatus`; never persist `missedPlan` or `overdue`.
- **URL state**: route, calendar view, range, and future filters so refresh/back navigation is predictable.
- **Local UI state**: modal visibility, form drafts, pending confirmations, and loading flags.
- **Browser preference state**: subscribed with browser APIs, such as `prefers-color-scheme`.

There is no remote server state and no Redux/Zustand store. Do not add a global store just to duplicate IndexedDB rows.

## Write Flow

```text
component event -> application command/use case -> UnitOfWork -> repository port -> Dexie adapter
```

The UI may inspect data, but every multi-table or settings mutation crosses `UnitOfWork.write`. `TimeZoneSettingsService` demonstrates atomic first-run initialization and explicit confirmation.

## Rules

- Database rows are the source of truth; component copies are drafts only.
- Lists and calendars must eventually consume the same occurrence projection.
- A device time-zone mismatch is transient UI state until the user confirms it.
- Do not store `Date` objects; use domain strings and the configured IANA zone.
- Decode URL filter values once into branded dates and supported enum values;
  malformed query values are ignored rather than cast into the projection.
- Date-relative list projections subscribe to a clock tick so an open tab moves
  from today to the next local date without requiring a database write or reload.

## Scenario: Recovery projections and browser reminder state

### 1. Scope / Trigger

Apply when a page displays `today`, `missedPlan`, `overdue`, review buckets, notification permission, or time-driven reminders.

### 2. Signatures

```ts
RecoveryService.snapshot(): Promise<RecoverySnapshot>
RecoveryService.review({ period, anchorDate }): Promise<ReviewSnapshot>
requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'>
```

### 3. Contracts

- IndexedDB changes are observed with `useLiveQuery`; clock ticks are a separate invalidation source.
- `overdue` is the primary recovery group when both flags are true; the detail may still say the plan was missed.
- Review ranges use local `[startDate, endDateExclusive)` values and ISO Monday weeks, not fixed 24/168-hour arithmetic.
- Notification permission is requested only in the direct click handler before the first `await`.
- Denied/unsupported notifications do not disable application reminders or any task workflow.

### 4. Validation & Error Matrix

- Invalid review date query -> ignore it and use the current local date.
- Invalid reschedule order -> `DEADLINE_BEFORE_PLAN`; keep the draft and original stored values.
- Live-query/decoder failure -> route error boundary with Chinese retry/safe-return UI.
- Notification denied/unsupported/throws -> explanatory state; no core-flow error.

### 5. Good/Base/Bad Cases

- Good: a task becomes overdue while the page is open and moves from missed to overdue without a DB write.
- Base: another tab edits a task; the live query refreshes immediately.
- Bad: one 30-second polling loop handles both data and time; cross-tab writes remain stale until the poll.

### 6. Tests Required

- A task satisfying both flags occurs zero times in missed and once in overdue.
- Local day/week action-Instant boundaries are start-inclusive/end-exclusive.
- All-day/timed kind switching preserves the original local date.
- Permission is not requested on render/start/focus and is called by an explicit click.

### 7. Wrong vs Correct

```ts
// Wrong: permission request after asynchronous setup loses user activation.
await saveReminder();
await Notification.requestPermission();

// Correct: invoke the browser request synchronously in the click stack.
const permission = Notification.requestPermission();
await permission;
```
