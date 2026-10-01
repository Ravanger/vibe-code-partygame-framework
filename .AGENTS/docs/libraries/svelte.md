# Svelte 5 (Runes) Documentation

> **Version:** 5.57.1 for `packages/game-client` and `games/wit-clash` (both declare `^5.57.1`); a single copy is installed.
> **Plugin:** `@sveltejs/vite-plugin-svelte` 7.3.1 (`^7.3.1` in both). Peer: svelte ^5.46.4, vite ^8.

## Overview
Svelte 5 UI for the WitClash client (`games/wit-clash/ui/`) and the SDK (`packages/game-client/src/*.svelte.ts`). Reactive state lives in `.svelte.ts` view-models; components stay thin.

## Used in this repo (grep of `ui/`, `src/`, `game-client/src`)
| Feature | Usage |
|---|---|
| `$state`, `$derived`, `$derived.by` | Heavy: view-models (`PromptingViewModel.svelte.ts`, `WaitingRoomViewModel.svelte.ts`) and `GameConnectionManager` (`status`, `room`). |
| `$props` | Screen components. |
| `$effect` | Few: screens destroy their viewmodel on teardown (`$effect(() => () => vm.destroy())`). Return a cleanup function. |
| `onclick` attributes | Standard DOM handler attributes (no `on:click`). |
| `mount()` | `games/wit-clash/ui/main.ts`. |

Not used: `$bindable`, `$inspect`, snippets.

## Best Practices in This Project
- Shared reactive state goes in `*.svelte.ts` classes; export an object/instance, mutate properties.
- `$derived` for computed values, `$effect` only for side effects; do not sync state with `$effect`.
- Do not put non-plain objects in `$state` where proxying matters; keep the Colyseus `Room` out of deep proxies if it causes issues.
- Screen routing is a derived `screen` in `AppViewModel`; a new phase needs an entry in `PHASE_SCREENS` (`AppViewModel.ts`), one in `SCREENS` (`App.svelte`) and a component.
- `.svelte.ts` files are compiled by `@sveltejs/vite-plugin-svelte` in both Vite and Vitest; no extra plugin is needed.
- `games/wit-clash/vite.config.ts` applies the `development` resolve condition only to `vite serve`. In a build it would ship Svelte's dev runtime (about 10 kB more JS). Component CSS is emitted as a CSS file (`emitCss` default); only the Vitest config sets `emitCss: false`.
- Component tests render with `@testing-library/svelte` under jsdom with `resolve.conditions: ["browser"]` (otherwise Svelte resolves its server entry).

## Duplicate runtime (resolved)
The root pin to `svelte@5.53.0` is gone; the lockfile now holds one `svelte@5.57.1`.

## References
- [Svelte docs](https://svelte.dev/docs/svelte/overview)
