# Security Threat Model

What the framework does and does not protect, for game authors and maintainers. Every `Today` entry was verified against the code at the milestone that last touched it (M8 · Security); paths are relative to the repo root.

## Scope and assumptions

- One server process hosts every room of one or more games; there is no cluster, no persistence layer and no account system.
- The setting is party play on a LAN or over the internet: players are ephemeral, identities are self-chosen per session, and the host is a trusted human at the table — not an authenticated service principal.
- The framework's job is to keep **one client from reading or controlling what belongs to another** inside a room, and to keep the process alive under hostile input. It does not provide authentication, transport encryption, audit trails or abuse observability beyond the structured log lines listed under *Denial of service*.
- Transport encryption (TLS) is out of scope for the framework; put a terminating proxy in front when playing over the internet (see [../HOSTING.md](../HOSTING.md)).
- A compromised server process is game over: everything below assumes the process and its memory are trustworthy.

## Assets

| Asset | Why it matters |
|---|---|
| **Private state** | Per-player entries (`.view()`), `ctx.priv`, replay logs — other clients must never see them. |
| **Seat ownership** | Who controls a seat; strangers must not take over a seat or re-enter after a kick. |
| **Room control** | Host-only operations (start, options, kick, end, export) and the room's roster. |
| **Server availability** | The single process keeps serving all rooms under malformed input and floods. |

## Trust boundaries

| Boundary | What crosses it | Stance |
|---|---|---|
| Client → room (WebSocket) | Join options, `ACTION` envelopes, `SET_NAME`, `EXPORT_REPLAY` | Adversarial. Every byte is schema-validated before it reaches game code; rejections are fixed client-safe messages. |
| Client → HTTP API (`/api/resolve-code`) | Room code lookups | Adversarial origin and address. CORS allow-list (loopback by default) plus a per-address token bucket. |
| Game → framework | `defineGame` definitions, phase hooks, action handlers, `publicFields` declarations | Trusted author. The framework enforces the boundaries the game *declares* (e.g. which state fields are public) and refuses to boot on violations. |
| Content files → server | JSON/JSONC data files loaded at startup | Trusted deployer. Parsed and validated against a caller-supplied schema (`@partygame/content`). |

## Player ids

**Threat.** `playerId` is a client-generated string sent in the join options; the server has no independent identity source, so a client can choose any unused id or present someone else's.

**Abuse case.** Mallory joins with Alice's `playerId` to take over her seat, or sends an `Object.prototype` key (`__proto__`) as the id to pollute server-side lookups.

**Today.**
- Shape is validated by `PlayerIdSchema` — 8–64 of `A-Za-z0-9_-`, and `Object.prototype` keys are rejected explicitly (`PlayerIdSchema` in `packages/shared/src/protocol.ts`; tests in `packages/shared/tests/protocol.test.ts`).
- Presenting an existing `playerId` no longer takes over the seat: since M8 a matching seat secret is required (see *Seat takeover and reconnect*). Choosing an **unused** id is by design — there are no accounts.

**Expectation for game authors.** Key state, scores and private maps by `playerId` within a session; never treat it as a stable cross-session identity or as authenticated.

**Status.** `accepted: no account system; the id is a session-scoped label, and takeover additionally requires the seat secret.`

## Seat takeover and reconnect

**Threat.** Taking over another player's seat, or re-entering after being kicked.

**Abuse case (pre-M8).** Present an existing `playerId` on join: the old code called `reconnected(existing, client)` unconditionally, so the id alone was the credential. **Post-M8 abuse attempt:** present Alice's `playerId` without her secret — refused with close 4406 (`SEAT_TAKEN`); present it *with* a stolen secret — succeeds (see residual risk).

**Today.**
- Plainly: **before M8, `playerId` was the only credential for a seat. Today, reclaiming or taking over a seat requires presenting both its `playerId` and that seat's secret**; a new seat must also carry one.
- The secret is 72 random characters (two joined UUIDs) generated client-side per session, persisted in browser localStorage (`JoinOptionsSchema.seatSecret` in `packages/shared/src/protocol.ts`).
- The server stores only `sha256(seatSecret)` per seat (`GameRoom.seatSecrets` in `packages/server/src/rooms/GameRoom.ts`, set in `GameRoom.onJoin`) and compares digests with `timingSafeEqual`; a wrong or missing secret on an existing seat closes with `SEAT_TAKEN` (4406), a secretless first join is refused the same way, and a matching secret takes over — the old session is closed with 4409 (`GameRoom.onJoin`; the takeover close is `CLOSE_CODES.SEAT_TAKEN_OVER`).
- Kicked players are remembered by `playerId` **and** by their secret's hash, so a regenerated id cannot rejoin either way (close 4403, `KICKED_REJOIN`; `GameRoom.kicked` and `GameRoom.kickedSecretHashes`, checked in `GameRoom.onJoin`, recorded in `GameRoom.dropSeat`).
- Token reconnects inside the `reconnectMs` window (`reconnectMs`, default `DEFAULT_RECONNECT_MS` in `packages/server/src/createGameServer.ts`) go through Colyseus's `allowReconnection` (`GameRoom.onDrop`) and need no secret.
- Tests: the `seat secret` describe in `packages/server/tests/GameRoom.reconnect.test.ts` (hijack refused, secretless joins refused, takeover closes the old session, kicked-by-hash refused).

**Expectation for game authors.** Treat a seat as owned by whoever holds its secret; nothing you write changes that. Do not build cross-session identity on `playerId`.

**Status.** `mitigated` (id-alone takeover closed); residual risk `accepted: the secret lives client-side, so anyone with access to that browser profile can take the seat — no server-side revocation exists beyond a kick, which is remembered.`

## Room codes

**Threat.** Guessing or enumerating room codes to discover and join other people's rooms.

**Abuse case.** Loop `GET /api/resolve-code?code=AAAA … ZZZZ` against the API to map every live room (4 letters over a 26-letter alphabet = 456,976 candidates).

**Today.**
- Codes are drawn from a CSPRNG: `RoomCodeService`'s `randomIndex` defaults to `node:crypto`'s `randomInt` (`packages/server/src/services/RoomCodeService.ts`); alphabet and length are `ROOM_CODE_ALPHABET` and `ROOM_CODE_LENGTH` in `packages/shared/src/limits.ts`. Distribution is pinned by `packages/server/tests/RoomCodeService.test.ts` (5,000 codes within expected per-letter bounds).
- The endpoint is throttled per remote address with a token bucket (default 1/s, burst 10 — `DEFAULT_RESOLVE_CODE_BUCKET` in `packages/server/src/createGameServer.ts`); refusals answer `429` with `Retry-After` (`createApiHandler` in `packages/server/src/api/createApiHandler.ts`; tests in `createApiHandler.test.ts`).
- CORS headers go out only for allowed origins — loopback by default (`DEFAULT_ALLOWED_ORIGINS` and `ApiHandlerOptions.allowedOrigins` in `createApiHandler.ts`) — and the API binds to loopback unless host mode is chosen (`startNodeServer` in `packages/server/src/node.ts`, default host `127.0.0.1`).
- Codes are in-memory per process; nothing persists or crosses processes.

**Expectation for game authors.** Share codes over a channel your players trust; a code grants *joining as a new player*, never control of an existing seat (that needs the seat secret).

**Status.** `mitigated` (CSPRNG + per-address throttle make full enumeration impractical: after the 10-request burst, one lookup per second ≈ days for the whole space); residual risk `accepted: a non-browser client on the same host is not bound by CORS and can spend its bucket at the throttled rate.`

## Private state and StateView

**Threat.** Per-player data (hands, secrets, private scores) leaking to other clients or spectators.

**Abuse case.** A client inspects its synced state for another player's `.view()` entries — or a game author forgets to mark a field private and it syncs to everyone.

**Today.**
- Each connection gets its own `StateView` at join (`GameRoom.onJoin` and `GameRoom.views` in `packages/server/src/rooms/GameRoom.ts`); the game shows/hides entries per player with `ctx.showTo`/`hideFrom`. Spectators start with an empty view.
- The boundary is enforced **mechanically at boot**: every field of a state class must be `.view()`, allow-listed in the game's `publicFields`, or a `BaseGameState` field — otherwise `assertSyncedFields` throws and the server refuses to start (`assertSyncedFields` in `packages/shared/src/schema/syncedFields.ts`, called from `createGameServer`; tests in `packages/shared/tests/syncedFields.test.ts`).
- Tests proving isolation end to end: `packages/server/tests/security.isolation.test.ts` (a spectator and another player hold no `.view()` entries, before and after a drop + fresh-session rejoin; the rejoiner gets exactly its own entry back).

**Expectation for game authors.** Declare every field other clients may see in `publicFields`; anything else must be `.view()`. The server will not boot otherwise — that is the point.

**Status.** `mitigated`.

## Room options and join options

**Threat.** A client injecting hostile room/join options (prototype pollution, oversized or malformed payloads) or speaking a different protocol version to desync the wire.

**Abuse case.** Create a room with `options` carrying an `__proto__` key or a multi-megabyte JSON blob; join with a stale `protocolVersion` so client and server disagree about message shapes.

**Today.**
- Create options are parsed against `RoomOptionsSchema` (`RoomOptionsSchema` in `packages/shared/src/protocol.ts`) — unknown framework keys are filtered before game options are validated (`GameRoom.onCreate`); the serialized length is capped by `MAX_OPTIONS_JSON_LENGTH` (4 KiB, `packages/shared/src/limits.ts`). Failures close with `INVALID_OPTIONS`.
- Join options are parsed against `JoinOptionsSchema` (`JoinOptionsSchema` in `protocol.ts`); anything non-conforming gets the server's own refusal, not an exception.
- The protocol version is enforced at both create and join: a mismatch closes with `VERSION_MISMATCH` — a close, not a negotiation (`GameRoom.onCreate` and `GameRoom.onJoin`; constant `PROTOCOL_VERSION` in `protocol.ts`).
- Tests: `packages/server/tests/GameRoom.options.test.ts`, `GameRoom.join.test.ts`, `packages/shared/tests/protocol.test.ts`.

**Expectation for game authors.** Declare your option fields with defaults and ranges in one Zod schema; the framework parses, validates and re-publishes it — do not read raw create options yourself.

**Status.** `mitigated`.

## User-generated content

**Threat.** Player names and free-text answers carrying profanity or markup; cross-site scripting in game UIs.

**Abuse case.** A player sets the name `<img src=x onerror=…>` (names are capped at 20 characters, which shortens but does not eliminate payloads) or types a script tag into a free-text answer that the UI renders.

**Today.**
- Names: `SetNameSchema` trims and enforces 1–`NAME_MAX_LENGTH` (20) characters with no control characters (`SetNameSchema` in `packages/shared/src/protocol.ts`, `NAME_MAX_LENGTH` in `packages/shared/src/limits.ts`); duplicate names are refused (`NAME_TAKEN`), a taken join-time name is dropped.
- Optional profanity filtering: a `TextFilter` from `@partygame/content` wired into `createGameServer`; names are checked at join (close 4405) and on `SET_NAME`, and action text fields via `textFilterMiddleware` (`packages/core/src/middleware.ts`) at the game's `filterLevel` (`off`/`moderate`/`strict`, default `off`). Filtered rejections are recorded **without** the offending text (`redactPayload`; `packages/core/src/actionLog.ts`). Tests: `packages/server/tests/GameRoom.filter.test.ts`.
- The framework does not sanitize HTML. Svelte escapes text interpolation by default; rendering user content with `@html` would be an unsanitized XSS hole and is the game's responsibility.

**Expectation for game authors.** Never render user content through `@html`; set a `filterLevel` appropriate to your audience (a kids' party table wants `strict`); treat names as display-only labels, never as identifiers beyond `playerId`.

**Status.** `mitigated` (input shape + optional filter) with `accepted: HTML safety is the game UI's job via Svelte's default escaping — the framework neither renders content nor adds a sanitizer.`

## Replay and action logs

**Threat.** The log records every accepted action payload (and names); it is a quasi-private record of everything said in the room, and replay re-executes it.

**Abuse case.** A non-host sends `EXPORT_REPLAY` to exfiltrate other players' answers; or a hand-edited/malicious log is fed to `replayLog` with hostile entries.

**Today.**
- The log lives server-side only: `actionLogMiddleware` appends into a module-level store keyed by `ctx.priv` (`logs` and `actionLogMiddleware` in `packages/core/src/actionLog.ts`) — it is never part of synced state.
- Export is host-only: `EXPORT_REPLAY` from anyone else gets an `UNAUTHORIZED` refusal (`GameRoom.exportReplay` in `packages/server/src/rooms/GameRoom.ts`); the answer is a hashed bundle whose integrity can be checked by viewers.
- Rejected text can be kept out of the log entirely (`redactPayload`, used by the text filter; `packages/core/src/actionLog.ts`).
- Replay input is validated up front against the strict `ActionLogSchema`; malformed logs throw named `replayLog:` errors before anything runs (`replayLog` in `packages/core/src/replay/replay.ts`), and a 500-iteration seeded fuzz pins that property (`packages/core/tests/security.fuzz.test.ts`).

**Expectation for game authors.** Assume the **host** can read every payload ever sent in their room — declare `textFields` for anything sensitive so it can be filtered and redacted, and say so in your game's rules.

**Status.** `mitigated` (access: host-only export, server-side storage, strict replay validation) with `accepted: the host seeing everything is by design — they run the game.`

## Host privileges

**Threat.** A non-host performing host operations; a removed player returning and acting again.

**Abuse case.** Player 2 sends `KICK_PLAYER`, `END_GAME` or `SET_OPTIONS`; or a kicked player rejoins with a fresh id and tries to act as if they were still seated.

**Today.**
- The built-ins are host-only: `KICK_PLAYER` and `END_GAME` in every phase (`packages/core/src/runtime/lobby.ts`), `START_GAME` and `SET_OPTIONS` in the Lobby (same file); the role check rejects non-hosts with `UNAUTHORIZED` before any handler runs (`DispatchPipeline.run` in `packages/core/src/runtime/DispatchPipeline.ts`).
- Kicked players cannot rejoin by id **or** by secret hash (see *Seat takeover and reconnect*).
- If the host leaves, the role moves to the next connected seat (`GameRuntime.migrateHost` and the `hostMigration` policy in `packages/core/src/runtime/GameRuntime.ts`), so a room is never left without someone who can start, kick or end.
- Tests: `packages/server/tests/security.hostile-input.test.ts` (non-host `KICK_PLAYER`/`RESET` refused with state byte-identical afterwards; wrong-phase `WRONG_PHASE`).

**Expectation for game authors.** Gate host-ish UI on `role === "host"`; the server rejects the action regardless, so a race between two clients cannot double-execute it.

**Status.** `mitigated`.

## Denial of service

**Threat.** One client — or many — exhausting the single process with floods, oversized input or room spam.

**Abuse case.** A client fires actions faster than the game can handle; a 10 MiB WebSocket frame lands on the socket; an off-LAN script opens rooms until memory runs out.

**Today.**
- Per-player token buckets throttle `ACTION` (default 10/s, burst 20) and `SET_NAME` (2/2); refusals are dropped **before** dispatch, so they never reach game code or the log (`GameRoom.limited`, called from the `ACTION` handler and `GameRoom.setName`; bucket in `packages/server/src/RateLimiter.ts`; defaults in `createGameServer.ts`; tests in `GameRoom.rateLimit.test.ts` and `RateLimiter.test.ts`). Spectator actions have a per-connection bucket (`GameRoom.actAudience`).
- WebSocket frames above `maxPayloadBytes` (default 4 KiB) close only that connection with code 1009, leaving the room untouched (`maxPayloadBytes` in `packages/server/src/createGameServer.ts`; test in `createGameServer.test.ts`).
- Hostile envelopes are rejected cheaply at the protocol edge: at most 32 keys (`MAX_ENVELOPE_KEYS` in `packages/shared/src/limits.ts`, enforced by `ActionEnvelopeSchema` in `packages/shared/src/protocol.ts`) and a strict action-name pattern (same schema, checked first in `DispatchPipeline.run`; pinned by `security.hostile-input.test.ts` and the fuzz in `packages/core/tests/security.fuzz.test.ts`).
- Room flood is capped: `maxRooms` (default 100) refuses new rooms with close 4429 (`maxRooms` in `createGameServer.ts`, checked in `GameRoom.onCreate`; test in `GameRoom.limits.test.ts`); each room admits at most `maxPlayers + audienceSlots` connections (`audienceSlots`, default 32); empty rooms are disposed after `emptyRoomGraceMs` (default `DEFAULT_EMPTY_ROOM_GRACE_MS` in `createGameServer.ts`).
- The code API is throttled per address (see *Room codes*).

**Expectation for game authors.** Keep phase hooks and handlers fast and allocation-light — a pathological hook blocks the process's event loop, and no framework cap can save you from your own code. A hook that throws returns the room to the Lobby via `onError`; it does not take the process down.

**Status.** `mitigated` for per-client floods, oversized frames and room spam; what remains is listed under *Open findings*. The structured logger (`jsonLineLogger` from `@partygame/server`; `GameRoom.logLine`) records `room.created`, `player.joined`, `player.left`, `player.reconnected` and `action.rejected`, but a rate-limit refusal (`GameRoom.limited` returning false) and a host `EXPORT_REPLAY` write no log line, so who flooded or exported, and when, is not recorded.

## Open findings

Abuse cases above whose Status is open. Each is tracked by an issue; none is unfiled.

1. **No per-address cap on joins and room creation** (#320). The in-room throttles key on `playerId`/session inside a room, but nothing limits how many *connections* or *rooms* one remote address may open: a script can fill `maxRooms` (default 100) and lock everyone out with `SERVER_FULL` (4429).
2. **Host-side replay export is unthrottled and unlogged** (#395). A host can call `EXPORT_REPLAY` repeatedly; every call answers with the full bundle and no trace is kept server-side.
3. **A spectator can join under a seated player's id** (#325).
4. **The code-resolve throttle shares one bucket behind a reverse proxy** (#326), and its bucket map grows with every distinct address.
