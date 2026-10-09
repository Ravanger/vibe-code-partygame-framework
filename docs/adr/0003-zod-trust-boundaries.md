# ADR 0003: Zod validates every trust boundary

**Status:** Proposed

## Context

Untrusted input arrives at the server from clients: room join options, action payloads, player names. Malformed or malicious messages can corrupt room state or bypass game rules.

## Decision

Every trust boundary is validated with Zod schemas before reaching game logic:
- **Wire protocol envelope** (`ActionEnvelopeSchema`) — `{ type, ...fields }` with a SCREAMING_SNAKE_CASE action name.
- **Room join options** (`JoinOptionsSchema`) — `playerId`, optional `name`, optional `spectator`.
- **Error codes** (validated by `isServerError`) — only known error codes leave the server.
- **Action payloads** — each `ActionDefinition.payload` is a Zod schema; handlers receive validated objects.
- **Game options** (`definition.options`) — room creation options are parsed at `GameRoom.onCreate`.
- **Player name** (`SetNameSchema`) — trimmed, 1–20 characters.

## Alternatives considered

- **Runtime validation in hooks:** Each hook checks its own inputs. Rejected because boundaries would be inconsistent and bugs would slip through.
- **TypeScript types only:** Trust that the client sends the right shape. Rejected because the wire is untrusted.

## Consequences

Game hooks receive only valid, narrowly-typed payloads. Invalid input is rejected with `INVALID_ACTION` before reaching the game logic. The schemas live in `packages/shared` so both client and server can validate the same structure. New actions must declare a Zod payload schema.

## Where it lives

- `packages/shared/src/protocol.ts` — `ActionEnvelopeSchema`, `JoinOptionsSchema`, `SetNameSchema`, `ErrorCode`, `isServerError`, `isActionResult`
- `packages/core/src/runtime/types.ts` — `ActionDefinition.payload` type
- `packages/server/src/rooms/GameRoom.ts` — `RoomOptionsSchema` parse at line 66
- `packages/core/tests/` — tests showing validation and rejection
- `docs/framework/README.md` — Actions section and Zod payload requirement

**Sources:** Code inspection, `docs/framework/README.md` (Actions, Awaiting an action's outcome, Host controls sections).
