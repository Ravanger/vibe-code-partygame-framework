# Hosting a Game

## Quick Start

```bash
bun install
bun run launch
```

`bun run launch` starts the game server, the code-lookup API and the Vite client, waits until each answers, and opens
`http://localhost:5173`. Click **Host Game**: you get a four-letter room code and a share link
(`http://<host>:5173/?code=ABCD`) that joins a guest straight into your room. Each player enters a name. The game takes 3 to 8 players: the host presses **Start Game** once at least 3
players are in and every one of them has entered a name.

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

## Play in the terminal

```bash
bun run cli:play                  # host a room; 3 bots join; uses the server on 2567/3001 or starts its own
bun run cli:play --join=ABCD      # join a room as a normal player
bun run cli:demo                  # all-bot game, narrated; prints PASS/FAIL (--bots=N total players, --rounds=R)
```

You are the host in `cli:play`; browser players can join the same room with the printed code while Vite runs.

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

## Environment Variables

### Server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `2567` | Game server (WebSocket) port |
| `API_PORT` | `3001` | Room-code lookup API port |
| `WITCLASH_CONTENT_DIR` | `games/wit-clash/content/categories` | Directory holding the category files |

### Client

Read by Vite at dev or build time.

| Variable | Default | Description |
|---|---|---|
| `VITE_SERVER_HOST` | the page's host name | Host of the game server and API, when they are not on the same host as the page |
| `VITE_GAME_PORT` | `2567` | Game server port |
| `VITE_API_PORT` | `3001` | API port |

The launcher always uses the default ports. To move them, start the pieces yourself (below) and give the client the matching `VITE_GAME_PORT` and `VITE_API_PORT`.

## Manual Launch

```bash
# Terminal 1: game server and API (PORT and API_PORT optional)
cd games/wit-clash && bun server.ts          # or: bun run dev:server (hot reload)

# Terminal 2: client
cd games/wit-clash && bun run dev            # Vite on http://localhost:5173
```

For a production client, run `bun run build` in `games/wit-clash` and serve `games/wit-clash/dist` with any static file server.
