import { $childType, ArraySchema, MapSchema, type Schema } from "@colyseus/schema";

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

/**
 * A fresh instance of a schema class filled from plain synced JSON — the inverse of {@link
 * syncedJsonOf}. `json` must be the output of `syncedJsonOf` for this class: each field present in
 * it is assigned, arrays and maps are filled item by item, nested refs get fresh instances. Fields
 * absent from `json` keep the class default; fields tagged `.view()` are never touched.
 */
export function syncedStateFromJson<T extends Schema>(
  ctor: new () => T,
  json: Record<string, unknown>,
): T {
  const state = new ctor();
  fill(state, json);
  return state;
}

function fill(state: Schema, json: Record<string, unknown>): void {
  for (const field of fieldsOf(state.constructor)) {
    if (field.tag !== undefined) continue; // `.view()` — never in a snapshot
    const value = json[field.name];
    if (value === undefined) continue; // absent — keep the default
    assign(state, field.name, value);
  }
}

/** The element/value class of a collection, or `null` for primitive element types. */
function childTypeOf(
  collection: ArraySchema<unknown> | MapSchema<unknown, string>,
): (new () => Schema) | null {
  const child = Reflect.get(collection, $childType);
  return typeof child === "function" ? (child as new () => Schema) : null;
}

function assign(state: Schema, name: string, value: unknown): void {
  const current = Reflect.get(state, name);
  if (current instanceof ArraySchema) {
    const child = childTypeOf(current);
    for (const item of value as unknown[]) {
      current.push(child === null ? item : filled(child, item));
    }
    return;
  }
  if (current instanceof MapSchema) {
    const child = childTypeOf(current);
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      current.set(key, child === null ? item : filled(child, item));
    }
    return;
  }
  if (value && typeof value === "object") {
    fill(current as Schema, value as Record<string, unknown>); // nested ref: fill in place
    return;
  }
  Reflect.set(state, name, value);
}

function filled(ctor: new () => Schema, json: unknown): Schema {
  const child = new ctor();
  fill(child, json as Record<string, unknown>);
  return child;
}
