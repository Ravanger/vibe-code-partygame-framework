# __DisplayName__

A small party game scaffolded by `bun run new`: players take turns waving, and the first to reach
`waveGoal` waves (default 10) wins. It is a complete, fully-tested starting point — replace the ruleset in
`src/` with your own game.

## Play it

From the repo root:

```sh
bun run launch __slug__        # server + API + dev client; open the printed URL
bun run launch:host __slug__   # serve the built client instead of Vite
bun run play --join=CODE       # join from a terminal (Waving/Results)
bun run bots CODE [count]      # seat bots in a browser-created room
```

`bun run --cwd games/__slug__ demo` runs a narrated all-bot game and prints PASS or FAIL.

## Layout

- `src/` — the rules: `state.ts` (synced state), `private.ts`, `phaseNames.ts`, `actionNames.ts`,
  `actions.ts`, `phases/` (one file per phase), `game.ts` (`defineGame`).
- `ui/` — the Svelte client: `main.ts` (connection manager), `App.svelte` (screens).
- `server.ts` — Bun server entry; `launch.ts` — launcher config.
- `bots/`, `terminal/` — bot strategy and terminal client.
- `tests/` — rules (`tests/game/`), bots (`tests/bots/`), terminal (`tests/terminal/`) and UI
  (`tests/*.test.ts`).

## Make it yours

Edit the phases in `src/phases/`, the synced fields in `src/state.ts` and the screens in `ui/`.
Every name in this folder is derived from the slug `__slug__`; rename freely — the tests follow the
structure, not the names. See `docs/framework/README.md` for how each piece works.
