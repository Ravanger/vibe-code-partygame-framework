# Hosting a Game

## Quick Start

```bash
bun install
bun run launch
```

`bun run launch` starts the game server, the code-lookup API and the Vite client, waits until each answers, and opens
`http://localhost:5173`. Click **Host Game**: you get a room code and a share link
(`http://<host>:5173/?code=ABCD`) that joins a guest straight into your room. Each player enters a name. The game takes 3 to 8 players: the host presses **Start Game** once at least 3
players are in and every one of them has entered a name.

The launcher lives in `packages/launcher`; each game's `launch.ts` configures it and the root `scripts/game.ts` runs it (`bun run launch [game]`, the game name is needed only when `games/` holds several).

Press Ctrl+C to stop everything. If any of the three processes dies, the launcher stops the rest and exits with an error.

## Launch Commands

| Command | What it does |
|---|---|
| `bun run launch` | Dev mode: game server, API and Vite with hot reload on `http://localhost:5173` |
| `bun run launch:dev` | Same as `launch` |
| `bun run launch:host` | Dev mode, and prints this machine's LAN addresses for guests |
| `bun run launch:prod` | Builds the client, then serves it on `http://localhost:3000` next to the game server |

Add `--no-browser` to any of them to skip opening a browser tab, for example `bun run launch --no-browser`.
The launcher refuses to start if one of its ports is already in use.

| Port | Used for |
|---|---|
| 2567 | Game server (WebSocket) |
| 3001 | Room-code lookup API (`GET /api/resolve-code?code=ABCD`) |
| 5173 | Vite dev server (`launch`, `launch:dev`, `launch:host`) |
| 3000 | Built client (`launch:prod`) |

## Playing Over LAN

Players on the same network open `http://<YOUR-LAN-IP>:5173` (`:3000` with `launch:prod`). The client talks to the game server and the API
on the same host name as the page, so no configuration is needed. Make sure your firewall lets other machines reach the client port, 2567 and 3001.

The room-code API binds to your own machine by default, so strangers cannot look up codes; for LAN play use `bun run launch:host`,
which starts it on every interface and allows any origin (`HOST=0.0.0.0`, `ALLOWED_ORIGINS=*`). The game server (2567) is reachable from the LAN either way.
For internet play put a TLS-terminating proxy in front — what the framework does and does not protect is listed in the [threat model](security/threat-model.md).

### Finding your LAN IP

`bun run launch:host` prints it. Otherwise:

```bash
# Windows
ipconfig | findstr "IPv4"

# macOS
ipconfig getifaddr en0

# Linux
hostname -I
```

## Playtesting alone

```bash
bun run launch:bots          # dev stack + your room; 3 bots join once you enter your name
bun run bots ABCD 3          # add 3 bots (1 to 7) to a room you already created
```

You are the host: press Start Game (3 or more players, bots included) and Next Round; the game does not start by itself. The bots answer and vote on their own.
For another number of bots use `bun run launch --bots=N` (1 to 7); `bun run bots` takes `--endpoint` and `--api-port`. Ctrl+C removes the bots.

```bash
bun run launch:demo          # watch-only room: bots play one game, the browser opens its TV view
```

`--demo=N` sets the bots (2 to 7, default 3), plus a host bot. Nobody can take a seat; the TV stays on the final results. Ctrl+C stops it. Not combinable with `--bots`.

## Play in the terminal

```bash
bun run play                      # host a room; 3 bots join; uses the server on 2567/3001 or starts its own
bun run play --join=ABCD          # join a room as a normal player
bun run --cwd games/wit-clash demo  # all-bot game, narrated; prints PASS/FAIL (--bots=N bots, 2 to 7, default 3)
```

You are the host in `play`; browser players can join the same room with the printed code while Vite runs.

## Joining by QR Code

The waiting room shows a QR code of `<address>/?code=ABCD` next to the room code. Players scan it with their phone camera and land in the room; the
page joins the code straight away. The address is the one the host's browser used, so open the game through the LAN address
(`http://<YOUR-LAN-IP>:5173`), not `localhost`, or the QR code points guests at their own machine.

## TV Mode

A TV (or any big screen) can watch a room without taking a player seat:

1. Open the game on the TV browser and enter the room code, then press "Watch on a TV". Or open `http://<YOUR-LAN-IP>:5173/?tv=ABCD` directly.
2. The TV shows the room code, the QR code and the players in the lobby, and then the prompts, matchups, votes and scoreboard in large type. It has
   no controls and does not count as a player (the lobby lists how many TVs are watching).

## Host Controls in the Lobby

- Remove a player: press "Remove" beside their name, then "Yes". A removed player cannot rejoin the room and sees the reason on the welcome screen.
- Settings: the host edits the number of rounds and every timer; limits are enforced by the server and a rejected value is shown and reverted.
  Other players see the settings read-only.

## Adding Categories and Prompts

Categories live in `games/wit-clash/content/categories/`. Drop a `.jsonc` file in and restart the server; there is no code change.
The file format and rules are in [`games/wit-clash/content/categories/README.md`](../games/wit-clash/content/categories/README.md).
The server refuses to start with fewer than 3 categories.

## Behind HTTPS and a reverse proxy

When the page is served over HTTPS or from an origin that cannot reach `host:port` directly, point the client at your own origin through a reverse proxy instead. Two paths are enough (the prefixes are arbitrary; `/game` and `/api` shown):

| Path on the public origin | Forward to | Notes |
|---|---|---|
| `/game` (plus anything after it) | game port `2567` | Must forward the WebSocket upgrade. Forward **without stripping** the prefix: the game server accepts upgrades on any path — the client SDK itself connects to `/<processId>/<roomId>` — so a prefixed URL works as-is. |
| `/api` (plus anything after it) | API port `3001` | Forward **without stripping**: the API answers exactly `GET /api/resolve-code`. |

Then run or build the client with:

```sh
VITE_SERVER_ENDPOINT=wss://your-origin/game VITE_API_BASE=https://your-origin/api bun run dev   # or: bun run build
```

- `VITE_SERVER_ENDPOINT` is used verbatim as the game server URL and skips `VITE_SERVER_HOST`/`VITE_GAME_PORT`.
- `VITE_API_BASE` is used verbatim as the base of the room-code API — the client calls `<VITE_API_BASE>/api/resolve-code`, with no port appended — and wins over `VITE_API_PORT`.
- Without either variable, an HTTPS page still derives its endpoint from its own protocol (`https://<page host>:2567`), which is what you want when TLS terminates directly on those ports.

The reverse proxy itself is not exercised by this repo's tests; the client-side contract (verbatim endpoints, no port appended to `VITE_API_BASE`) and the server's path-tolerant upgrades are covered by tests.

## Environment Variables

### Server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `2567` | Game server (WebSocket) port |
| `API_PORT` | `3001` | Room-code lookup API port |
| `HOST` | `127.0.0.1` | Interface the room-code API binds; `0.0.0.0` for every interface (the game server listens on all of them anyway) |
| `ALLOWED_ORIGINS` | loopback origins, any port | Comma-separated browser origins allowed to read the API; `*` for all. Needed when guests' pages are not on localhost |
| `WITCLASH_CONTENT_DIR` | `games/wit-clash/content/categories` | Directory holding the category files |

Other server limits are set as options of `createGameServer` (see the [framework README](framework/README.md)), not environment variables: for example `maxRooms` caps the number of concurrent rooms (default 100); a create beyond the cap is refused with "Server is full". Rate limits (`rateLimits`) throttle player actions, name changes and `/api/resolve-code` per remote address; an exhausted address gets HTTP 429 with `Retry-After`.

### Client

Read by Vite at dev or build time.

| Variable | Default | Description |
|---|---|---|
| `VITE_SERVER_HOST` | the page's host name | Host of the game server and API, when they are not on the same host as the page |
| `VITE_GAME_PORT` | `2567` | Game server port |
| `VITE_API_PORT` | `3001` | API port |
| `VITE_SERVER_ENDPOINT` | — | Full game server URL (e.g. `wss://your-origin/game`); used verbatim, skips the host/port form. See [Behind HTTPS and a reverse proxy](#behind-https-and-a-reverse-proxy) |
| `VITE_API_BASE` | — | Base URL of the room-code API (e.g. `https://your-origin/api`); used verbatim, wins over `VITE_API_PORT` |

The launcher always uses the default ports. To move them, start the pieces yourself (below) and give the client the matching `VITE_GAME_PORT` and `VITE_API_PORT`.

## Manual Launch

```bash
# Terminal 1: game server and API (PORT and API_PORT optional)
cd games/wit-clash && bun server.ts          # or: bun run dev:server (hot reload)

# Terminal 2: client
cd games/wit-clash && bun run dev            # Vite on http://localhost:5173
```

For a production client, run `bun run build` in `games/wit-clash` and serve `games/wit-clash/dist` with any static file server.

## Maintainer: branch protection

CI cannot stop a direct push to `main` on its own. In the GitHub repository settings (Settings, Branches, rule for `main`) enable:

- Require a pull request before merging.
- Require status checks to pass before merging, and select every job by name: `lint`, `agents`, `boundaries`, `conventions`, `exports`, `unused`, `typecheck`, `test`, `template-smoke`, `gates`, `mutation`.
- Require branches to be up to date before merging.
- Do not allow bypassing the above settings.

`gates` and `mutation` run on pull requests only, so they are required there and never on direct pushes.


## Maintainer: changing a gate

A PR that edits a gate (check and mutation scripts, CI workflows and actions, `biome.json` and its plugins, `vitest.config.mts`, `knip.json`, gate scripts in a `package.json`, strict `tsconfig` options, suppressions and skipped tests) needs the `gate-change` label before the `gates` job passes. Only a maintainer adds it. `gates` lives in its own workflow (`.github/workflows/gates.yml`) that also runs when a label is added or removed, so the label takes effect without a new push.

Locally the pre-commit hook runs the same check on staged files. To commit an intended gate edit, skip only that step: `LEFTHOOK_EXCLUDE=gates git commit ...`. Biome and `check:paths` still run, and CI still requires the label.

## Maintainer: a change that needs no test

`gates` also fails a PR that changes `packages/*/src/` or `games/*/src/` without changing a `*.test.ts` in the same package or game (`d.ts` files, pure renames and removals are exempt). For a change with nothing to test, such as a comment or type-only edit, a maintainer adds the `no-test-needed` label. It overrides only this rule; `gate-change` does not. The pre-commit hook skips this rule, so tests can be committed separately. Create the label once in the repository settings.
