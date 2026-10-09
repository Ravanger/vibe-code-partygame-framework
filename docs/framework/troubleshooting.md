# Troubleshooting

Known traps in this repo, with the cause and the rule that keeps each one fixed.

## Vite 8 + Svelte Plugin Compatibility
- **Issue:** `optimizeDeps.esbuildOptions` deprecation warning
- **Cause:** `@sveltejs/vite-plugin-svelte` < 7.0.0 uses deprecated option
- **Fix:** Upgrade to `^7.0.0` (supports Vite 8's rolldown optimizer)
- **Reference:** `games/wit-clash/package.json`

## Colyseus Schema 5 is decorator-free
- **Rule:** Define state with `schema({ field: t.string().default("") }, "Name")` and extend with `BaseGameState.extend({ ... }, "Name")`. `experimentalDecorators`, `emitDecoratorMetadata`, `useDefineForClassFields: false`, Vitest `ts-transform` plugins and `oxc: false` were deleted. Do not reintroduce them.
- **Limits:** 63 fields per schema class; primitive collection elements are type names (`t.map("number")`).
- **Reference:** `packages/shared/src/schema/BaseGameState.ts`, `.AGENTS/docs/libraries/colyseus-schema.md`

## Browser shows "Connection Error / Disconnected from server" on every load
- **Cause (was):** the component that starts a connection was mounted only after a connection existed, so nothing could ever connect.
- **Rule:** `AppRouter.screen` routes every non-connected status to the Welcome screen; errors render as a dismissible toast, never as a destination. Do not re-debug the backend for this symptom.
- **Reference:** `packages/game-ui/src/AppRouter.ts`

## Never mock the module under test
- **Rule:** Rule tests drive the real `GameRuntime` through `FakeHost` with the real `WitClashState`; room tests boot a real Colyseus server with `bootTestServer`; UI tests use a real state object through `StubRoom`. Mocking `colyseus` and the schema decorator hid real bugs twice (a missing player on join, a no-op schema serialiser).
- **Reference:** `games/wit-clash/tests/game/support.ts`, `packages/server/src/testing/index.ts`

## Svelte coverage and template text
- **Rule:** In `.svelte` templates, text mixing literal and interpolated values is written as one template literal: `{`Matchup ${vm.n} of ${vm.total}`}`, never `Matchup {vm.n} of {vm.total}`.
- **Cause:** The Svelte compiler emits `${vm.n ?? ''}` for each bare interpolation in mixed text. The unreachable `''` side shows up as an uncovered v8 branch. A template literal is known to be defined, so no fallback is emitted.
- **Biome:** `html.experimentalFullSupportEnabled` is on, so Svelte templates are linted and the old `.svelte` unused-import override is gone. Every `<button>` needs `type="button"` (`a11y/useButtonType`).

## A `$derived` that returns a schema instance never re-runs
- **Cause:** Colyseus mutates schema instances in place and `$derived` deduplicates by identity, so `$derived(state.matchups[i])` readers never update.
- **Fix:** Expose plain getters, or derive primitives and fresh snapshots (`[...state.items].map(...)`), as the viewmodels do.
- **Reference:** `docs/framework/README.md` (Reactivity)

## Production bundle shipped Svelte's dev runtime
- **Cause:** `resolve.conditions: ["browser", "development"]` applied to every mode.
- **Fix:** `development` is added only for `vite serve`; the build emits component CSS to a file. Both changes cut about 11 kB of JS from the bundle.
- **Reference:** `packages/config/src/vite.ts`

## UI integration tests and the global `WebSocket`
- **Cause:** Node's built-in `WebSocket` dispatches events jsdom's `Event` does not recognise, and `@colyseus/sdk` picks its WebSocket once, at import.
- **Fix:** `packages/game-client/test-setup.ts` (exported as `@partygame/game-client/test-setup`; used by game-client's own tests; the `uiTestConfig` preset adds it to `setupFiles` by default) hides the global while the SDK is first imported so it falls back to `ws`, and shims the storages.

## Tests used to read a stale `dist/` of workspace packages
- **Cause (was):** vitest resolved `@partygame/*` cross-package imports through `node_modules` to each package's `dist/`, so after editing e.g. `packages/core/src` you had to run `bun run build` before another package's tests would see the change (per-package runs use source; cross-package ones did not).
- **Rule:** the shared vitest preset (`shared()` in `packages/config/src/vitest.ts`) installs a `resolve.alias` mapping every `@partygame/*` export subpath to its package source, so tests never need a build first. `dist/` is still required for real consumers (launcher, dev server) — this only fixes the test path.
- **Rule:** both presets install the same svelte transform (`svelte({ emitCss: false })`). v8 coverage merges per-project maps by source location; if one project loaded a `.svelte.ts` file with a different transform (e.g. plain TS), its extra statements/branches show up as phantom uncovered lines and break the 100% thresholds.
- **Rule:** jsdom compiles `.svelte.ts` in Svelte's client mode, node projects in server mode, and `$state`/`$derived` class fields compile differently in the two modes. In a runes file loaded by both environment types, assign reactive fields in the constructor, not as field initializers (see `countdown.svelte.ts`).
- **Rule:** the UI (jsdom) preset resolves `@partygame/server/node` and `@partygame/server/testing` to `dist/`, not source (`JSDOM_DIST_ONLY`). jsdom uses Vite's client pipeline, which rewrites value imports of node: builtins as CJS interop; its remapped v8 items don't line up with the SSR-transformed ones from node projects and leave phantom uncovered lines (e.g. `node.ts` claimPort). A subpath whose source graph value-imports a node: builtin must be added to that list.
- **Reference:** `packages/config/src/vitest.ts` (`sourceAliases`, `JSDOM_DIST_ONLY`, `nodeTestConfig`), `packages/config/tests/vitest.test.ts`

## StateView entries must be hidden before they are deleted
- **Cause:** `GameRoom` remembers every ref passed to `ctx.showTo` and re-adds it to a reconnecting client's view.
- **Rule:** call `ctx.hideFrom(playerId, entry)` before deleting a `.view()` entry from the state.
- **Reference:** `packages/server/src/rooms/GameRoom.ts`
