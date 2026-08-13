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

## Review Checklist

- No component writes or decodes Dexie records.
- Async UI has loading, failure, and cancellation behavior.
- Browser subscriptions clean up and tolerate Strict Mode.
- State meaning is not color-only and Chinese copy explains destructive/temporal effects.
- Deferred Phase 2+ product behavior has not leaked into the foundation.

## Forbidden Patterns

Disabling lint/type rules without a scoped explanation, snapshotting implementation markup instead of behavior, swallowing errors, or claiming browser/PWA behavior without running it.
