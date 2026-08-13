# Persistence and Domain Guidelines

> This local-first application has no server backend. “Backend” here means the framework-free domain, application use cases, and Dexie persistence adapter.

## Pre-Development Checklist

Before changing domain or persistence code, read:

1. [Directory Structure](./directory-structure.md)
2. [Database Guidelines](./database-guidelines.md)
3. [Error Handling](./error-handling.md)
4. [Quality Guidelines](./quality-guidelines.md)
5. [Logging Guidelines](./logging-guidelines.md) when adding diagnostics
6. [Cross-Layer Thinking Guide](../guides/cross-layer-thinking-guide.md)
7. The task's time/recurrence research for calendar semantics

## Guidelines Index

| Guide | Description | Status |
|---|---|---|
| [Directory Structure](./directory-structure.md) | Domain/application/infrastructure boundaries | Active |
| [Database Guidelines](./database-guidelines.md) | Dexie schema, records, transactions, migrations | Active |
| [Error Handling](./error-handling.md) | Domain codes and persistence failure behavior | Active |
| [Quality Guidelines](./quality-guidelines.md) | Invariants and test gates | Active |
| [Logging Guidelines](./logging-guidelines.md) | Local-only diagnostic policy | Active |
