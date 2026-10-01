# Zod Documentation

> **Version:** 4.6.5 (`packages/shared`, `packages/core`, `games/wit-clash`, server tests; all declare `^4.6.5`)

## Overview
Runtime validation at trust boundaries. Wire schemas live in `packages/shared/src/protocol.ts`; each game declares its action payload schemas (`games/wit-clash/src/actions.ts`) and content schema (`CategoryRepository.ts`). Types are inferred, never hand-written. Zod implements Standard Schema, so Colyseus could validate with it directly, but we `safeParse` ourselves (see [colyseus.md](colyseus.md)).

## Used in this repo
| API | Where |
|---|---|
| `z.discriminatedUnion("type", [...])` | `GameActionSchema`, one `z.object` per client action (`START_GAME`, `VOTE_CATEGORY`, `SUBMIT_ANSWER`, `CAST_VOTE`, `ACKNOWLEDGE_REVEAL`, `NEXT_ROUND`, `PLAY_AGAIN`). |
| `z.literal`, `z.object`, `z.string().min().max()`, `.trim()` | Payload shapes; `SetNameSchema` is `z.string().trim().min(1).max(20)`. |
| `z.string().length(4).regex(...)` | `RoomCodeSchema`. |
| `z.array`, `.default(...)` | Category files (`emoji` defaults, `tieBreakers` defaults to `[]`). |
| `.safeParse` | `GameRoom` for `ACTION` and `SET_NAME` messages: reject silently on failure. |
| `.parse` | `CategoryRepository.loadFromDir` on host-edited `.jsonc` (throws, aborts startup). |
| `z.infer` | `GameAction`, `GameActionType`. |

## Gotchas
- **Three places must agree on an action name**: `GameActionSchema`, the phase `actions` in `games/wit-clash/index.ts`, and the client `room.send("ACTION", ...)`. A mismatch makes `safeParse` fail and the action is dropped with no error; this is why buttons "worked" but the game never advanced. Names are `SCREAMING_SNAKE_CASE`.
- Adding an action also needs a field-level bound (`.max()`); unbounded strings from clients are a DoS vector.
- `z.object` strips unknown keys; use `z.strictObject` if extra keys should be rejected.
- Zod 4: `z.record` needs key and value schemas; use top-level `z.email()` / `z.uuid()` not `z.string().email()`; `.format()` / `.flatten()` on errors are deprecated in favour of `z.prettifyError`, `z.treeifyError`. None of these are used here yet.
- `CategoryRepository.d.ts` shows inferred types as `z.ZodObject<..., z.core.$strip>`; that is normal for v4.

## Best Practices in This Project
- Always `safeParse` network data; `parse` only for trusted startup config.
- Keep schemas in `@partygame/shared` so server and client share one contract.
- Validate at ingress, not inside hot loops.

## References
- [Zod docs](https://zod.dev), [v4 changelog](https://zod.dev/v4/changelog)
