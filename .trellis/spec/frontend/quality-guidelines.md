# Frontend Quality Guidelines

## Required Checks

Run from the repository root:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

Use `pnpm install --frozen-lockfile` for reproducible installs. E2E is configured in Playwright for Chromium, Firefox, WebKit, and mobile profiles; run it when a user workflow exists or PWA behavior changes.

## Testing

- Domain invariants get table-driven unit tests, including DST-aware zones.
- Application commands get tests against fake IndexedDB when transactions/settings matter.
- Components are tested through visible roles, labels, and user events.
- PWA install/offline claims require a production build and browser verification; a generated manifest alone is not evidence of offline restart.

## Scenario: PWA release evidence and browser capability matrix

### 1. Scope / Trigger

Apply whenever the manifest, Service Worker, update prompt, offline data flow, responsive shell, or release-facing browser behavior changes.

### 2. Signatures

```sh
pnpm test:pwa
pnpm test:e2e
pnpm test:performance
```

`test:pwa` builds and validates `dist/`; `test:e2e` owns the shared browser matrix; `test:performance` owns deterministic large-data budgets.

### 3. Contracts

- Manifest fields, ordinary/maskable PNG dimensions, Apple touch icon, Workbox output, and navigation-shell precache are checked from the production build.
- Chromium owns Service Worker control, offline restart, and reconnect assertions. Firefox/WebKit and mobile emulation keep the same core Web flow but may explicitly block unsupported Service Worker inspection.
- A persistent UI command is complete only after a visible post-commit signal. E2E must wait for that signal before navigating away.
- Mobile profiles are emulation evidence, not Android/iOS real-device evidence. Real installation, standalone launch, notification permission, and file-picker checks stay in the release checklist.

### 4. Validation & Error Matrix

- Manifest field, icon file/size, Workbox file, or precache entry missing -> `test:pwa` fails.
- Service Worker never controls Chromium -> offline E2E fails before the network is disabled.
- Non-Chromium engine lacks worker-level observation -> skip only the PWA-specific assertion with a named reason; never skip the shared core flow.
- A click starts an asynchronous persistence command -> wait for row removal, success state, or another authoritative UI signal before route navigation.
- Performance median exceeds its approved budget -> optimize the query/projector; do not increase the threshold to hide the regression.

### 5. Good/Base/Bad Cases

- Good: create online, wait for the saved row, restart a deep route offline, write another task, reconnect, and assert each task appears exactly once.
- Base: all five projects run the same task/list/calendar flow while only Chromium runs Service Worker lifecycle assertions.
- Bad: click “complete” and immediately call `page.goto`; a slower browser may leave before the IndexedDB command commits and create a flaky false failure.

### 6. Tests Required

- Build verifier includes a valid fixture plus manifest-drift and missing-asset failures.
- Component test proves an update is activated only by the user's update action; dismiss/unmount must not force a reload.
- E2E covers five configured projects, deep-route refresh/history, page and console errors, keyboard/focus, 200% root text, themes, and horizontal overflow.
- Chromium E2E waits for `navigator.serviceWorker.controller`, closes/reopens offline, and verifies IndexedDB data before and after reconnect.
- Performance test uses fixed data size, one warm-up, at least five samples, and the median.

### 7. Wrong vs Correct

```ts
// Wrong: the async click handler may still be writing when navigation tears it down.
await completeButton.click();
await page.goto('/completed');

// Correct: wait for the application post-commit projection before navigating.
await completeButton.click();
await expect(completeButton).toBeHidden();
await page.goto('/completed');
```

## Review Checklist

- No component writes or decodes Dexie records.
- Async UI has loading, failure, and cancellation behavior.
- Browser subscriptions clean up and tolerate Strict Mode.
- State meaning is not color-only and Chinese copy explains destructive/temporal effects.
- Deferred Phase 2+ product behavior has not leaked into the foundation.

## Forbidden Patterns

Disabling lint/type rules without a scoped explanation, snapshotting implementation markup instead of behavior, swallowing errors, or claiming browser/PWA behavior without running it.
