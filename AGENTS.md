# Party Game Framework (vibe-coded)

A TypeScript-first framework for multi-device social party games. Playable end to end. This file is the single entry point for every coding agent.

## Hard rules

Each rule names the gate that enforces it; `not enforced yet: #N` means a reviewer checks it until that issue lands.

1. MUST keep 100% statements, branches, functions and lines in every package and game. (`vitest` thresholds in `vitest.config.mts`)
2. MUST NOT use `any`, tests included. (`biome` `noExplicitAny`)
3. MUST pass `biome check .` and every `tsc`/`svelte-check`. (`bun run verify`)
4. MUST keep dependency direction. Server side: `games/* -> server -> core -> shared`. Client side: `games/* -> game-ui -> game-client -> shared`; `core` and `server` are allowed there only as `devDependencies` for tests. No package imports `games/`. (`bun run check:boundaries`)
5. MUST NOT put game vocabulary in `packages/` (framework code is game-agnostic). (`bun run check:conventions`)
6. MUST key players by `playerId` in state, private maps and scores; `sessionId` exists only inside `packages/server`. (`bun run check:conventions`)
7. MUST validate client input with Zod: `defineAction` requires a `payload` schema (TypeScript) and `RoomOptionsSchema` parses join options (`GameRoom`). (`bun run typecheck`)
8. MUST NOT mock the module under test; `vi.mock` only `node:` builtins. Rules run through `FakeHost`, rooms through `bootTestServer`, UI through `StubRoom`. (`bun run check:conventions`)
9. MUST NOT reintroduce decorators (`experimentalDecorators`, `emitDecoratorMetadata`); Colyseus Schema 5 is decorator-free. (`bun run check:conventions`)
10. MUST NOT name a commercial party-game brand or product in docs, code or communication. (`bun run check:conventions`)
11. MUST NOT edit generated files (`dist/`, `coverage/`, `node_modules/`, `.turbo/`) or change `bun.lock` without a `package.json` change. (`bun run check:paths`)
12. MUST NOT weaken a gate: lower thresholds, `biome-ignore`, `.skip`/`.only`, or coverage excludes. (`bun run check:gates` in the `gates` CI job; only a maintainer adds the `gate-change` override label)
13. MUST use `++i` in loops, never `i++`. (`biome` plugin `prefer-prefix-increment`)
14. MUST document every public API (JSDoc plus `docs/framework/README.md`) in the same PR. (`bun run check:exports` snapshots the surface; docs not enforced yet: #113)
15. MUST put agent files (plans, logs, checklists, notes) in `.AGENTS/`; `docs/` is for developers and users only; no new files in the repo root. (`bun run check:conventions`)
16. MUST NOT commit or push unless the human asks. (branch protection on `main`: nothing merges without a PR and green CI)

A `lefthook` pre-commit hook (`lefthook.yml`, installed by `bun install`) runs `biome check --staged`, `check:paths` and `check:gates --staged`; `git commit --no-verify` is forbidden.

## Labels

- `agent-ready`: the issue has every section of the task template; an agent may start it.
- `needs-decision`: waits on a maintainer choice. `epic`: a parent; work its children.
- `size:*`, `area:*`, `P0`-`P3`: set by triage.

## Picking up an issue

- Work only on open issues labelled `agent-ready`. Never start one labelled `needs-decision` or `epic`.
- One commit per issue, with `Closes #N` in the body. A lone issue gets its own branch `<type>/<issue>-<slug>`, e.g. `docs/116-agents-hard-rules`; a milestone's issues share one branch `milestone/<n>-<slug>` and one PR.
- Touch only the files the issue lists. If a test forces another file, say why in the PR.
- TDD order: failing test, see it fail, minimal code, see it pass, refactor.
- Use conventional commit subjects (`feat(core): ...`). No plan numbers in subjects.

## Definition of done

- `bun run verify` is green, with 100% coverage.
- Docs and package READMEs are updated for any public API change.
- Every acceptance box from the issue is ticked in the PR body.
- The final report ends with a `Files touched` line listing the changed files.

## When stuck

Stop and comment on the issue with what you tried and what failed. Do not weaken a gate, add `biome-ignore`, lower a threshold, skip a test or widen the scope to get green.

## Packages

Each package's README has its API. Each package also has an `AGENTS.md` (responsibility, what never goes in, allowed `@partygame/*` imports) that `bun run check:agents` checks against its `package.json`.

| Path | Holds |
|---|---|
| [`packages/shared`](packages/shared/README.md) | wire protocol (`protocol.ts`: messages, `ErrorCode`, `ActionResult`, zod schemas), helpers, browser-safe state classes (`/schema`) |
| [`packages/core`](packages/core/README.md) | pure runtime, no Colyseus: `defineGame`, `actionFactory`, `GameRuntime`, built-in lobby actions, action log, scoring helpers; `/testing` (`FakeHost`, `TestTable`, `replayLog`) |
| [`packages/server`](packages/server/README.md) | Colyseus host: `createGameServer`, `GameRoom`, `RoomCodeService`, `createApiHandler`; `/bun`, `/node`, `/content`, `/testing` |
| [`packages/game-client`](packages/game-client/README.md) | Svelte 5 SDK: `GameConnectionManager`, `Countdown`, `resolveEndpoints`; `/testing`, `/test-setup` |
| [`packages/game-ui`](packages/game-ui/README.md) | viewmodels (welcome, waiting room, settings, controls), `AppRouter`, rank helpers; `/components` |
| [`packages/bots`](packages/bots/README.md) | `BotPlayer`, `joinBots`, `BotTable`, `DemoTable`; a game supplies a `BotStrategy` |
| [`packages/terminal`](packages/terminal/README.md) | `TerminalPlayer`, `PlaySession`, arg parsers, `runBotsCommand`; a game supplies a `TerminalStrategy` |
| [`packages/launcher`](packages/launcher/README.md) | `runLauncher(config, argv)`: server, API, client and bot tables |
| [`packages/config`](packages/config/README.md) | presets: `/vite`, `/vitest` (source aliases, `JSDOM_DIST_ONLY`), `/svelte`, tsconfigs |
| [`packages/cli`](packages/cli/README.md) | `bun run new <slug>` scaffolds a tested game from `packages/cli/template/` |
| [`games/wit-clash`](games/wit-clash/README.md) | reference game: `src/` rules, `ui/` client, `server.ts`, `launch.ts`, `content/` |
| `scripts/game.ts` | root dispatcher for `list`, `launch`, `play`, `bots` (pure part in `scripts/gameEntry.ts`) |

Docs: [`docs/framework/README.md`](docs/framework/README.md) (game author guide), [`docs/HOSTING.md`](docs/HOSTING.md), [`docs/framework/troubleshooting.md`](docs/framework/troubleshooting.md) (known traps; read it before debugging the build, coverage or reconnects), [`docs/adr/`](docs/adr/README.md) (why the architecture is shaped this way; read before reopening a settled design).

## Commands

| Command | What |
|---|---|
| `bun run verify` | lint, typecheck of `scripts/`, packages and games, coverage |
| `bun run test:coverage` | `vitest run --coverage`, 100% thresholds |
| `bun run lint` / `typecheck` / `typecheck:scripts` / `build` | the single steps |
| `bun run new <slug> [--name "..."]` | scaffold a game under `games/<slug>/` |
| `bun run games` | list games and their entries |
| `bun run launch` / `launch:host` / `launch:prod` | server (2567), API (3001), Vite (5173) or built client (3000); `--no-browser` |
| `bun run launch:bots` / `launch:demo` | dev launch plus 3 bots / a watch-only all-bot room |
| `bun run play` / `bun run bots <CODE> [count]` | terminal client with bots / bots joining a browser room |

## CI jobs

Every job is a separate check in `.github/workflows/ci.yml`; the job name tells you which gate failed.

| Job | Reproduce locally |
|---|---|
| `lint` | `bun run lint` |
| `agents` | `bun run check:agents` |
| `boundaries` | `bun run check:boundaries` |
| `conventions` | `bun run check:conventions` |
| `exports` | `bun run check:exports` |
| `unused` | `bun run check:unused` |
| `typecheck` | `bun run typecheck:scripts && bun run typecheck` |
| `test` | `bun run test:coverage` |
| `template-smoke` | `bun run smoke:template` |
| `gates` (PRs only) | `bun run check:gates --base origin/main` and `bun run scripts/checkPathsCli.ts --base origin/main` |

`bun run verify` runs all of them except `template-smoke` and `gates`.

## Library docs

Project-specific API notes live in `.AGENTS/docs/libraries/`.

| Library | Documentation |
|---------|---------------|
| **@biomejs/biome** | [biome.md](.AGENTS/docs/libraries/biome.md) |
| **@colyseus/bun-websockets** | [colyseus.md](.AGENTS/docs/libraries/colyseus.md) |
| **@colyseus/core** | [colyseus.md](.AGENTS/docs/libraries/colyseus.md) |
| **@colyseus/schema** | [colyseus-schema.md](.AGENTS/docs/libraries/colyseus-schema.md) |
| **@colyseus/sdk** | [colyseus.md](.AGENTS/docs/libraries/colyseus.md) |
| **@colyseus/ws-transport** | [colyseus.md](.AGENTS/docs/libraries/colyseus.md) |
| *Colyseus test harness (own)* | [colyseus-testing.md](.AGENTS/docs/libraries/colyseus-testing.md) |
| **svelte** | [svelte.md](.AGENTS/docs/libraries/svelte.md) |
| **@sveltejs/vite-plugin-svelte** | [svelte.md](.AGENTS/docs/libraries/svelte.md) |
| **turbo** | [turbo.md](.AGENTS/docs/libraries/turbo.md) |
| **vitest** | [vitest.md](.AGENTS/docs/libraries/vitest.md) |
| **@vitest/coverage-v8** | [vitest-coverage.md](.AGENTS/docs/libraries/vitest-coverage.md) |
| **xstate** | [xstate.md](.AGENTS/docs/libraries/xstate.md) |
| **zod** | [zod.md](.AGENTS/docs/libraries/zod.md) |
| **@testing-library/svelte** | [testing-library.md](.AGENTS/docs/libraries/testing-library.md) |
| **@testing-library/jest-dom** | [testing-library.md](.AGENTS/docs/libraries/testing-library.md) |
| **jsdom** | [jsdom.md](.AGENTS/docs/libraries/jsdom.md) |
| **@types/jsdom** | [jsdom.md](.AGENTS/docs/libraries/jsdom.md) |
| **vite** | [vite.md](.AGENTS/docs/libraries/vite.md) |
| **typescript** | [typescript.md](.AGENTS/docs/libraries/typescript.md) |

## Extension Points

Paths are relative to `games/wit-clash/` unless they start with `packages/`. Tests go next to the layer you touch: `tests/game/` (rules, via `Table extends TestTable` in `tests/game/support.ts`), `tests/viewmodels/`, `tests/screens/`.

| To add... | Do this |
|---|---|
| A category or prompt | Drop a `.jsonc` file into `content/categories/` and restart the server. No code. Category ids and prompt ids must be unique across all files (used-prompt tracking is by id). |
| A game phase | 1. Add the name to `PHASE` in `src/phaseNames.ts`. 2. Create `src/phases/<Name>.ts` exporting a `WitClashPhase` (`onEnter`, `duration` + `onTimeout`, `onRosterChange`, `actions`). 3. Add one line to `phases` in `src/game.ts`. 4. Add any synced field to `src/state.ts` (the client contract) and server-only data to `src/private.ts`. |
| A screen for a phase | 1. `ui/viewmodels/<Name>ViewModel.ts` (reads `manager.state`, never recomputes rules). 2. `ui/screens/<Name>.svelte`. 3. One entry in `PHASE_SCREENS` in `ui/screens/index.ts`: `[PHASE.X]: { component, waitingLabel }` (a missing phase is a compile error). `AppViewModel` (an `AppRouter` from `@partygame/game-ui`) routes from `PHASE_SCREENS`, `App.svelte` renders and `JoinNextRound` labels from that table. A screen should also render with no seat (`manager.isSpectator`, the TV display): no inputs, progress shown large. Reusable pieces (StatusPanel, Timer, PlayerSticker, ActionBar, Podium, ...) come from `@partygame/game-ui/components`, themed by `ui/app.css`. |
| A client action | 1. Name in `ACTION` (`src/actionNames.ts`, `SCREAMING_SNAKE_CASE`; `START_GAME`, `KICK_PLAYER`, `SET_OPTIONS`, `END_GAME` are reserved). 2. zod payload schema and payload type in `src/actions.ts`. 3. `[ACTION.X]: defineAction({ from, payload, handler })` in the accepting phase's `actions`. 4. `manager.sendAction(ACTION.X, payload)` from a viewmodel; it resolves with an `ActionResult` and rejections also land in `manager.lastServerError`. Reject with `ctx.reject(ErrorCode.NOT_ALLOWED, "why")`. |
| An option | Add the field, default and range to `WitClashOptionsSchema` in `src/options.ts` (the single source). Read it as `ctx.options.<name>` in phases. The client reads the published `state.options` JSON through the same schema (see `LobbySettingsViewModel`). The lobby settings form is generated from the same schema (`LobbySettingsViewModel` from `@partygame/game-ui` reads the bounds through `z.toJSONSchema`; the game's subclass passes the schema and defaults): every bounded numeric field gets a labelled number input for the host and a read-only line for everyone else, so a new numeric option needs no UI edit. The host changes options with the built-in `SET_OPTIONS`. |
| A timed phase | Set `duration` (ms, or a function of `ctx`) and `onTimeout` on the phase; the runtime writes `state.phaseEndsAt` and the server owns the clock. Client side: `manager.countdown()`, as in `ui/viewmodels/CategoryVoteViewModel.ts`. |
| A scoring rule | Edit `src/scoring.ts` (`calculateMatchupAwards`, `settleMatchup`, constants). Points are applied in `src/phases/MatchupReveal.ts` through `awardPoints` from `@partygame/core`. The scoreboard order (seated first, leavers below) is `composeLeaderboard` from `@partygame/core`; `src/scoreboard.ts` only adds the award columns. |
| Bots for a game | Write a `BotStrategy<YourState>` with `play` (required) and optional `host` methods, and a `BotKit { roomName, stateClass, strategy }`; pass it to `joinBots`, `BotTable` or `DemoTable` from `@partygame/bots`. Guide: `docs/framework/README.md` (Bots). WitClash example: `games/wit-clash/bots/witClashBot.ts`. |
| A whole new game | 1. `games/<name>/` with its own `package.json` (copy `games/wit-clash/package.json`; the `games/*` workspace and turbo pick it up) and `index.html`; `vite.config.ts`, `vitest.config.ts`, `vitest.game.config.ts`, `svelte.config.js` and `tsconfig.json` are one-liners on the `@partygame/config` presets (the root `vitest.config.mts` finds `games/*/vitest*.config.ts` by glob). 2. `src/state.ts` extending `BaseGameState` from `@partygame/shared/schema`; `src/private.ts`; `src/phaseNames.ts`, `src/actionNames.ts`, `src/actions.ts` (`actionFactory`); `src/phases/*.ts`; `src/game.ts` with `defineGame`. 3. `server.ts`: `startServer({ games: [{ roomName, definition, stateClass }] })` from `@partygame/server/bun`. 4. `ui/`: a `GameConnectionManager<YourState>` in `main.ts` with its own `storagePrefix`, plus screens; the viewmodels (welcome, waiting room, settings, controls) and `createAppRouter(manager, screens)` come from `@partygame/game-ui`. 5. `launch.ts` calling `runLauncher` from `@partygame/launcher` (add `@partygame/launcher` as a dependency); `bun run launch <name>` then works. Guide: `docs/framework/README.md`. |
| A terminal client for a game | `TerminalStrategy<YourState>` with `play(turn)` (ask, `turn.send`, `turn.changed`), optional `narrate`/`lobby`, in `terminal/<name>Terminal.ts`; `terminal/play.ts` wires `parsePlayArgs`, `PlaySession` and `TerminalPlayer` (a `HostedGame` from `src/hostedGame.ts` lets it start a server); `bots/cli.ts` calls `runBotsCommand`. `bun run play` and `bun run bots` pick them up by convention. Guide: `docs/framework/README.md` (Terminal). |
| Launching a game | `games/<name>/launch.ts`: `runLauncher({ name, gameDir, bots?, demo?, ports?, commands? }, process.argv.slice(2))`. `gameDir` holds `server.ts` and the `dev`/`build` scripts. Omit `bots`/`demo` and those flags are refused. Guide: `docs/framework/README.md` (Launcher). |
| A framework feature | Host built-ins live in `packages/core/src/runtime/lobby.ts`; the runtime in `packages/core/src/runtime/GameRuntime.ts`; seats, reconnection and views in `packages/server/src/rooms/GameRoom.ts`; wire names and error codes in `packages/shared/src/protocol.ts`. The runtime stays Colyseus-free: new needs go through the `RuntimeHost` interface (`packages/core/src/runtime/types.ts`) and `FakeHost`. |

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
