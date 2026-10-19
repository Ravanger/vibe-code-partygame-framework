import { ArraySchema, MapSchema, type Schema } from "@colyseus/schema";

/** One field slot as stored under a numeric index key in a schema class's `Symbol.metadata`. */
interface FieldSlot {
  name: string;
  /** View tag set by `.view()`; `undefined` for synced fields. */
  tag?: number;
}

type FieldMetadata = Record<string, FieldSlot>;

/** Every field of a schema class — own and inherited — in declaration order. */
function* fieldsOf(ctor: object): Generator<FieldSlot> {
  let metadata = Reflect.get(ctor, Symbol.metadata) as FieldMetadata | null | undefined;
  while (metadata) {
    for (const field of Object.values(metadata)) yield field;
    metadata = Object.getPrototypeOf(metadata);
  }
}

/**
 * Plain JSON of a synced schema state: every field clients receive, at every level. Fields tagged
 * `.view()` are per-client visibility and are dropped; arrays and maps are serialized item by item.
 */
export function syncedJsonOf(state: Schema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fieldsOf(state.constructor)) {
    if (field.tag !== undefined) continue; // `.view()` — never in a snapshot
    out[field.name] = serialize(Reflect.get(state, field.name));
  }
  return out;
}

function serialize(value: unknown): unknown {
  if (value instanceof ArraySchema) {
    const items: unknown[] = [];
    for (let i = 0; i < value.length; ++i) items.push(serialize(value[i]));
    return items;
  }
  if (value instanceof MapSchema) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of value) out[key] = serialize(item);
    return out;
  }
  if (value && typeof value === "object") return syncedJsonOf(value as Schema);
  return value;
}
