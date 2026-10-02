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

`uiTestConfig` runs jsdom + Svelte tests with jest-dom and `@partygame/game-client/test-setup` as default `setupFiles`. `nodeTestConfig` is for rules, bots and terminal tests.

```ts
// vitest.config.ts
import { uiTestConfig } from "@partygame/config/vitest";

export default uiTestConfig({ name: "my-game", coverage: ["src/**/*.ts", "ui/**/*.ts"] });
```

Options: `{ name, coverage, include?, exclude?, setupFiles?, overrides? }`. `include` defaults to `tests/**/*.test.ts`; `exclude` always adds `dist/**`, `node_modules/**` and `coverage/**`; a given `setupFiles` replaces the UI default. In a multi-project setup, give each project its own `name` and call `nodeTestConfig({ name, coverage, include: [...] })` for the non-UI ones.

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
