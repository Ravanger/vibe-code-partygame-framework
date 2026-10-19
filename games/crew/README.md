# Crew

An asymmetric cooperative party game (headless rules spike for M6 · Archetypes, #158): every player is dealt a public role and a private signal (1–9). The crew shares one goal — after the briefing rounds, guess the sum of all starting players' signals. Each round every player chooses to SHARE their signal publicly or HOLD it; the crew gets three guesses in the verdict. Everyone wins or loses together.

## Rules

- **Lobby** — the built-in lobby; the host starts with 3–5 players.
- **Briefing** (15 s) — a unique role is dealt to each player from a seeded shuffle (participant order), and each player privately learns their signal (`mine` view entry). The target sum is locked to the starting crew.
- **Round** (20 s; `rounds` option, 1–5, default 2) — every seated player chooses SHARE or HOLD once. A SHARE reveals that player's signal to the whole room (`reveals`); a HOLD keeps it hidden. The round ends when everyone has chosen or on timeout (no choice).
- **Verdict** (30 s) — any player may GUESS the sum of all starting signals; up to 3 guesses. A correct guess wins; the third wrong guess or the timeout loses.
- **Results** — win/lose, the target sum and every signal are revealed publicly. The host plays again from a clean slate.

A departure mid-game reveals that player's signal publicly (the target stays locked at start); dropping below 3 players ends the game back in the lobby. A dropped connection is not a departure.

Options (host-tunable in the lobby): `rounds` (1–5, default 2). Phase durations are constants in the phase files (headless spike).

Kits: `collectResponses` (`allResponded`) from `@partygame/core/kits` for the per-round share/hold collection.

Part of the M6 archetypes milestone: headless spike only; a UI, bots and a terminal client are out of scope.
