# __DisplayNameMd__

A small party game scaffolded by `bun run new`: players take turns waving, and the first to reach
`waveGoal` waves (default 10) wins. It is a complete, fully-tested starting point — replace the ruleset in
`src/` with your own game.

## Play it

All commands run from the repo root. The dispatcher (`scripts/game.ts`) needs the game named whenever more than
one game exists, so every command below carries `__slug__`:

```sh
bun run launch __slug__            # server + API + dev client; open the printed URL
bun run launch __slug__ host       # same, plus the LAN URLs for guests on your network
bun run play __slug__ --join=CODE  # join from a terminal (Waving/Results)
bun run bots __slug__ CODE [count] # seat bots in a browser-created room
```

`bun run --cwd games/__slug__ demo` runs a narrated all-bot game and prints PASS or FAIL.

## Tests

The suites split across two vitest projects. From this folder:

```sh
bun run test      # UI project only (tests/App.test.ts, tests/screens/, tests/config.test.ts)
bun run test:all  # both projects: the UI suites plus rules, bots and terminal
```

## Layout

- `gamePackage.ts` — the game declared once: meta, definition, state class, is-finished, bot kit, terminal strategy
  and demo extras; the entry files are one-line stubs over it.
- `src/` — the rules: `state.ts` (synced state), `private.ts`, `phaseNames.ts`, `actionNames.ts`,
  `actions.ts`, `phases/` (one file per phase), `game.ts` (`defineGame`) and `meta.ts` (the browser-safe room name and player limits).
- `ui/` — the Svelte client: `main.ts` (connection manager), `App.svelte` (screens).
- `server.ts`, `launch.ts`, `bots/cli.ts`, `terminal/play.ts`, `terminal/demo.ts` — the entry stubs.
- `bots/`, `terminal/` — bot strategy and terminal client.
- `tests/` — rules (`tests/game/`), bots (`tests/bots/`), terminal (`tests/terminal/`) and UI
  (`tests/App.test.ts`, `tests/screens/`, `tests/config.test.ts`; helpers in `tests/helpers/`).

## Make it yours

Edit the phases in `src/phases/`, the synced fields in `src/state.ts` and the screens in `ui/`.
Every name in this folder is derived from the slug `__slug__`; rename freely — the tests follow the
structure, not the names. See `docs/framework/README.md` for how each piece works.

## Security

- Declare options with a bounded zod schema and read them only through `ctx.options`.
- Keep per-player secrets in `ctx.priv` or `.view()` fields; show and hide with `showTo`/`hideFrom` (hide before deleting).
- Give every action a payload schema with length and range limits; handlers use the parsed `ctx.payload`, never the raw message.
- Do not mutate `payload` or shared state objects you did not create — copy first.
- Use `ctx.rng()` / `ctx.newId()`, never `Math.random()` or `crypto.randomUUID()`.
- Treat every player-typed string as untrusted: Svelte text interpolation, never `{@html}`; cap its length; do not log it.
- Check the sender with `ctx.reject(ErrorCode.NOT_ALLOWED, ...)`; the host-only built-ins are `START_GAME`, `KICK_PLAYER`, `SET_OPTIONS` and `END_GAME`.
- Know the limits: `playerId` is the only seat credential and rate limiting is not built.

Full checklist with working examples: [Security checklist for game authors](../../../docs/framework/README.md#security-checklist-for-game-authors).
