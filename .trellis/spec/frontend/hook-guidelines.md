# Hook Guidelines

## Current Pattern

There is no general-purpose client store or remote-fetching layer. Hooks coordinate React state with browser capabilities and application services. Use built-in hooks until repeated stateful behavior justifies a custom hook.

## Effects and Subscriptions

- Effects must return cleanup for every event, media-query, timer, or live-query subscription.
- Wrap callbacks used as listener identities in `useCallback`.
- Treat React Strict Mode as normal: startup operations must be idempotent and concurrent initialization must not overwrite data.
- Browser capability failures must degrade to Chinese user feedback; they must not make the local task core unusable.
- Visibility-dependent checks run only when `document.visibilityState === 'visible'`.

`AppProviders` uses `useSyncExternalStore` for the system color scheme. `TimeZoneChangePrompt` registers and removes focus, pageshow, and visibility listeners and delegates persistence to `TimeZoneSettingsService`.

## Data Access

Future reactive IndexedDB reads should use a dedicated feature hook over `dexie-react-hooks`, returning decoded domain/view values. Writes always call an application command/use case; a hook must not expose raw table mutation.

## Naming and Testing

Custom hooks start with `use`. Test visible behavior and cleanup. Use fake timers only for clock-dependent behavior, and inject clocks/providers into application logic when possible.
