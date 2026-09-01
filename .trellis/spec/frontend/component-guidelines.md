# Component Guidelines

## Component Shape

Components are named function exports. Keep domain operations outside render code and call an application service from event/effect boundaries. Use the project-local shadcn/Base UI primitives under `src/components/ui/` for dialogs, alerts, buttons, sheets, selects, and typography rather than recreating focus and keyboard behavior.

`TimeZoneChangePrompt` is the reference for a browser-driven confirmation: detection is asynchronous, the modal is controlled by React state, cancellation does not mutate persistence, and confirmation awaits the application command.

## Props and Composition

- Define an explicit interface when a component has non-trivial props; use `PropsWithChildren` for providers.
- Pass domain values or view models, not Dexie records.
- Keep infrastructure construction in `src/app/application.ts`.
- Do not mirror mutable domain records into component state. State may hold a form draft or a read-only inspection result.

## Styling

Global shell and design-token overrides live in `src/app/styles.css`. Prefer Tailwind design tokens and semantic utility/class names. Support the existing system light/dark preference and responsive breakpoints; avoid hard-coded color as the only status signal.

## Accessibility

- Use semantic landmarks (`aside`, `nav`, `main`) and visible Chinese labels.
- Every icon-only affordance needs an accessible name; decorative marks use `aria-hidden`.
- Status requires text, icon, or shape in addition to color.
- Preserve the focus behavior of shadcn/Base UI primitives and test workflows through roles/labels rather than class names.

## Forbidden Patterns

- Importing `OneDayDatabase`, a Dexie table, or `createDexieRepositories` in a leaf component.
- Mutating FullCalendar event objects as application truth.
- Calling a persistence write during render.
- Silently applying device time-zone changes.
