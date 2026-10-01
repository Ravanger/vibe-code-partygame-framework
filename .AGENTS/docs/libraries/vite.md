# Vite Documentation

> **Version:** 8.3.1 (`packages/game-client` devDep and `games/wit-clash` devDep; Vitest also runs on it)
> **Plugin:** `@sveltejs/vite-plugin-svelte` 7.3.1 (see [svelte.md](svelte.md))

## Overview
Vite serves and builds the WitClash client (`games/wit-clash`: `vite`, `vite build`). `packages/game-client` has a `dev: vite` script but is **built with plain `tsc`** (`rm -rf dist && tsc`), not Vite library mode. There is no root `vite.config`; Vitest reads each package's `vitest.config.ts`.

## `games/wit-clash/vite.config.ts` (actual)
```ts
plugins: [svelte({ emitCss: false, preprocess: [] })],
server: { host: true, port: 5173 },
resolve: { conditions: ["browser", "development"] },
```
- `server.host: true` exposes the dev server on the LAN so phones can load the page. `ui/config.ts` then derives the Colyseus endpoint from `window.location.hostname`.
- Env overrides read through `import.meta.env`: `VITE_SERVER_HOST`, `VITE_GAME_PORT` (2567), `VITE_API_PORT` (3001), `VITE_MIN_PLAYERS` (3). They are parameterised in functions for testability.
- `svelte.config.js` uses `vitePreprocess()` and `compilerOptions.runes: true`.

## Vite 8 specifics that matter here
- Bundler is Rolldown/oxc. `optimizeDeps.esbuildOptions` is removed; `@sveltejs/vite-plugin-svelte` below 7 still sets it and warns. Fix is plugin ^7 (done).
- Vite's oxc TypeScript transform could not handle `@colyseus/schema` legacy decorators, which used to force `oxc: false` plus a `transpileModule` plugin. Schema 5 (`schema()`/`t.*`) needs neither; the default transform is used everywhere.
- `resolve.conditions: ["browser"]` is required in Vitest configs for Svelte component tests.

## Best Practices in This Project
- Keep environment access in `ui/config.ts`, not scattered `import.meta.env` reads.
- Do not add SvelteKit; the app is a plain Vite + Svelte SPA mounted by `ui/main.ts`.

## Troubleshooting
- `optimizeDeps.esbuildOptions` deprecation warning: plugin below 7.0.0.
- Phone cannot reach the app: confirm `server.host: true` and that ports 5173, 2567 and 3001 are reachable.

## References
- [Vite docs](https://vite.dev/guide/), [Vite 8 migration](https://vite.dev/guide/migration)
