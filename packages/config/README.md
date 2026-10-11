# @partygame/config

Build and test presets so a game's config files are one-liners. Add it as a devDependency.

| Import | What |
|---|---|
| `@partygame/config/vite` | `defineGameViteConfig({ port?, overrides? })`: Svelte, LAN dev server, `development` condition only for `vite serve` |
| `@partygame/config/vitest` | `uiTestConfig`, `nodeTestConfig`: jsdom + Svelte or node test projects |
| `@partygame/config/svelte` | `svelteConfig`: `vitePreprocess()`, runes mode |
| `@partygame/config/tsconfig.base.json`, `/tsconfig.game.json` | compiler options for a game (`game` extends `base`) |

## Vite

```ts
// vite.config.ts
import { defineGameViteConfig } from "@partygame/config/vite";

export default defineGameViteConfig();
// defineGameViteConfig({ port: 5200, overrides: { build: { sourcemap: true } } })
```

`port` defaults to 5173; the dev server listens on every interface so phones on the LAN can join. `overrides` is merged last.

## Vitest

`uiTestConfig` runs jsdom + Svelte tests with jest-dom and `@partygame/game-client/test-setup` as default `setupFiles`. `nodeTestConfig` is for rules, bots and terminal tests. Both compile Svelte sources (`.svelte`, `.svelte.ts`) with the same transform, so a node test that loads another package's runes file (e.g. `GameConnectionManager` via `@partygame/game-client/testing`) gets identical code — and identical v8 coverage — to the UI projects.

```ts
// vitest.config.ts
import { uiTestConfig } from "@partygame/config/vitest";

export default uiTestConfig({ name: "my-game", coverage: ["src/**/*.ts", "ui/**/*.ts"] });
```

Options: `{ name, coverage, include?, exclude?, setupFiles?, overrides? }`. `include` defaults to `tests/**/*.test.ts`; `exclude` always adds `dist/**`, `node_modules/**` and `coverage/**`; a given `setupFiles` replaces the UI default. In a multi-project setup, give each project its own `name` and call `nodeTestConfig({ name, coverage, include: [...] })` for the non-UI ones.

Both presets install a `resolve.alias` that maps every `@partygame/*` export subpath to its package **source** (`src/...`, enumerated from each package's `exports`), so a test never reads another workspace's stale `dist/` build — no `bun run build` is needed before running tests after editing a dependency package.

One exception, in the UI preset only: `@partygame/server/node`, `@partygame/server/probe` and `@partygame/server/testing` resolve to `dist/`. jsdom transforms modules with Vite's client pipeline, which rewrites value imports of node: builtins as CJS interop; remapped through source maps, their v8 coverage items don't line up with the SSR-transformed ones from node projects (the provider merges per-project maps by source location), leaving phantom uncovered lines. UI tests need a working test server, not fresh source — the server package's own tests cover that source. If you add a subpath whose source graph value-imports a node: builtin, add it to `JSDOM_DIST_ONLY` in `src/vitest.ts` (and its test twin in `tests/vitest.test.ts`). Real consumers (the launcher, the dev server) still resolve through `dist/` as usual; this only changes what vitest loads.

## Svelte

```js
// svelte.config.js
export { svelteConfig as default } from "@partygame/config/svelte";
```

## TypeScript

```json
{
  "extends": "@partygame/config/tsconfig.game.json",
  "include": ["src/**/*.ts", "ui/**/*.ts", "ui/**/*.svelte", "tests/**/*.ts"]
}
```

`tsconfig.game.json` sets bundler resolution, `strict`, `isolatedModules`, `verbatimModuleSyntax` and the test types (vitest globals, jsdom, vite/client, jest-dom).

Peer dependencies: `vite`, `vitest`, `svelte`, `@sveltejs/vite-plugin-svelte`

Guide: [docs/framework/README.md#config-presets](../../docs/framework/README.md#config-presets)
