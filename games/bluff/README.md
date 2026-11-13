# Bluff

A bluffing party game: each round the room draws a trivia prompt with one hidden true answer. Every player writes a fake answer, the truth and the fakes are shuffled, and everyone votes on which option is real. You score for guessing the truth and for fooling others into picking your fake.

Player and TV screens for every phase, a demo bot, and `server.ts`/`launch.ts` entries over one `gamePackage` declaration.

## Rules

- **Lobby** — the built-in lobby; the host starts with at least 3 players (max 8).
- **Writing** (45 s) — a prompt is drawn from `content/prompts/` without replacement (the pool wraps when exhausted). Each player submits one fake answer; a fake equal to the truth or to another player's answer (case- and whitespace-insensitively) is rejected, and a fake the room's text filter refuses is rejected with `CONTENT_REJECTED`. The round moves on once everyone has submitted or the timer runs out.
- **Voting** (30 s) — the truth and every submitted fake become anonymous, shuffled options. If nobody wrote a fake, the round skips Voting and Reveal and goes straight to the next round (or Results after the final one). Each option's authorship stays server-side; each player privately learns which option is theirs (`mine` view entry, `myOptionId`) so they cannot vote for their own fake, and their cast vote is kept in the same entry (`myVote`) so a reload shows the waiting state instead of the vote buttons. The round moves on once everyone has voted or the timer runs out.
- **Reveal** (15 s) — the truth and every author are revealed, votes are counted. Points: **+2 for guessing the truth**, **+1 per vote that lands on your fake**.
- **Results** — final scoreboard; the host can play again.

A departure mid-round prunes that player's data; a drop below 3 players ends the game back in the lobby. A dropped connection is not a departure.

Options (host-tunable in the lobby): `rounds` (1–10, default 3), `writingSeconds` (10–300, default 45), `votingSeconds` (5–120, default 30), `revealSeconds` (1–60, default 15), `filterLevel` (`off`, `moderate` or `strict`, default `moderate`).

`filterLevel` drives the room's text filter: fakes are checked through `textFilterMiddleware` (declared as `textFields: ["text"]` on `SUBMIT_FAKE`). At `moderate` slurs and profanity are refused; `strict` also refuses mild terms; `off` checks nothing. A refused fake is rejected with `CONTENT_REJECTED` and the fixed core message (`CLIENT_MESSAGES.CONTENT_REJECTED`), and each refusal increments the synced `rejectedTexts` counter, which resets when the room returns to the lobby.

## Content

The prompts live in `content/prompts/`, one `.jsonc` pack file per theme, shaped `{ "id", "prompts": [{ "id", "question", "truth" }] }`. Pack ids and prompt ids are lowercase kebab-case and unique across every file; the loader reads the packs in name order. A good prompt has a truth that is surprising enough to sound fake — anyone who knows the answer breaks the bluffing, so school trivia with known answers does not belong here. The server refuses to start on a missing directory or file, invalid JSONC, duplicate ids, an empty list, or fewer than 6 prompts. Format and quality bar: `content/prompts/README.md`.

## Framework kits used (`@partygame/core/kits`, `@experimental`)

- **collectResponses**: `allResponded` (Writing completes when every present player submitted), `entriesFor` (the fakes that become options).
- **voteAndTally**: `tallyVotes` (Reveal vote counts), `allHaveVoted` (early Voting finish), `countVoted` (`votesCast`).
- **drawPool** (prompt draw with pool wrap-around).

Roster guards from the core root: `departedIds`, `isBelowMinimum`.

## UI

One screen per phase in `ui/screens/` (registered in `ui/screens/index.ts`), one viewmodel each under `ui/viewmodels/`, routed by `createAppRouter` from `@partygame/game-ui`. Every screen also renders with no seat (the TV display): the prompt, the board and the vote count stay visible, inputs disappear. Your own option is marked "yours" only in your private view — authorship never leaves the server until Reveal.

The lobby renders the shared `LobbyScreen` with a `LobbySettingsViewModel` built from `BluffOptionsSchema`: the host tunes every option (including the filter level) and everyone else sees them read-only. Results ranks ties with the shared `rankRows`/`Podium` — tied leaders share rank 1 and are all highlighted, leavers rank below seated players — and the writing screen caps fakes at `ANSWER_MAX_LENGTH`, keeps the draft on a refusal and shows the text filter's `CONTENT_REJECTED` message above the box.

## Running it

```sh
bun run launch bluff        # server + API + browser client (see the root AGENTS.md)
cd games/bluff && bun run dev:server   # just the game server, hot-reloading
```

A watch-only all-bot room comes from the launcher's demo tables (`botKit` in `gamePackage.ts`).

## Play in the terminal

```sh
bun run play bluff             # host a room; 3 bots join; uses the server on 2567/3001 or starts its own
bun run play bluff --join=ABCD # join a room as a normal player
bun run bots bluff ABCD 3      # add 3 bots (1 to 7) to a room you already created
bun run demo                   # this package's `demo` script; from the repo root: bun run demo bluff
                               # all-bot game on its own server, narrated (--bots N bots, 2 to 7, default 3)
```

You answer by typing: a fake at the writing prompt (`/q` quits it), a number for your vote, `q` at any menu.

## Running the tests

```sh
cd games/bluff && bun run test     # or: bun run test:coverage from the repo root
```
