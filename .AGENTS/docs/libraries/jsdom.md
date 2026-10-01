# JSDOM Documentation

> **Version:** 29.1.1 (`jsdom` in root and `games/wit-clash` devDeps; 30.x deliberately not adopted), `@types/jsdom` 28.0.3 (root)
> `packages/game-client` has no `jsdom` dependency of its own; it resolves the root copy.

## Overview
JSDOM is Vitest's DOM environment for client tests. It is never imported directly; it is selected with `test.environment: "jsdom"`.

## Used in this repo
| Where | What |
|---|---|
| `games/wit-clash/vitest.config.ts` | `environment: "jsdom"`, `globals: true`, `resolve.conditions: ["browser"]`, setup `../../vitest.setup.ts`. |
| `packages/game-client/vitest.config.ts` | `environment: "jsdom"`, setup `./vitest.setup.ts`. |
| `games/wit-clash/tsconfig.json` | `"types": ["vitest/globals", "jsdom", "vite/client", "@testing-library/jest-dom"]`. |

## Gotchas
- **Storage:** Node's experimental `localStorage` getter survives on `globalThis` under jsdom, and `@colyseus/sdk` reads it while constructing `Auth`, emitting an `ExperimentalWarning`. `packages/game-client/vitest.setup.ts` shadows `localStorage` and `sessionStorage` with in-memory `Storage` objects via `Object.defineProperty(globalThis, ...)`. The root `vitest.setup.ts` does the same for `window.localStorage` (wit-clash). Reconnection tests depend on `witclash.reconnectionToken` going through these stubs.
- jsdom has no layout engine: no `getBoundingClientRect` sizes, no `matchMedia`; stub as needed.
- No real WebSocket; client tests mock `@colyseus/sdk`'s `Client` (hoisted inside `vi.mock` factories, see [vitest.md](vitest.md)).
- Server tests (`packages/server`) run in the default Node environment, not jsdom.

## References
- [jsdom](https://github.com/jsdom/jsdom), [Vitest environments](https://vitest.dev/guide/environment.html)
