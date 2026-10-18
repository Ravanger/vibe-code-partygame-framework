# Bluff

A bluffing party game: each round the room draws a trivia prompt with one hidden true answer. Every player writes a fake answer, the truth and the fakes are shuffled, and everyone votes on which option is real. You score for guessing the truth and for fooling others into picking your fake.

This is the headless rules spike of the M6 archetypes milestone (#156): rules plus `FakeHost` tests, no UI yet (the UI lands in #157).

## Rules

- **Lobby** — the built-in lobby; the host starts with at least 3 players (max 8).
- **Writing** (45 s) — a prompt is drawn from `content/prompts/*.jsonc` without replacement (the pool wraps when exhausted). Each player submits one fake answer; the round moves on once everyone has submitted or the timer runs out.
- **Voting** (30 s) — the truth and every submitted fake become anonymous, shuffled options. Each option's authorship stays server-side; each player privately learns which option is theirs (`mine` view entry, `myOptionId`) so they cannot vote for their own fake. The round moves on once everyone has voted or the timer runs out.
- **Reveal** (15 s) — the truth and every author are revealed, votes are counted. Points: **+2 for guessing the truth**, **+1 per vote that lands on your fake**.
- **Results** — final scoreboard; the host can play again.

A departure mid-round prunes that player's data; a drop below 3 players ends the game back in the lobby. A dropped connection is not a departure.

Options: `rounds` (1–10, default 3).

## Framework kits used (`@partygame/core/kits`, `@experimental`)

- **collectResponses**: `allResponded` (Writing completes when every present player submitted), `entriesFor` (the fakes that become options).
- **voteAndTally**: `tallyVotes` (Reveal vote counts), `allHaveVoted` (early Voting finish), `countVoted` (`votesCast`).
- **drawPool** (prompt draw with pool wrap-around).

Roster guards from the core root: `departedIds`, `isBelowMinimum`.

## Running the tests

```sh
cd games/bluff && bun run test     # or: bun run test:coverage from the repo root
```
