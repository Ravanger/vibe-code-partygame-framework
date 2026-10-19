# Rush

A real-time tap-race party game (headless rules spike for M6 · Archetypes, #159): a target bounces around a 10×10 grid and players TAP while it is in the center zone. The round is driven by many small client actions plus a server tick — the spike that motivated the framework's `onTick` phase hook.

## Rules

- **Lobby** — the built-in lobby; the host starts with 2–8 players.
- **Race** (`raceSeconds` option, 5–30 s, default 10) — a target is dealt at a random position with a random speed of 2–4 cells/s per axis (from the room seed). The server moves it on every tick — `onTick` at the framework's default 10 Hz — and reflects it off the grid edges. Every TAP counts; a TAP scores a hit only while the target is in the center zone.
- **Results** — the scoreboard, best hit count first, ties broken by name. The host plays again from a clean lobby.

A departure below 2 players ends the race back in the lobby with a notice; a dropped connection is not a departure.

Options (host-tunable in the lobby): `raceSeconds` (5–30, default 10). Tick rate and determinism rules: "Timers" in `docs/framework/README.md`.

Framework feature exercised: `PhaseDefinition.onTick` at a fixed rate, with deterministic replay through the action log. No kits used.

Part of the M6 archetypes milestone: headless spike only; a UI, bots and a terminal client are out of scope.
