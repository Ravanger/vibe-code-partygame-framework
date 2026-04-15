# @colyseus/schema Documentation

> **Package:** `@colyseus/schema`

## Overview

`@colyseus/schema` is Colyseus's binary serialisation and delta-sync layer. Every property annotated with `@type(...)` on a `Schema` subclass is tracked: when any value changes, only the changed bytes are sent to clients over WebSocket. In `vibe-coded`, all authoritative game state — players, scores, round data, game phase — lives in Schema classes. Clients receive a live, automatically-patched mirror of the server state.

## Key Concepts

- **`Schema`:** Base class for all synchronised state objects. Extend it and annotate properties with `@type(...)`.
- **`@type(primitive)`:** Decorator that registers a field for synchronisation. Primitives: `"string"`, `"number"`, `"boolean"`, `"int8"`, `"uint8"`, `"int16"`, `"uint16"`, `"int32"`, `"uint32"`, `"float32"`, `"float64"`.
- **`MapSchema<T>`:** An ordered map of Schema-tracked entries. Use for player registries keyed by `sessionId`. Changes to individual entries produce minimal diffs.
- **`ArraySchema<T>`:** A Schema-tracked array. Use for ordered lists like hand cards or turn order.
- **Delta Encoding:** Only changed fields are serialised per tick. Unchanged fields produce zero bytes on the wire.
- **Client-side mirroring:** The `colyseus.js` client deserialises the schema automatically. You access `room.state.players.get(id).score` as a live object.
- **`onChange` / `onAdd` / `onRemove`:** Reactive callbacks on collections for client-side UI updates.

## Common Functions/Methods

| Function | Description |
|---|---|
| `class MyState extends Schema { ... }` | Define a root state class. Assign to `this.state` in the Room. |
| `@type("number") score = 0` | Annotate a primitive field for synchronisation. |
| `@type(Player) player: Player` | Annotate a nested Schema reference. |
| `@type({ map: Player }) players = new MapSchema<Player>()` | Annotate a MapSchema of a nested type. |
| `@type({ array: Card }) hand = new ArraySchema<Card>()` | Annotate an ArraySchema of a nested type. |
| `mapSchema.set(key, value)` | Add or update an entry. Change is delta-encoded. |
| `mapSchema.delete(key)` | Remove an entry. Triggers `onRemove` on the client. |
| `mapSchema.get(key)` | Read an entry by key. |
| `mapSchema.forEach((value, key) => ...)` | Iterate over entries. |
| `room.state.players.onAdd((player, key) => ...)` | Client-side callback when a new entry is added to a collection. |
| `room.state.players.onRemove((player, key) => ...)` | Client-side callback when an entry is removed. |
| `player.onChange(() => ...)` | Client-side callback when any field on this instance changes. |

## Best Practices in This Project

- **Keep Schema classes small and flat.** Deep nesting increases serialisation overhead and makes change tracking harder to reason about. Prefer multiple shallow schemas over one deeply nested tree.
- **Use `MapSchema<Player>` keyed by `client.sessionId`** for the player registry. This makes lookups O(1) and reconnection handling clean.
- **Only put authoritative game state in Schema.** Don't track transient server-only data (e.g. timers, actor references, internal flags) as `@type` fields — they'll be sent to every client.
- **Use the smallest numeric type that fits.** `"uint8"` for a 0–100 score, `"uint16"` for round numbers, not `"number"` (float64) for everything.
- **Never mutate nested Schema properties by replacing the reference.** Mutate properties in-place (`player.score += 1`). Replacing the reference (`this.state.player = new Player()`) works but sends more data.
- **Attach `onChange`/`onAdd`/`onRemove` in the Svelte component's `$effect`**, and clean them up in the return function to avoid memory leaks.
- **Don't use plain objects or arrays for synchronised state.** They won't be tracked. Always use `MapSchema` / `ArraySchema`.

## References

- [Official Docs](https://docs.colyseus.io/state/schema)
- [Schema API](https://docs.colyseus.io/state/schema#schema-types)
