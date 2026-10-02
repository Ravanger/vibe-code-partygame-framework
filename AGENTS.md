# Party Game Framework (vibe-coded)

> **Goal:** A flexible, modern, TypeScript-first framework for building immersive, multi-device social party games.
> **Status:** Playable end to end. Plan 10 (framework inversion) stages 1-7 are done: XState-driven `GameRuntime`, generic Colyseus `GameRoom`, generic Svelte SDK, WitClash as a game on top; 4-bot playtest and review fixes landed. Stage 8 (QR join, TV view, kick/settings UI, podium, best-answer award, progress and typing badges) is done. Stage 9 (lifecycle review fixes: name entry for late joiners, minimum players, host `END_GAME`, spectator resume, seated-only podium, `NAME_TAKEN`, spectator-only rooms dispose) is done; Plan 12 (UI redesign, "House Party" look: paper, tape, player stickers, sparkler timer, phase banners; UX fixes from `.AGENTS/plans/12-redesign-audit.md`) is done. Plan 14 (quick hoists into the framework packages) is done. Goal: WitClash keeps rules and logic only; packages stay extendable from the game. Next: plan 15, `@partygame/bots`. Open: persistence (Phase 9), i18n, plugins (`.AGENTS/plans/13-hoisting-scan.md`). Plans: `.AGENTS/plans/10-framework-inversion.md`, `.AGENTS/plans/12-redesign.md`.

## !Note: Internal agent files (checklists, logs, notes, memories, etc.) should go in the `.AGENTS/` directory

## !Note: Library documentation is maintained in `.AGENTS/docs/libraries/` - check this directory for up-to-date API references

## Core Mandates

- **Terminology:** DO NOT mention "Jackbox" in any documentation, code, or communication.
- **TDD First:** NO production code without a failing test first. 100% coverage (statements, branches, functions, lines) for every package and game; `vitest.config.mts` enforces it.
- **Modern Tech Stack:** Bun, Colyseus 0.18, XState v5, Zod 4, Svelte 5, Vitest 4, Biome 2 (versions in the table below).
- **Strict Separation:** Dependencies flow `games/* -> packages/server -> packages/core -> packages/shared`; `game-client` depends on `shared` at runtime (`core` and `server` are dev-only, for tests). No package imports `games/`. Framework packages contain no game vocabulary.
- **Players are keyed by `playerId`** (client-generated UUID) in state, private maps and scores. `sessionId` exists only inside `GameRoom`.
- **No `any`** (Biome `noExplicitAny` is an error), tests included.
- **Security:** Zod validation for every client input (protocol envelope, action payloads, options, join options). Rate limiting and structured logging are not built yet.
- **Horizontal Scalability:** not built yet. Room codes live in an in-memory `RoomCodeService`, so the server is one process.
- **Documentation First:** All public-facing APIs MUST have clear, DX-friendly documentation (JSDoc, `docs/framework/README.md`, usage examples) established BEFORE implementation. Documentation is a living design document.
- **Directory Mandates:** ALL agent-related files (checklists, logs, internal plans) MUST reside in `.AGENTS/`. The `docs/` directory is reserved for developer-facing and user-facing documentation only.
- **Agent Maintenance:** Agents MUST maintain compact, up-to-date session logs and checklists in the `.AGENTS/` directory as work progresses. Summarize periodically to prevent file bloat.

## Project Structure (Monorepo)

- `packages/shared`: wire protocol (`protocol.ts`: message names, `ErrorCode`, `ActionResult`, zod schemas), helpers (`waitFor`, `resolveRoomCode`, `joinUrl`/`tvUrl`, `NAME_MAX_LENGTH`) and the browser-safe state classes (`@partygame/shared/schema`: `BaseGameState`, `PlayerSchema`).
- `packages/core`: pure game runtime, no Colyseus: `defineGame`, `actionFactory`, `GameRuntime` (XState actor per room, built-in Lobby/`START_GAME`/`SET_OPTIONS`/`KICK_PLAYER`), `scoring.ts` helpers, `shuffle`/`required`; `@partygame/core/testing` has `FakeHost`.
- `packages/server`: generic Colyseus host: `createGameServer`, `GameRoom`, `createApiHandler` (`/api/resolve-code`), `RoomCodeService`; `@partygame/server/bun` (`startServer`), `/node` (`freePort`, `serveApi`), `/content` (`loadJsoncDir`) and `/testing` (`bootTestServer`).
- `packages/game-client`: Svelte 5 SDK: `GameConnectionManager`, `Countdown`, `resolveEndpoints`, `readCodeParam`; `/testing` has `StubRoom`, `/test-setup` is the vitest setup file for jsdom.
- `packages/cli`: Scaffolding tool for new games **(planned, not yet created)**.
- `games/wit-clash`: reference game (Quiplash-style). `src/` rules, `ui/` Svelte client, `server.ts` Bun entry, `content/categories/*.jsonc` host-editable prompts. See `games/wit-clash/README.md`.
- `docs/`: `framework/README.md` (game author guide), `HOSTING.md` (running and LAN play).
- `launch.ts`: one-command launcher (game server, API and client); wit-clash specific.

## Commands

| Command | What |
|---|---|
| `bun run build` | turbo: every package, then the Vite client bundle |
| `bun run typecheck` | turbo: `tsc` per package, plus `svelte-check` for the game. `bun run typecheck:launch` covers `launch.ts` |
| `bun run lint` | `biome check .` through the local binary (`./node_modules/.bin/biome.exe check .` on Windows; not `npx`) |
| `bun run test:coverage` | `vitest run --coverage` over all projects, 100% thresholds |
| `bun run verify` | lint, typecheck of `launch.ts` and the game, coverage |
| `bun run launch:demo` | dev launch that also opens a watch-only room (room option `seats`) where a host bot and N bots (`--demo[=2..7]`, default 3) play one game; the browser opens `/?tv=CODE`, the TV stays on the final Results. Excludes `--bots`. `terminal/DemoTable.ts` |
| `bun run launch:bots` | dev launch that also opens a room, lands your browser in it and seats 3 bots once you enter your name (`launch.ts <mode> --bots[=1..7]`) |
| `bun run bots <CODE> [count]` | WitClash bots join a room created in the browser and play every turn (`--endpoint`, `--api-port`); Ctrl+C removes them |
| `bun run cli:play [--bots=N] [--name=You] [--join=ABCD]` / `cli:demo [--bots=N] [--rounds=R]` | WitClash in the terminal (`games/wit-clash/terminal/`): play with bots on a server it finds or starts / narrated all-bot game that prints PASS or FAIL |
| `bun run launch` / `launch:host` / `launch:prod` | game server (2567), API (3001), Vite (5173) or built client (3000); `--no-browser` to skip opening one |

## Library Documentation References

Library-specific documentation is maintained in `.AGENTS/docs/libraries/`. Each document provides comprehensive API references, project-specific usage patterns, best practices, and troubleshooting guidance.
Versions are what the consuming package resolves (checked against installed `package.json`), not the root range.

| Library | Documentation | Version |
|---------|---------------|---------|
| **@biomejs/biome** | [biome.md](.AGENTS/docs/libraries/biome.md) | v2.5.15 |
| **@colyseus/bun-websockets** | [colyseus.md](.AGENTS/docs/libraries/colyseus.md) | v0.18.3 |
| **@colyseus/core** | [colyseus.md](.AGENTS/docs/libraries/colyseus.md) | v0.18.18 |
| **@colyseus/schema** | [colyseus-schema.md](.AGENTS/docs/libraries/colyseus-schema.md) | v5.0.35 |
| **@colyseus/sdk** | [colyseus.md](.AGENTS/docs/libraries/colyseus.md) | v0.18.4 |
| **@colyseus/ws-transport** | [colyseus.md](.AGENTS/docs/libraries/colyseus.md) | v0.18.4 |
| *Colyseus test harness (own)* | [colyseus-testing.md](.AGENTS/docs/libraries/colyseus-testing.md) | `@partygame/server/testing` |
| **svelte** | [svelte.md](.AGENTS/docs/libraries/svelte.md) | v5.57.1 |
| **@sveltejs/vite-plugin-svelte** | [svelte.md](.AGENTS/docs/libraries/svelte.md) | v7.3.1 |
| **turbo** | [turbo.md](.AGENTS/docs/libraries/turbo.md) | v2.11.5 |
| **vitest** | [vitest.md](.AGENTS/docs/libraries/vitest.md) | v4.1.11 |
| **@vitest/coverage-v8** | [vitest-coverage.md](.AGENTS/docs/libraries/vitest-coverage.md) | v4.1.11 |
| **xstate** | [xstate.md](.AGENTS/docs/libraries/xstate.md) | v5.33.2 |
| **zod** | [zod.md](.AGENTS/docs/libraries/zod.md) | v4.6.5 |
| **@testing-library/svelte** | [testing-library.md](.AGENTS/docs/libraries/testing-library.md) | v5.4.2 |
| **@testing-library/jest-dom** | [testing-library.md](.AGENTS/docs/libraries/testing-library.md) | v6.10.0 |
| **jsdom** | [jsdom.md](.AGENTS/docs/libraries/jsdom.md) | v29.1.1 |
| **@types/jsdom** | [jsdom.md](.AGENTS/docs/libraries/jsdom.md) | v28.0.3 |
| **vite** | [vite.md](.AGENTS/docs/libraries/vite.md) | v8.3.1 |
| **typescript** | [typescript.md](.AGENTS/docs/libraries/typescript.md) | v6.0.3 |

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
| Multiplayer        | Colyseus 0.18 (`@colyseus/core` 0.18.18, `@colyseus/schema` 5) |
| State Machine      | XState v5.33        |
| Validation         | Zod v4.6            |
| Frontend           | Svelte 5.57 (Runes), Vite 8 |
| Testing            | Vitest v4.1 (`FakeHost` for rules, real Colyseus server for rooms, Testing Library for screens) |
| Linting/Formatting | Biome v2.5          |

## MVP Checklist

- [x] Phase 0: Monorepo Scaffold & Tooling
- [x] Phase 1: Core DSL (`defineGame`, `actionFactory`; phases, actions, options, timers)
- [x] Phase 2: Server-side Room Logic; `GameRuntime` driven by an XState actor, built-in Lobby
- [x] Phase 3: Per-player private state (StateView, `.view()` fields); votes hidden until the reveal
- [x] Phase 4: Svelte 5 Client SDK (`GameConnectionManager`)
- [x] Phase 5: Reference Game Implementation (WitClash)
- [x] Phase 6: Playable loop: Welcome, Waiting Room, Category Voting, Prompting, Answer Voting, Reveal, Results
- [x] Phase 7: Reconnection (SDK token reconnect, or a new session with the same `playerId`)
- [x] Phase 8: Host-editable content
- [x] Phase 8b (plan 10): spectator join option, host `KICK_PLAYER` and `SET_OPTIONS`, request/response actions (`ActionResult`), mid-game joiners wait for the next round (`JoinNextRound` screen), no-answer forfeits, no repeat prompts. The UI uses all three: TV view, host remove buttons, lobby settings form.
- [ ] Phase 9: Persistence provider (Firebase/Supabase); the old `database/` package was deleted, nothing replaces it yet
- [x] Phase 10: QR code join (`uqr` renders the waiting-room QR of `<origin>/?code=ABCD`; `?code=` auto-joins, `?tv=` auto-watches)
- [x] Phase 11a (plan 10 stage 8): TV view (`manager.isSpectator`, `main.tv` layout), host remove button with confirm, lobby settings form
- [x] Phase 11b (plan 10 stage 8): Results podium (ties share a step, leavers marked, tie-breaker badge), best-answer award, per-player progress and typing badges (`SET_TYPING` from Prompting and TieBreakerPrompting)
- [x] Plan 10 stage 7: 4-bot playtest re-run, code review, fixes
- [x] Plan 10 stage 9: lifecycle review fixes, 4-bot playtest A-G pass

## Troubleshooting

### Vite 8 + Svelte Plugin Compatibility
- **Issue:** `optimizeDeps.esbuildOptions` deprecation warning
- **Cause:** `@sveltejs/vite-plugin-svelte` < 7.0.0 uses deprecated option
- **Fix:** Upgrade to `^7.0.0` (supports Vite 8's rolldown optimizer)
- **Reference:** `games/wit-clash/package.json`

### Colyseus Schema 5 is decorator-free
- **Rule:** Define state with `schema({ field: t.string().default("") }, "Name")` and extend with `BaseGameState.extend({ ... }, "Name")`. `experimentalDecorators`, `emitDecoratorMetadata`, `useDefineForClassFields: false`, Vitest `ts-transform` plugins and `oxc: false` were deleted. Do not reintroduce them.
- **Limits:** 63 fields per schema class; primitive collection elements are type names (`t.map("number")`).
- **Reference:** `packages/shared/src/schema/BaseGameState.ts`, `.AGENTS/docs/libraries/colyseus-schema.md`

### Browser shows "Connection Error / Disconnected from server" on every load
- **Cause (was):** the component that starts a connection was mounted only after a connection existed, so nothing could ever connect.
- **Rule:** `AppViewModel.screen` routes every non-connected status to the Welcome screen; errors render as a dismissible toast, never as a destination. Do not re-debug the backend for this symptom.
- **Reference:** `games/wit-clash/ui/viewmodels/AppViewModel.ts`

### Never mock the module under test
- **Rule:** Rule tests drive the real `GameRuntime` through `FakeHost` with the real `WitClashState`; room tests boot a real Colyseus server with `bootTestServer`; UI tests use a real state object through `StubRoom`. Mocking `colyseus` and the schema decorator hid real bugs twice (a missing player on join, a no-op schema serialiser).
- **Reference:** `games/wit-clash/tests/game/support.ts`, `packages/server/src/testing/index.ts`

### Svelte coverage and template text
- **Rule:** In `.svelte` templates, text mixing literal and interpolated values is written as one template literal: `{`Matchup ${vm.n} of ${vm.total}`}`, never `Matchup {vm.n} of {vm.total}`.
- **Cause:** The Svelte compiler emits `${vm.n ?? ''}` for each bare interpolation in mixed text. The unreachable `''` side shows up as an uncovered v8 branch. A template literal is known to be defined, so no fallback is emitted.
- **Biome:** `html.experimentalFullSupportEnabled` is on, so Svelte templates are linted and the old `.svelte` unused-import override is gone. Every `<button>` needs `type="button"` (`a11y/useButtonType`).

### A `$derived` that returns a schema instance never re-runs
- **Cause:** Colyseus mutates schema instances in place and `$derived` deduplicates by identity, so `$derived(state.matchups[i])` readers never update.
- **Fix:** Expose plain getters, or derive primitives and fresh snapshots (`[...state.items].map(...)`), as the viewmodels do.
- **Reference:** `docs/framework/README.md` (Reactivity)

### Production bundle shipped Svelte's dev runtime
- **Cause:** `resolve.conditions: ["browser", "development"]` applied to every mode.
- **Fix:** `development` is added only for `vite serve`; the build emits component CSS to a file. Both changes cut about 11 kB of JS from the bundle.
- **Reference:** `games/wit-clash/vite.config.ts`

### UI integration tests and the global `WebSocket`
- **Cause:** Node's built-in `WebSocket` dispatches events jsdom's `Event` does not recognise, and `@colyseus/sdk` picks its WebSocket once, at import.
- **Fix:** `packages/game-client/test-setup.ts` (exported as `@partygame/game-client/test-setup`; used by game-client's own tests and the game's vitest `setupFiles`) hides the global while the SDK is first imported so it falls back to `ws`, and shims the storages.

### StateView entries must be hidden before they are deleted
- **Cause:** `GameRoom` remembers every ref passed to `ctx.showTo` and re-adds it to a reconnecting client's view.
- **Rule:** call `ctx.hideFrom(playerId, entry)` before deleting a `.view()` entry from the state.
- **Reference:** `packages/server/src/rooms/GameRoom.ts`

## Extension Points

Paths are relative to `games/wit-clash/` unless they start with `packages/`. Tests go next to the layer you touch: `tests/game/` (rules, via `Table` in `tests/game/support.ts`), `tests/viewmodels/`, `tests/screens/`.

| To add... | Do this |
|---|---|
| A category or prompt | Drop a `.jsonc` file into `content/categories/` and restart the server. No code. Category ids and prompt ids must be unique across all files (used-prompt tracking is by id). |
| A game phase | 1. Add the name to `PHASE` in `src/phaseNames.ts`. 2. Create `src/phases/<Name>.ts` exporting a `WitClashPhase` (`onEnter`, `duration` + `onTimeout`, `onRosterChange`, `actions`). 3. Add one line to `phases` in `src/game.ts`. 4. Add any synced field to `src/state.ts` (the client contract) and server-only data to `src/private.ts`. Move between phases with `ctx.transition(PHASE.X)` only. |
| A screen for a phase | 1. `ui/viewmodels/<Name>ViewModel.ts` (reads `manager.state`, never recomputes rules). 2. `ui/screens/<Name>.svelte`. 3. One entry in `PHASE_SCREENS` in `ui/screens/index.ts`: `[PHASE.X]: { component, waitingLabel }` (a missing phase is a compile error). `AppViewModel` routes, `App.svelte` renders and `JoinNextRound` labels from that table. A screen must also render with no seat (`manager.isSpectator`, the TV display): no inputs, progress shown large. |
| A client action | 1. Name in `ACTION` (`src/actionNames.ts`, `SCREAMING_SNAKE_CASE`; `START_GAME`, `KICK_PLAYER`, `SET_OPTIONS` are reserved). 2. zod payload schema and payload type in `src/actions.ts`. 3. `[ACTION.X]: defineAction({ from, payload, handler })` in the accepting phase's `actions`. 4. `manager.sendAction(ACTION.X, payload)` from a viewmodel; it resolves with an `ActionResult` and rejections also land in `manager.lastServerError`. Reject with `ctx.reject(ErrorCode.NOT_ALLOWED, "why")`. |
| An option | Add the field, default and range to `WitClashOptionsSchema` in `src/options.ts` (the single source). Read it as `ctx.options.<name>` in phases. The client reads the published `state.options` JSON through the same schema (see `LobbySettingsViewModel`). The lobby settings form is generated from the same schema (`ui/optionFields.ts` reads the bounds through `z.toJSONSchema`): every bounded numeric field gets a labelled number input for the host and a read-only line for everyone else, so a new numeric option needs no UI edit. The host changes options with the built-in `SET_OPTIONS`. |
| A timed phase | Set `duration` (ms, or a function of `ctx`) and `onTimeout` on the phase; the runtime writes `state.phaseEndsAt` and the server owns the clock. Client side: `manager.countdown()`, as in `ui/viewmodels/CategoryVoteViewModel.ts`. |
| A scoring rule | Edit `src/scoring.ts` (`calculateMatchupAwards`, `settleMatchup`, constants). Points are applied in `src/phases/MatchupReveal.ts` through `awardPoints` from `@partygame/core`. |
| A whole new game | 1. `games/<name>/` with its own `package.json` (copy `games/wit-clash/package.json`; the `games/*` workspace and turbo pick it up), `tsconfig.json`, `vite.config.ts`, `index.html`. 2. `src/state.ts` extending `BaseGameState` from `@partygame/shared/schema`; `src/private.ts`; `src/phaseNames.ts`, `src/actionNames.ts`, `src/actions.ts` (`actionFactory`); `src/phases/*.ts`; `src/game.ts` with `defineGame`. 3. `server.ts`: `startServer({ games: [{ roomName, definition, stateClass }] })` from `@partygame/server/bun`. 4. `ui/`: a `GameConnectionManager<YourState>` in `main.ts` with its own `storagePrefix`, plus screens and viewmodels. 5. Add its vitest configs to `projects` in the root `vitest.config.mts`. `launch.ts` is wit-clash specific (`GAME_DIR`). Guide: `docs/framework/README.md`. |
| A framework feature | Host built-ins live in `packages/core/src/runtime/lobby.ts`; the runtime in `packages/core/src/runtime/GameRuntime.ts`; seats, reconnection and views in `packages/server/src/rooms/GameRoom.ts`; wire names and error codes in `packages/shared/src/protocol.ts`. The runtime stays Colyseus-free: new needs go through the `RuntimeHost` interface (`packages/core/src/runtime/types.ts`) and `FakeHost`. |

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
