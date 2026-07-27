# Hosting a Game

## Quick Start

```bash
# Install dependencies
bun install

# Launch everything (server + client)
bun run launch
```

Your host URL: `http://localhost:5173?host=true`
Player URL: `http://localhost:5173`

## Playing Over LAN

Once the server is running, players on the same network can join using your LAN IP:

```
http://<YOUR-LAN-IP>:5173
```

No extra configuration is needed. The client auto-detects the server host from the page URL.

### Finding your LAN IP

```bash
# Linux / macOS
ip route | grep default | awk '{print $3}'

# macOS alternative
ipconfig getifaddr en0

# Windows
ipconfig | findstr "IPv4"
```

## Adding Categories and Prompts

Categories live in `games/wit-clash/content/categories/`. Drop a `.jsonc` file and restart the server.

### Example: `animals.jsonc`

```jsonc
{
  "id": "animals",           // unique, lowercase kebab-case
  "name": "Animals",         // display name
  "emoji": "🐾",             // optional, defaults to 🎲
  "prompts": [               // at least 8 recommended
    { "id": "animals-1", "text": "The most dramatic animal to own." },
    { "id": "animals-2", "text": "A pet that would be terrible in an apartment." },
    { "id": "animals-3", "text": "The animal most likely to survive a zombie apocalypse." },
    { "id": "animals-4", "text": "A service animal for people who are afraid of commitment." },
    { "id": "animals-5", "text": "The animal that would make the worst secret agent." },
    { "id": "animals-6", "text": "A zoo animal that belongs in a pet store." },
    { "id": "animals-7", "text": "The most overrated animal crossing character." },
    { "id": "animals-8", "text": "An animal that should be illegal to own." }
  ],
  "tieBreakers": [           // optional, for tie-breaker rounds
    { "id": "animals-tb-1", "text": "The animal most likely to win a Nobel Prize." }
  ]
}
```

### Rules

- `id` must be unique across **all** category files and match `^[a-z0-9-]+$`
- Each prompt needs a unique `id` within its file
- Server requires at least 3 categories to start
- Changes take effect on server restart

## Environment Variables

### Server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `2567` | Colyseus game server port |
| `WITCLASH_CONTENT_DIR` | `../wit-clash/content` | Path to category files (relative to server) |

### Client

| Variable | Default | Description |
|---|---|---|
| `VITE_SERVER_HOST` | `window.location.hostname` | Server hostname for LAN play |
| `VITE_GAME_PORT` | `2567` | Colyseus game server port |
| `VITE_API_PORT` | `3001` | API server port |
| `VITE_MIN_PLAYERS` | `3` | Minimum players before the host can start the game |

For LAN play, set `VITE_SERVER_HOST` to your LAN IP before building:

```bash
VITE_SERVER_HOST=192.168.1.5 bun run build
```

## Launch Commands

| Command | Description |
|---|---|
| `bun run launch` | Start server + client (dev mode) |
| `bun run launch:host` | Start in host mode (auto-creates room) |
| `bun run launch:dev` | Dev mode with hot reload |
| `bun run launch:build` | Build and serve production |

## Manual Launch

If you prefer to run components separately:

```bash
# Terminal 1 — Game server
cd packages/server && PORT=2567 bun run dev

# Terminal 2 — Client
cd games/wit-clash && bun run dev
```
