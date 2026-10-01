# Testing Library Documentation

> **Versions (as resolved by `games/wit-clash`):** `@testing-library/svelte` 5.4.2, `@testing-library/jest-dom` 6.10.0 (7.x deliberately not adopted)
> `@testing-library/jest-dom` is also a root devDependency (same version). `@testing-library/user-event` was removed: no test imported it. Re-add it when a test needs realistic typing.

## Overview
Component tests for the WitClash Svelte UI (`games/wit-clash/tests/`, run by Vitest under jsdom, see [jsdom.md](jsdom.md)).

## Used in this repo
| API | Usage |
|---|---|
| `render(Component, props)` | ~54 calls. Props are passed flat: `render(App, { manager })`. |
| `screen.getByRole(role, { name })`, `getByText`, `queryByText`, `getByLabelText`, `getByDisplayValue`, `getAllByRole`, `queryByRole` | Query by role/text first. |
| `within(el)` | Scoped queries. |
| `fireEvent.click/input/...` | 12 calls. All interaction goes through `fireEvent`. |
| jest-dom: `toBeInTheDocument`, `toBeDisabled`, `toHaveAttribute`, `toHaveClass` | Loaded with `import "@testing-library/jest-dom/vitest"` in the root `vitest.setup.ts`. |

## Gotchas
- **Fake the view-model, not the server.** Tests use `fakeManager({ connectionStatus })` from `tests/helpers/fakes.ts` instead of a real `GameConnectionManager`; the `.svelte.ts` view-models still compile for real through the `svelte-ts-runes` plugin (see [svelte.md](svelte.md)).
- `resolve.conditions: ["browser"]` in the Vitest config is required, otherwise Svelte loads its server build and `render` fails.
- Auto-cleanup relies on `globals: true` (set in `games/wit-clash/vitest.config.ts`) so `afterEach` is available to the library.
- After state changes driven by `$state`, call `flushSync()` (from `svelte`) before asserting; see `App.reactivity.test.ts`.
- Assert on role and accessible name (`/host game/i`) rather than markup; tests survive restyling.
- `tests/screens/CategoryVote.test.ts` still has a header TODO saying rendering is skipped for "Bun + @testing-library/svelte incompatibility"; the render suites now run (commit 9d3c351), so the TODO is stale.

## References
- [Testing Library Svelte](https://testing-library.com/docs/svelte-testing-library/intro), [jest-dom matchers](https://github.com/testing-library/jest-dom)
