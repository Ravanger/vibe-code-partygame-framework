# Bluff

A bluffing party game: each round the room draws a trivia prompt with one hidden true answer. Every player writes a fake answer, the truth and the fakes are shuffled, and everyone votes on which option is real. You score for guessing the truth and for fooling others into picking your fake.

Part of the M6 archetypes milestone: the headless rules spike (#156) plus the browser UI (#157) — player and TV screens for every phase, a demo bot, and `server.ts`/`launch.ts` entries over one `gamePackage` declaration.

## Rules

- **Lobby** — the built-in lobby; the host starts with at least 3 players (max 8).
- **Writing** (45 s) — a prompt is drawn from `content/prompts/*.jsonc` without replacement (the pool wraps when exhausted). Each player submits one fake answer; the round moves on once everyone has submitted or the timer runs out.
- **Voting** (30 s) — the truth and every submitted fake become anonymous, shuffled options. Each option's authorship stays server-side; each player privately learns which option is theirs (`mine` view entry, `myOptionId`) so they cannot vote for their own fake. The round moves on once everyone has voted or the timer runs out.
- **Reveal** (15 s) — the truth and every author are revealed, votes are counted. Points: **+2 for guessing the truth**, **+1 per vote that lands on your fake**.
- **Results** — final scoreboard; the host can play again.

A departure mid-round prunes that player's data; a drop below 3 players ends the game back in the lobby. A dropped connection is not a departure.

Options (host-tunable in the lobby): `rounds` (1–10, default 3), `writingSeconds` (10–300, default 45), `votingSeconds` (5–120, default 30), `revealSeconds` (1–60, default 15).

## Framework kits used (`@partygame/core/kits`, `@experimental`)

- **collectResponses**: `allResponded` (Writing completes when every present player submitted), `entriesFor` (the fakes that become options).
- **voteAndTally**: `tallyVotes` (Reveal vote counts), `allHaveVoted` (early Voting finish), `countVoted` (`votesCast`).
- **drawPool** (prompt draw with pool wrap-around).

Roster guards from the core root: `departedIds`, `isBelowMinimum`.

## UI

One screen per phase in `ui/screens/` (registered in `ui/screens/index.ts`), one viewmodel each under `ui/viewmodels/`, routed by `createAppRouter` from `@partygame/game-ui`. Every screen also renders with no seat (the TV display): the prompt, the board and the vote count stay visible, inputs disappear. Your own option is marked "yours" only in your private view — authorship never leaves the server until Reveal.

## Running it

```sh
bun run launch bluff        # server + API + browser client (see the root AGENTS.md)
cd games/bluff && bun run dev:server   # just the game server, hot-reloading
```

A watch-only all-bot room comes from the launcher's demo tables (`botKit` in `gamePackage.ts`).

## Running the tests

```sh
cd games/bluff && bun run test     # or: bun run test:coverage from the repo root
```
