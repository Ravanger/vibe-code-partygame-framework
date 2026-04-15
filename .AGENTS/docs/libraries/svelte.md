# Svelte 5 (Runes) Documentation

> **Version:** Svelte 5 (GA October 2024, current ~5.45+)

## Overview

Svelte 5 is the compile-time UI framework powering all `vibe-coded` client interfaces — lobby, game screens, scoreboards, and overlays. It ships zero virtual DOM and compiles components to fine-grained vanilla JS. The Runes system replaces Svelte 4's implicit `$:` reactivity with explicit, signal-based primitives that work both inside `.svelte` files and in plain `.svelte.ts` files, enabling shared reactive game state across components without a separate store library.

## Key Concepts

- **Runes:** Compiler-level reactive primitives prefixed with `$`. Not function calls at runtime — the Svelte compiler transforms them. The six core runes: `$state`, `$derived`, `$effect`, `$props`, `$bindable`, `$inspect`.
- **`$state`:** Declares mutable reactive state. Objects and arrays become deeply reactive proxies — mutate properties directly. Works in `.svelte.ts` files for shared state.
- **`$derived`:** Declares computed values. Automatically re-evaluates when its dependencies change. Pure — no side effects. Use `$derived.by(() => ...)` for multi-line derivations.
- **`$effect`:** Runs side-effect code after DOM updates when dependencies change. Returns an optional cleanup function. Does **not** run during SSR. Replace `onMount`/`onDestroy` patterns with `$effect` + cleanup return.
- **`$props`:** Replaces `export let`. Destructure component props with defaults: `let { count = 0, label }: Props = $props()`.
- **`$bindable`:** Marks a prop as two-way bindable by the parent. Use sparingly — prefer callbacks for explicit data flow.
- **Snippets:** Replace named slots. Define with `{#snippet name()}...{/snippet}`, render with `{@render name()}`. Accept parameters.
- **Universal Reactivity:** `$state` and `$derived` in `.svelte.ts` files serve as shared reactive stores across the component tree — no writable/readable boilerplate needed.
- **Event handlers:** Use standard DOM attribute names — `onclick`, `onkeydown`, etc. No more `on:click`.

## Common Functions/Methods

| Function | Description |
|---|---|
| `let count = $state(0)` | Create mutable reactive state. |
| `let obj = $state({ score: 0 })` | Deeply reactive object — `obj.score = 5` triggers updates. |
| `let doubled = $derived(count * 2)` | Computed value, updates when `count` changes. |
| `let total = $derived.by(() => { ... })` | Multi-line derived computation. |
| `$effect(() => { ...; return () => cleanup() })` | Run side effect after DOM updates; return cleanup function. |
| `$effect.pre(() => ...)` | Run side effect *before* DOM updates — useful for scroll position capture. |
| `let { name, age = 18 } = $props()` | Declare typed component props with defaults. |
| `let value = $bindable(default)` | Mark a prop as two-way bindable. |
| `$inspect(value)` | Dev-only reactive console.log — logs on every dependency change. |
| `getContext(KEY)` / `setContext(KEY, value)` | Pass reactive state down the tree without prop drilling. |
| `{#snippet item(data)}{/snippet}` | Define a reusable template snippet. |
| `{@render item(data)}` | Render a snippet in the template. |

## Best Practices in This Project

- **Use `.svelte.ts` modules for game state shared across components.** Export a `$state` class instance or object (e.g. `export const gameState = new GameState()`). Don't export reassignable primitives — export objects and mutate properties.
- **`$derived` for computed game data, `$effect` for side effects.** Never compute values inside `$effect`; never fire side effects inside `$derived`.
- **Subscribe to Colyseus schema changes in `$effect`.** Attach `.onChange`, `.onAdd`, `.onRemove` listeners inside `$effect` and return the cleanup/teardown in the cleanup function.
- **Avoid `$effect` for value synchronisation.** If you're trying to keep two reactive values in sync, use `$derived` instead.
- **Prefer `onclick` over `on:click`.** Svelte 5 uses standard DOM event attribute names — the old `on:` directive syntax still works but is deprecated.
- **Use snippets instead of named slots.** Snippets are more composable and type-safe.
- **Use `$inspect` during development** to trace reactive updates on game state objects — it's a zero-effort debug logger.
- **Don't put non-serialisable values (e.g. WebSocket instances) in `$state`.** These will be proxied deeply, which can cause issues. Store them in plain module-level variables instead.

## References

- [Official Docs](https://svelte.dev/docs)
- [$state](https://svelte.dev/docs/svelte/$state)
- [$derived](https://svelte.dev/docs/svelte/$derived)
- [$effect](https://svelte.dev/docs/svelte/$effect)
- [Runes blog post](https://svelte.dev/blog/runes)
