# Party Game Framework (vibe-coded)

> **Goal:** A flexible, modern, TypeScript-first framework for building immersive, multi-device social party games.
> **Status:** Initial Setup (Phase 0)

## !Note: Internal agent files (checklists, logs, notes, memories, etc.) should go in the `.AGENTS/` directory

## !Note: Library documentation is maintained in `.AGENTS/docs/libraries/` - check this directory for up-to-date API references

## Core Mandates

- **Terminology:** DO NOT mention "Jackbox" in any documentation, code, or communication.
- **TDD First:** NO production code without a failing test first. 100% coverage target for `core` and `shared`.
- **Modern Tech Stack:** Bun 1.1+, Colyseus 0.17, XState v5, Zod, Svelte 5, Vitest, Biome.
- **Strict Separation:** Clear boundaries between `core` (logic), `server` (multiplayer), and `client` (UI).
- **Security:** Zod validation for all inputs, rate limiting, and structured logging.
- **Horizontal Scalability:** Redis adapter pattern for multi-node support.
- **Documentation First:** All public-facing APIs MUST have clear, DX-friendly documentation (JSDoc, API reference site, usage examples) established BEFORE implementation. Documentation is a living design document.
- **Directory Mandates:** ALL agent-related files (checklists, logs, internal plans) MUST reside in `.AGENTS/`. The `docs/` directory is reserved for developer-facing and user-facing documentation only.
- **Agent Maintenance:** Agents MUST maintain compact, up-to-date session logs and checklists in the `.AGENTS/` directory as work progresses. Summarize periodically to prevent file bloat.

## Project Structure (Monorepo)

- `packages/shared`: Validation schemas, types, and constants.
- `packages/core`: Pure TypeScript game engine logic and DSL (`defineGame`).
- `packages/server`: Colyseus room implementation and XState integration.
- `packages/client`: Svelte 5 SDK for game clients.
- `packages/cli`: Scaffolding tool for new games.
- `games/reference`: Canonical demo game (Quiplash-style).

## Library Documentation References

Library-specific documentation is maintained in `.AGENTS/docs/libraries/`. Each document provides comprehensive API references, project-specific usage patterns, best practices, and troubleshooting guidance.

| Library | Documentation | Version |
|---------|---------------|---------|
| **@biomejs/biome** | [biome.md](.AGENTS/docs/libraries/biome.md) | v2.4.12 |
| **colyseus** | [colyseus.md](.AGENTS/docs/libraries/colyseus.md) | v0.17.41 |
| **@colyseus/core** | [colyseus.md](.AGENTS/docs/libraries/colyseus.md) | v0.17.41 |
| **@colyseus/sdk** | [colyseus.md](.AGENTS/docs/libraries/colyseus.md) | v0.17.40 |
| **@colyseus/schema** | [colyseus-schema.md](.AGENTS/docs/libraries/colyseus-schema.md) | v4.0.20 |
| **@colyseus/testing** | [colyseus-testing.md](.AGENTS/docs/libraries/colyseus-testing.md) | v0.17.11 |
| **@colyseus/ws-transport** | [colyseus-ws-transport.md](.AGENTS/docs/libraries/colyseus-ws-transport.md) | v0.17.13 |
| **svelte** | [svelte.md](.AGENTS/docs/libraries/svelte.md) | v5.55.4 |
| **@sveltejs/vite-plugin-svelte** | [svelte.md](.AGENTS/docs/libraries/svelte.md) | v7.0.0 |
| **turbo** | [turbo.md](.AGENTS/docs/libraries/turbo.md) | v2.9.6 |
| **vitest** | [vitest.md](.AGENTS/docs/libraries/vitest.md) | v4.1.4 |
| **@vitest/coverage-v8** | [vitest.md](.AGENTS/docs/libraries/vitest.md) | v4.1.4 |
| **xstate** | [xstate.md](.AGENTS/docs/libraries/xstate.md) | v5.30.0 |
| **zod** | [zod.md](.AGENTS/docs/libraries/zod.md) | v4.3.6 |
| **@testing-library/svelte** | [testing-library.md](.AGENTS/docs/libraries/testing-library.md) | v5.3.1 |
| **@testing-library/jest-dom** | [testing-library.md](.AGENTS/docs/libraries/testing-library.md) | v6.9.1 |
| **@testing-library/user-event** | [testing-library.md](.AGENTS/docs/libraries/testing-library.md) | v14.6.1 |
| **jsdom** | [jsdom.md](.AGENTS/docs/libraries/jsdom.md) | v29.0.2 |
| **@types/jsdom** | [jsdom.md](.AGENTS/docs/libraries/jsdom.md) | v28.0.1 |
| **vite** | [vite.md](.AGENTS/docs/libraries/vite.md) | v8.0.8 |
| **typescript** | [typescript.md](.AGENTS/docs/libraries/typescript.md) | v6.0.3 |
| **pino** | (reference only) | v9.x |

## Development Workflow

1. **Research & Plan:** Use `writing-plans` to define tasks.
2. **TDD Cycle:**
   - Write failing test (RED).
   - Verify failure.
   - Write minimal implementation (GREEN).
   - Verify pass.
   - Refactor.
3. **Commit:** Use conventional commits. (User will handle final commits).

## Tech Stack Details

| Layer              | Technology          |
| ------------------ | ------------------- |
| Runtime            | Bun                 |
| Multiplayer        | Colyseus 0.17       |
| State Machine      | XState v5.30        |
| Validation         | Zod v4              |
| Frontend           | Svelte 5 (Runes)    |
| Testing            | Vitest v4 + fast-check |
| Linting/Formatting | Biome v2            |
| Logging            | Pino                |

## MVP Checklist

- [x] Phase 0: Monorepo Scaffold & Tooling
- [x] Phase 1: Core DSL (`defineGame`, `phase`, `action`)
- [x] Phase 2: Server-side Room Logic & State Machine Sync
- [x] Phase 3: Role-based State Visibility (StateView)
- [x] Phase 4: Svelte 5 Client SDK
- [x] Phase 5: Reference Game Implementation (WitClash)

## Troubleshooting

### Vite 8 + Svelte Plugin Compatibility
- **Issue:** `optimizeDeps.esbuildOptions` deprecation warning
- **Cause:** `@sveltejs/vite-plugin-svelte` < 7.0.0 uses deprecated option
- **Fix:** Upgrade to `^7.0.0` (supports Vite 8's rolldown optimizer)
- **Reference:** `games/wit-clash/package.json`

### Turbo Deprecation
- **Issue:** `--parallel` flag deprecated
- **Fix:** Remove flag - turbo runs tasks in parallel by default
- **Reference:** `package.json` script `dev:all`

### GameRoom Player Creation on Join
- **Issue:** `Failed to join game: TypeError: Cannot read properties of undefined (reading 'name')`
- **Cause:** 
  - `GameRoom.onJoin` tried to retrieve a player from `state.players` that didn't exist (no player creation)
  - Missing null checks for `this.gameDefinition` which could also cause undefined access errors
- **Fix:** 
  - **0779e03:** Added player creation in `onJoin` handler (`packages/server/src/rooms/GameRoom.ts:65-71`)
  - **Current:** Added null checks for `this.gameDefinition` in `onCreate()` and `onJoin()` with clear error messages
  - **Current:** Added comprehensive logging to track room lifecycle and player creation
- **Testing:** 
  - Tests mocked at the wrong level (mocked entire `colyseus` module) so they passed despite the bug
  - Added unit tests in `GameRoom.test.ts` and improved `connection.test.ts`
  - Added integration tests in `GameRoom.integration.test.ts` with 7 new tests covering player creation and error scenarios
- **Logging:** Added `[GameRoom]` prefixed logging at INFO, ERROR, and DEBUG levels for debugging

### TypeScript Build Configuration
- **Issue:** `tsc` not outputting to `dist/` directory despite `outDir` config
- **Fix:** Delete `tsconfig.tsbuildinfo` to force fresh build - turbo caching was skipping compilation
- **Reference:** `packages/server/tsconfig.tsbuildinfo`

### Colyseus v0.17 Client/Server Version Mismatch
- **Issue:** `joinOrCreate` fails with `Cannot read properties of undefined (reading 'name')` - client expects `response.room.name` but server returns `name` directly at top level
- **Cause:** Using `colyseus.js` v0.16 client with Colyseus v0.17 server. v0.17 changed the seat reservation response format and the client package was renamed from `colyseus.js` to `@colyseus/sdk`
- **Fix:** Upgraded client from `colyseus.js: ^0.16.0` to `@colyseus/sdk: ^0.17.26` in `packages/client/package.json` and updated all imports from `"colyseus.js"` to `"@colyseus/sdk"`
- **Files:** `packages/client/package.json`, `packages/client/src/*.ts`, `packages/client/tests/*.test.ts`
- **Reference:** [Colyseus Migration Guide v0.17](https://docs.colyseus.io/migrating/0.17)

### Vitest v4 Mocking Changes
- **Issue:** Vitest v4 changed how mocks are hoisted, causing `ReferenceError: Cannot access 'MockClient' before initialization` when mock classes are defined at module level
- **Cause:** In Vitest v4, `vi.mock()` factory functions are hoisted to the top of the file, so any variables (including class definitions) referenced in the mock must be defined inside the factory function
- **Fix:** Move mock class definitions inside the `vi.mock()` factory function. Use prototype methods instead of instance properties to allow tests to modify `Client.prototype.joinOrCreate`
- **Files:** `packages/client/tests/GameClient.test.ts`, `packages/client/tests/connection.test.ts`, `packages/client/tests/state.test.ts`
- **Reference:** [Vitest Migration Guide v4](https://vitest.dev/guide/migration.html#vi-mock-changes)

### Biome v2 Configuration Changes
- **Issue:** Biome v2 has different configuration keys - `organizeImports` was removed/renamed, `noConsoleLog` rule no longer exists
- **Cause:** Biome v2 reorganized configuration structure and rule names
- **Fix:** Removed unsupported `organizeImports` top-level key, removed `noConsoleLog` from suspicious rules section
- **Files:** `biome.json`
- **Reference:** [Biome Migration Guide](https://biomejs.dev/guides/migrate-to-v2/)

### TypeScript 6.0 Compatibility
- **Issue:** TypeScript 6.0 has stricter type checking and new features
- **Fix:** No code changes required - all existing code passes with TypeScript 6.0.2
- **Files:** `package.json`, `packages/*/package.json`, `games/wit-clash/package.json`
