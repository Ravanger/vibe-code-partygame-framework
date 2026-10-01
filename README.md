# Party Game Framework

TypeScript framework for multi-device party games. Reference game: **WitClash** (3-8 players).

## Run

```bash
bun install
bun run launch        # opens http://localhost:5173 -> Host Game, share the code
```

## Playtest alone

```bash
bun run launch:bots   # opens your room; enter your name, 3 bots join
bun run bots ABCD 3   # add bots to an existing room ABCD
```

Bots answer and vote by themselves; you host and press Start. Ctrl+C stops them.

## Commands

| Command | What |
|---|---|
| `launch` / `launch:host` / `launch:prod` | dev / dev + LAN addresses / built client |
| `launch --bots=N` | dev + N bots (1-7) |
| `test:coverage` | tests, 100% coverage enforced |
| `typecheck` / `lint` / `verify` | tsc + svelte-check / Biome / all |

Run each with `bun run`. Add `--no-browser` to skip the browser tab.

## Docs

- [Hosting](docs/HOSTING.md): ports, LAN, QR, TV mode
- [Framework guide](docs/framework/README.md): writing a game
- [WitClash](games/wit-clash/README.md): rules, UI, bots
