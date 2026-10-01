# @colyseus/schema Documentation

> **Version:** 5.0.35 (`packages/server`, `games/wit-clash`)

## Overview
Binary delta-encoded state. `BaseGameState` and `PlayerSchema` (`packages/shared/src/schema/`) and the WitClash classes (`games/wit-clash/src/state.ts`) are defined with `schema()`; clients mirror them through `@colyseus/sdk`. Schema 5 is decorator-free: no `experimentalDecorators`, no `useDefineForClassFields: false`, no `ts-transform` Vitest plugin, no `oxc: false`.

## Syntax
```ts
import { type SchemaType, schema, t } from "@colyseus/schema";

export const Answer = schema({ id: t.string().default(""), votes: t.number().default(0) }, "Answer");
export type Answer = SchemaType<typeof Answer>;          // value and type share a name

export const MyState = BaseGameState.extend({
  answers: t.array(Answer),                               // collections default to empty
  progress: t.map("number"),                              // primitive elements take the type NAME
  mine: t.map(PlayerPrivate).view(),                      // StateView-only
}, "MyState");
export type MyState = SchemaType<typeof MyState>;
```
- The second argument names the class for reflection; keep it unique and equal to the const name.
- `schema()` returns a real class (`new Answer()`, `instanceof`). Initial values may be passed: `new Answer({ id: "a" })`.
- `.extend(fields, name)` subclasses; this is how a game extends `BaseGameState`. Methods can be declared in the same object.
- `t.string<"host" | "player">()` refines the type only (the wire is a plain string); used for `PlayerSchema.role`.
- `@type`/`@view()` decorators still work and produce the same wire format; do not use them in new code. `defineTypes` is deprecated.

## Used in this repo
| API | Usage |
|---|---|
| `schema`, `t.string/number/boolean`, `.default()` | Every primitive field, always with a default. |
| `t.array(X)`, `t.map(X)`, `t.map("number")` | Collections; no initialiser needed. |
| `.view()` | `mine` (per-player private data). See below. |
| `SchemaType<typeof X>` | Instance types. |
| `StateView` | Created per client in `GameRoom.onJoin` (`client.view = new StateView()`). |
| `Encoder`, `Reflection` | `BaseGameState.test.ts` proves a game state encodes and reflects. |

## StateView (per-player visibility)
- A `.view()` field is sent only to clients whose `StateView` contains the **instance** that holds it, or, for a collection item, the item. `state.mine` is a `.view()` map; each player's entry is a child `PlayerPrivate` instance revealed with `view.add(entry)` (core: `ctx.showTo(playerId, entry)`; revoke with `view.remove`, core: `ctx.hideFrom`).
- A client without the entry in its view never receives the map key either: entries appear and disappear in `state.mine` as the view changes.
- `GameRoom` keeps `playerId -> Set<ref>` and re-adds the refs when a seat is re-attached by a new session. On a token reconnect Colyseus carries the old `StateView` over to the new client.
- Remove an entry from the view **before** deleting it from the map.
- 5.x also has `view.subscribe(collection)` (standing subscription) and `t.stream()`; not used.

## Gotchas
- **63 fields per class**; `schema()` throws at definition time beyond that. Declare frequently mutated tagged fields among the first 32 (faster change classification).
- Primitive collection element types are names (`"number"`), never builders: `t.map(t.number())` is wrong.
- Only synchronised, client-visible data belongs in a Schema. Server-private data lives in `ctx.priv`. `.noSync()` gives a local-only typed field.
- Mutate in place (`map.set`, `seat.isConnected = false`); never replace a nested instance when avoidable. Reconnect and patches rely on object identity: the client keeps the same `Schema` instances across an automatic reconnect.
- Do not mock `@colyseus/schema` in tests; `BaseGameState.test.ts` encodes a real state.
- Client side: `room.state` is decoded from reflection unless a root class is passed as the third argument of `create/joinById` (`rootSchema`). Prefer `Callbacks.get(room)` from `@colyseus/sdk` (`listen`, `onAdd`, `onRemove`, `onChange`, `bindTo`); see [colyseus.md](colyseus.md).

## References
- [Schema docs](https://docs.colyseus.io/state), `packages/shared/src/schema/BaseGameState.ts`, `games/wit-clash/src/state.ts`
