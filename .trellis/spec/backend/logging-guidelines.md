# Logging Guidelines

## Current Policy

The MVP has no analytics, remote error reporting, or logging dependency. User data stays on-device. Expected failures are returned/thrown to the UI, which shows concise Chinese feedback; tests assert errors directly.

## If Diagnostics Are Added

- Keep diagnostics local and structured with an event name, safe error code, schema/app version, and timestamp.
- Log lifecycle facts such as migration start/failure or service-worker update state, not task titles, notes, tags, backup contents, or exact user schedule.
- Use `warn` for recoverable capability limitations and `error` for failed operations; do not emit routine domain decisions as errors.
- Any future remote reporting is a product/privacy scope change and requires explicit disclosure and user choice.

## Forbidden Data

Never log task content, notes, tag names, complete backups, IndexedDB rows, notification text, or identifiers that can reconstruct a user's schedule.
