# Party Game Framework

TypeScript framework for multi-device party games. Four reference games under `games/`, built only on the packages below.

## Games

| Game | What it is | Players |
|---|---|---|
| [WitClash](games/wit-clash/README.md) | The full reference game: rules, browser UI, bots, terminal client and content | 3-8 |
| [Bluff](games/bluff/README.md) | Playable with a browser UI, bot kit and demo tables (no terminal client yet) | 3-8 |
| [Crew](games/crew/README.md) | Headless rules spike: an asymmetric co-op guess-the-sum game | 3-5 |
| [Rush](games/rush/README.md) | Headless rules spike: a tap race driven by the server tick | 2-8 |

## Run

```bash
bun install
bun run launch wit-clash   # opens http://localhost:5173 -> Host Game, share the code; builds dependencies as needed
```

`launch`, `play` and `bots` take the game name whenever more than one game exists (with several games and no name they ask). When a game has no entry for a command, the dispatcher names it (`<game> has no <command> entry (<path>)`) and exits.

## Playtest alone

```bash
bun run launch wit-clash --bots   # opens your room; enter your name, 3 bots join
bun run bots wit-clash ABCD 3     # add bots to an existing room ABCD
bun run --cwd games/wit-clash demo  # watch an all-bot WitClash game (WitClash-only)
```

Bots answer and vote by themselves; you host and press Start. Ctrl+C stops them.

## Commands

| Command | What |
|---|---|
| `launch [game]` / `launch:host` / `launch:prod` | dev (Vite 5173) / dev + LAN addresses / built client (3000); game server on 2567, code API on 3001 |
| `--bots=N` / `--demo=N` | dev launch plus N bots in your room / a watch-only room bots play alone; bounds per game (1 to max players - 1; demo from min players - 1) |
| `play [game] [--bots=N]` | play in the terminal (only games with a terminal entry) |
| `bots [game] <CODE> [count]` | seat bots in a browser-created room (only games with a bots entry) |
| `bun run --cwd games/wit-clash demo` | watch an all-bot WitClash game (`--bots=N`) |
| `new <slug>` | scaffold a tested game under `games/<slug>/` |
| `games` | list games and their entries, from each game's `partygame` manifest (name, description, icon) in its `package.json` |
| `test:coverage` | tests, 100% coverage enforced |
| `typecheck` / `lint` / `verify` | tsc + svelte-check / Biome / all |

Run each with `bun run`. Add `--no-browser` to skip the browser tab.

## Packages

| Package | Holds |
|---|---|
| [`shared`](packages/shared/README.md) | wire protocol, error codes, limits, browser-safe state classes |
| [`content`](packages/content/README.md) | JSONC content loading and free-text filtering |
| [`client-utils`](packages/client-utils/README.md) | room-code resolution, share links, waiting, argument parsing |
| [`core`](packages/core/README.md) | the Colyseus-free runtime: phases, actions, clock, action log, kits, replay |
| [`server`](packages/server/README.md) | the Colyseus host: rooms, seats, reconnection, room codes, code API |
| [`game-client`](packages/game-client/README.md) | the Svelte 5 SDK: connection manager, countdown, testing stubs |
| [`game-ui`](packages/game-ui/README.md) | generic viewmodels, router and components; theme contract |
| [`bots`](packages/bots/README.md) | bot players: joining, naming, pacing, hosting |
| [`terminal`](packages/terminal/README.md) | terminal clients: play at a prompt, all-bot demo runs |
| [`launcher`](packages/launcher/README.md) | one process group: server, code API, client, bots or demo |
| [`game-kit`](packages/game-kit/README.md) | the per-game declaration and its entry stubs |
| [`config`](packages/config/README.md) | Vite, Vitest, Svelte and tsconfig presets |
| [`cli`](packages/cli/README.md) | `bun run new <slug>` scaffolds a tested game from its template |

## Docs

- [Hosting](docs/HOSTING.md): ports, LAN, QR, TV mode, manual launch
- [Framework guide](docs/framework/README.md): writing a game
- [Troubleshooting](docs/framework/troubleshooting.md): known traps (build, coverage, reconnects)
- [ADRs](docs/adr/README.md): why the architecture is shaped this way
