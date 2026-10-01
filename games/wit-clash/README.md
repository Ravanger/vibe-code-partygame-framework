# WitClash

A Quiplash-style party game for 3 to 8 players, built on `@partygame/core` and `@partygame/server`.
Everything here is game rules; the lobby, room codes, reconnection and timers come from the framework.

```
src/
  game.ts            createWitClashGame({ categories }) assembles the phases
  phaseNames.ts      PHASE constants, shared with the UI
  playerLimits.ts    MIN_PLAYERS and MAX_PLAYERS: the game definition and the minimum-players rule read the same numbers
  actions.ts         ACTION constants, zod payloads, typed defineAction
  options.ts         zod options schema: the single source of defaults and limits
  state.ts           synced schema (the client contract) with the `.view()` private entries
  private.ts         server-only state: content, authorship, drafts, votes, scores
  phases/            one PhaseDefinition per file; answering.ts holds the answer actions shared by both answering phases, endGame.ts the host-only END_GAME every phase accepts
  round.ts           writes rule results into the synced state
  tieBreakerFlow.ts  the final tie-breaker: contenders, prompt, answers, votes, verdict
  matchups.ts  categoryVote.ts  eligibility.ts  tally.ts  drafts.ts  promptPool.ts  scoring.ts  scoreboard.ts  tieBreaker.ts  bestAnswers.ts
                     pure rules: plain data and the rng in, plain data out
  content/           category files (.jsonc) loader
  loadContent.ts     loads and validates the content directory for server.ts
ui/                  Svelte client, built on @partygame/game-client (see below)
bots/                dev tool: BotPlayer, joinBots, BotTable and the `bun run bots` CLI (see "Playtesting alone")
server.ts            Bun entry: loads the content, then startServer from @partygame/server/bun
content/categories/  host-editable .jsonc categories, at least 3 needed
```

## Rules

A game is `totalRounds` rounds. A round is

`CategorySelection -> Prompting -> (MatchupVoting <-> MatchupReveal)* -> [TieBreakerPrompting -> TieBreakerVoting -> TieBreakerReveal]* -> Results`

The bracketed tie-breaker phases only follow the final round.

1. **CategorySelection**: three random categories are offered; everyone votes (changing your vote is fine). The phase ends when every
   active player has voted or the timer runs out; ties, and nobody voting, are broken at random among the leaders.
   This happens every round. Players who joined mid-game become active here.
2. **Prompting**: with 3 or more players each player is dealt two prompts and each prompt is shared by two players (ring pairing),
   so there is one matchup per player. With 2 players there is one shared matchup; with 1, one prompt. A prompt is never reused
   within a game (a category that runs out of fresh prompts starts over). The phase ends when everyone has answered
   every prompt, or at the deadline; answers can be edited until then. Anything unanswered becomes `(no answer)`.
3. **MatchupVoting**: one matchup at a time. Every active, connected player who did not write one of its answers votes.
   Votes can be changed until the reveal and stay hidden until then.
4. **MatchupReveal**: authors and vote counts are shown, points are awarded, then the next matchup starts.
5. **Tie-breaker** (final round only): see below.
6. **Results**: scoreboard. The host sends `NEXT_ROUND` (not after the final round) or `PLAY_AGAIN` (back to the lobby, everything reset).

### Scoring

| Event | Points |
| --- | --- |
| Each vote for your answer | 100 |
| Winning a matchup outright (strictly the most votes) | +50 |
| CLASH: every cast vote, and all of at least two eligible voters, went to your answer | +150 |
| Winning by forfeit (see below) | 50, nothing else |

A tie gives vote points only. Placeholders score nothing.

### Tie-breaker

After the last reveal of the final round, if two or more active players share the top score, they become the contenders.
Players who left are not counted. Contenders never vote: if nobody outside the tie is left to vote, no tie-breaker is played and the
tie stands as a shared win.

1. **TieBreakerPrompting** (`promptSeconds`): the contenders answer one prompt. Prompt choice: an unused `tieBreakers` entry of the
   category played last, else of any other category; each is used once per game. Only contenders may `SUBMIT_ANSWER`.
2. **TieBreakerVoting** (`voteSeconds`): the answers are shown without authors. Everyone active outside the tie votes with `CAST_VOTE`;
   contenders cannot vote.
3. **TieBreakerReveal** (`revealSeconds`): authors and votes are shown.

Outcomes: one clear top vote-getter wins, gets +1 point and `ScoreEntry.wonTieBreaker`, and the game goes to Results. A top vote tie
(including nobody voting) plays a new prompt among only the players still level. A contender who does not answer cannot win; a single
answer wins without a vote (`isForfeit`); no answers, or no unused tie-breaker prompt left, ends as a shared win with no winner.
Contenders who leave are dropped, and a lone remaining contender wins. If every voter leaves, or none is left for a new prompt, it ends as a shared win.

The attempts accumulate in `tieBreakers` (a `Matchup` each, the last is current). `tieBreakerContenders` is the current tied set.

### Best answer

The answer with the highest vote share in a contested matchup (its votes divided by the votes cast in that matchup), ties broken by raw
votes. Answers level on both share the award. Forfeits and tie-breaker answers do not count. The history is kept across rounds and
published as `bestAnswers` when the final round reaches Results; `PLAY_AGAIN` resets it.

### Typing indicator

`SET_TYPING { typing }` while answering (Prompting and TieBreakerPrompting) from a player who has something to answer; anyone else
gets `NOT_ALLOWED`. `typing[playerId]` is `true` while typing and absent otherwise. It is cleared when that player's answers are all in,
when the phase ends, and when the player leaves.

### No-answer matchups

- Exactly one real answer: a **forfeit**. It is revealed at once, with no vote, and its author gets the winner bonus only.
  `isForfeit` is true on the matchup.
- No real answers: the matchup is skipped and never shown.
- `(no answer)` placeholders are never votable.

### Hidden votes

Who voted for what lives in server-only state and in the voter's own `mine` entry. The public state only has `votesCast` and
`votesExpected` until the reveal; `answers[].votes` and `answers[].authorId` stay `0` and blank until then. Category tallies are public,
who cast them is not.

### Players coming and going

- Eligibility (`mine[you].canVote`) is: active, connected, named, and not an author of the matchup. It is recomputed on every roster
  change, and an unfinished phase is completed at once if the leaver was the last one it waited for.
- Someone who joins mid-game is inactive until the next CategorySelection: not eligible, no prompts. The same goes for a lobby player who
  never chose a name before Start: only named seats are activated, so they stay inactive until they have a name and a new round begins.
- **Minimum players**: when fewer than `MIN_PLAYERS` (3) seats are active and named, the game is over: the room returns to the lobby and
  `state.notice` says why. The count is of seats, not connections, so a brief disconnect does not end the game. It is checked on entering
  CategorySelection (so also on `NEXT_ROUND`) and on every roster change in every phase except Results, whose scoreboard stays up.
- **END_GAME** (host, every phase): returns everyone to the lobby with the notice "The host ended the game."
  `state.notice` is cleared when CategorySelection is entered.
- Scores, prompts, drafts and votes are keyed by `playerId`, so reconnecting changes nothing and nothing needs resending.
- The scoreboard lists everyone who took part in the game, including those on 0 points. Seated players come first (best score first); players who left keep their name and score with `hasLeft` and rank below every seated player. Only seated players can be champion or stand on the podium, and only they contend in the final tie-breaker.

## State contract

`WitClashState extends BaseGameState` (`phase`, `phaseEndsAt`, `roomCode`, `serverNow`, `players`, `options`, `minPlayers`, ...).

| Field | Type | Notes |
| --- | --- | --- |
| `categoryOptions` | `CategoryOption[]` `{id,name,emoji,votes}` | Tallies public. Kept after the vote so the result can be shown |
| `selectedCategory` | string | Winning category id, empty until resolved |
| `notice` | string | Why the game went back to the lobby (too few players, host ended it); empty otherwise. Shown by the waiting room |
| `roundNumber`, `totalRounds`, `isFinalRound` | number, number, boolean | `isFinalRound` is set on entering Results |
| `matchups` | `Matchup[]` `{id,index,promptText,answers,isRevealed,isForfeit,isClash}` | `answers[]` is `{id,text,votes,authorId,authorName,isWinner}`; all but `text` are zero/blank/false until `isRevealed` |
| `activeMatchupIndex` | number | `-1` outside voting and reveal |
| `votesCast`, `votesExpected` | number | Public vote progress: category votes in CategorySelection, answer votes in MatchupVoting |
| `progress` | `map<playerId, number>` | Answers submitted this round, for progress badges |
| `answersPerPlayer` | number | Prompts dealt to each player |
| `scoreboard` | `ScoreEntry[]` `{playerId,name,score,roundPoints,matchupsWon,hadClash,wonTieBreaker,hasLeft}` | Written on entering Results |
| `tieBreakers` | `Matchup[]` | One per tie-breaker attempt; `answers` hide authors and votes until `isRevealed`; `isForfeit` for a lone answer |
| `tieBreakerContenders` | `string[]` of playerIds | Who is in the current tie-breaker |
| `bestAnswers` | `BestAnswer[]` `{text,authorId,authorName,promptText,votes}` | Empty until the final Results; several entries when the award is shared |
| `typing` | `map<playerId, boolean>` | Present and `true` while that player is typing an answer |
| `mine` | `map<playerId, PlayerPrivate>` (`.view()`) | Each entry is visible to its owner only |

`PlayerPrivate`: `prompts` (`{matchupId,promptText,submitted}[]`), `categoryVote`, `matchupVote`, `canVote`, `isOwnMatchup`, `ownAnswerId`
(during the tie-breaker: `isOwnMatchup` means contender, `ownAnswerId` is your answer to it).
There are no targeted game-data messages; read `state.mine[playerId]`. Only `ERROR` is sent to a single client.

## Actions

Names are in `ACTION` (`src/actions.ts`); a new one needs a zod schema there and an entry in a phase's `actions`.

| Action | From | Phase | Payload |
| --- | --- | --- | --- |
| `VOTE_CATEGORY` | player | CategorySelection | `{ categoryId }` |
| `SUBMIT_ANSWER` | player | Prompting, TieBreakerPrompting | `{ matchupId, answer }` (1 to 200 chars, trimmed) |
| `SET_TYPING` | player | Prompting, TieBreakerPrompting | `{ typing }` |
| `CAST_VOTE` | player | MatchupVoting, TieBreakerVoting | `{ answerId }` |
| `NEXT_ROUND` | host | Results | none; refused after the final round |
| `PLAY_AGAIN` | host | Results | none |
| `END_GAME` | host | every phase except the lobby | none; returns to the lobby with a notice |

Plus the framework's `START_GAME`, `SET_OPTIONS` and `KICK_PLAYER`.

## Options

Passed when the room is created or changed by the host in the lobby with `SET_OPTIONS`; `WitClashOptionsSchema` is the source.

| Option | Default | Range |
| --- | --- | --- |
| `totalRounds` | 3 | 1 to 10 |
| `categoryVoteSeconds` | 60 | 5 to 300 |
| `promptSeconds` | 90 | 15 to 600 |
| `voteSeconds` | 20 | 5 to 120 |
| `revealSeconds` | 5 | 1 to 30 |

## Content and running

Category files live in `content/categories/*.jsonc` (format: `content/categories/README.md`); drop a file in and restart. `server.ts` loads
`WITCLASH_CONTENT_DIR` or `content/categories` next to it and refuses to start with fewer than 3 categories. Ports come from `PORT` (2567) and
`API_PORT` (3001). Hosting and LAN play: `docs/HOSTING.md`.

```
bun run launch         # repo root: game server, API and Vite, waits until all answer
bun run dev            # repo root: Vite client and game server through turbo
bun run dev:server     # this package: game server only (bun --hot server.ts)
```

## Playtesting alone

```bash
bun run launch:bots          # dev stack + your room; 3 bots join once you enter your name
bun run bots ABCD 3          # add 3 bots (1 to 7) to a room you already created
```

You are the host: press Start Game (3 or more players, bots included) and Next Round; the game does not start by itself. The bots answer and vote on their own.
For another number of bots use `bun run launch --bots=N` (1 to 7); `bun run bots` takes `--endpoint` and `--api-port`. Ctrl+C removes the bots.

## Client (`ui/`)

```
main.ts             builds the GameConnectionManager<WitClashState> (storagePrefix "witclash"), resumes, mounts App
config.ts           server endpoints from the page's host (VITE_SERVER_HOST, VITE_GAME_PORT, VITE_API_PORT) and the `?code=` share link
manager.ts          the WitClashManager type
App.svelte          screen router, error toast, "reconnecting" indicator, Leave game / End game controls outside the lobby
screens/            one component per screen: Welcome, WaitingRoom, JoinNextRound, CategoryVote, Prompting,
                    MatchupVote, MatchupReveal, TieBreakerPrompting, TieBreakerVote, TieBreakerReveal, Results
components/         MatchupCard, Scoreboard, Podium, ProgressBadges, LobbySettings, QrCode, NameInput, GameControls
viewmodels/         one viewmodel per screen, plus Scoreboard, Podium, MatchupRecap, AnswerProgress and TypingReporter helpers
```

- `AppViewModel` routes to a `PHASE_SCREENS` entry in `ui/screens/index.ts` (one entry per phase: component and mid-game waiting label). A seat with `isActive === false` outside the lobby gets
  `JoinNextRound`: the current phase and the scoreboard, read-only, plus the name input when the seat has no name yet (and "next game" wording during the last round). Any non-connected status shows `Welcome`; a kick leaves its `KICKED` error in the toast.
- Viewmodels read `manager.state` (typed `WitClashState`) and `state.mine.get(manager.playerId)`; actions go through
  `manager.sendAction(ACTION.X, payload)` with the constants and payload types from `src/actionNames.ts` / `src/actions.ts`.
- The client never recomputes rules. Winners (`answer.isWinner`), clashes (`matchup.isClash`), author names (`answer.authorName`), turnout
  (`votesCast`/`votesExpected`, also in CategorySelection), eligibility (`mine.canVote`) and limits (`minPlayers`, `maxPlayers`, `options`) are published by the server.
- Results shows a podium (top three places; tied players share a step, leavers are marked, `wonTieBreaker` gets a badge), the best-answer award (`state.bestAnswers`; several entries read "Shared best answer"), then the scoreboard. Prompting shows the winning category and tells a player who was dealt no prompt that they sit this round out and vote. Prompting and TieBreakerPrompting list each answering player's `n/answersPerPlayer`, a done tick and a "typing…" marker; the answer boxes send `SET_TYPING` once on the first keystroke and once after 2.5 s idle or on submit. All of it renders large in the TV layout.
- Votes stay hidden while voting: only `votesCast`/`votesExpected` and your own highlighted vote show. Counts and authors appear in `MatchupReveal`.
- Add a phase screen: a viewmodel, a screen component and one `PHASE_SCREENS` entry in `ui/screens/index.ts`.

## Tests

`tests/game` runs on Node. Rule tests drive the real runtime with `FakeHost` and a real `WitClashState`; the `integration.*` files
use a real Colyseus server (one per file) to cover private views, hidden votes and reconnection. The Svelte tests are in the other `tests/` folders: viewmodels against a real `WitClashState` through `StubRoom`, screens with Testing Library, and
`tests/ui.integration.test.ts`, which plays a round with three real managers against a real server.
