# Frontend Development Guidelines

> Project-specific conventions for the React/Vite PWA.

## Overview

The UI is a React 19 client application. Ant Design provides accessible interaction primitives, React Router owns navigation, and IndexedDB is the local source of truth. Components call application services; they never write Dexie tables.

## Pre-Development Checklist

Before changing frontend code, read:

1. [Directory Structure](./directory-structure.md)
2. [Component Guidelines](./component-guidelines.md)
3. [State Management](./state-management.md)
4. [Type Safety](./type-safety.md)
5. [Quality Guidelines](./quality-guidelines.md)
6. [Hook Guidelines](./hook-guidelines.md) when adding effects or subscriptions
7. [Cross-Layer Thinking Guide](../guides/cross-layer-thinking-guide.md) for persisted data flows

## Guidelines Index

| Guide | Description | Status |
|---|---|---|
| [Directory Structure](./directory-structure.md) | App composition and feature placement | Active |
| [Component Guidelines](./component-guidelines.md) | Components, Ant Design, styling, accessibility | Active |
| [Hook Guidelines](./hook-guidelines.md) | Effects and browser subscriptions | Active |
| [State Management](./state-management.md) | Local, URL, and IndexedDB-backed state | Active |
| [Quality Guidelines](./quality-guidelines.md) | Required checks and forbidden shortcuts | Active |
| [Type Safety](./type-safety.md) | Strict TypeScript and Zod boundaries | Active |

**Language**: Project specs are written in English; product UI copy is Simplified Chinese.
