# Zod Documentation

> **Version:** v4.3.6
> **Package:** `zod@^4.3.6`

## Overview

Zod is the TypeScript-first schema validation library used throughout `vibe-coded` as the single source of truth for data shapes. It validates and parses untrusted data at runtime — player payloads, room options, game events — while inferring TypeScript types automatically. A schema defined once in `@partygame/shared` drives both server-side validation and client-side type safety with zero duplication.

Zod v4 is a significant rewrite over Zod v3: **14× faster string parsing**, **6.5× faster object parsing**, **100× fewer `tsc` instantiations**, and a **~57% smaller core bundle**.

## Key Concepts

- **Schema:** A `z.*` declaration that describes a data shape and performs runtime parsing/validation.
- **Parsing vs. Safeparsing:** `schema.parse()` throws on invalid input; `schema.safeParse()` returns `{ success, data, error }` — prefer the latter for untrusted network data.
- **Type Inference:** `z.infer<typeof schema>` (alias: `z.output`) extracts the TypeScript type after transforms; `z.input<typeof schema>` gives the raw input type. No separate `interface` needed.
- **Metadata & Registries (v4):** Schemas can carry metadata via `.meta()` and be stored in typed registries (`z.globalRegistry` or custom ones). Used for JSON Schema generation, documentation, and AI structured outputs.
- **Codecs (v4):** Bidirectional transformations (encode + decode) as a first-class concept, distinct from one-way `.transform()`.
- **Zod Mini (v4):** A tree-shakable variant (`zod/mini`) for smaller frontend bundles; trades method chaining for standalone functions.

## Common Functions/Methods

| Function                                            | Description                                                                                        |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `z.object({ ... })`                                 | Object schema with typed keys. Strips unknown keys by default.                                     |
| `z.strictObject({ ... })`                           | Object schema that rejects unknown keys (replaces `.strict()` from v3).                            |
| `z.looseObject({ ... })`                            | Object schema that passes through unknown keys (replaces `.passthrough()` from v3).                |
| `z.string()` / `.min()` / `.max()`                  | String schema with optional length constraints.                                                    |
| `z.email()`                                         | Top-level email string schema (replaces `z.string().email()`).                                     |
| `z.uuid()` / `z.url()` / `z.jwt()`                  | Top-level string format schemas (uuid, url, jwt, ip, cidr, mac, etc.).                             |
| `z.templateLiteral([...])`                          | Template literal type schema.                                                                      |
| `z.number()` / `.int()` / `.positive()`             | Number schema with numeric guards. Infinite values and unsafe integers rejected by default in v4.  |
| `z.bigint()` / `z.boolean()` / `z.date()`           | Primitive schemas.                                                                                 |
| `z.enum(["a", "b"])`                                | Typed literal union. Supports `.exclude()` and `.extract()` in v4.                                 |
| `z.nativeEnum()`                                    | **Deprecated in v4.** Use `z.enum()` instead.                                                      |
| `z.literal(value)`                                  | Exact value match. v4 accepts **multiple values**: `z.literal("a", "b")`.                          |
| `z.union([...])` / `z.discriminatedUnion()`         | Union of schemas. `discriminatedUnion` is upgraded in v4 to support nested discriminants.          |
| `z.array(schema)`                                   | Array of a given schema type. `.nonempty()` now narrows to `[T, ...T[]]`.                          |
| `z.record(keySchema, valueSchema)`                  | Record schema — **v4 requires both key and value schemas** (single-arg form dropped).              |
| `z.partialRecord(keySchema, valueSchema)`           | Record where not all keys are guaranteed present.                                                  |
| `z.file()`                                          | File/Blob schema (new in v4).                                                                      |
| `z.stringbool()`                                    | Parses `"true"`/`"false"` strings to booleans (new in v4).                                         |
| `z.optional(schema)` / `.nullable()` / `.nullish()` | Mark a field as `T \| undefined`, `T \| null`, or `T \| null \| undefined`.                        |
| `schema.parse(data)`                                | Parse and return typed data; throws `ZodError` on failure. Returns a deep clone.                   |
| `schema.safeParse(data)`                            | Returns `{ success: true, data }` or `{ success: false, error }`.                                  |
| `schema.parseAsync(data)` / `.safeParseAsync(data)` | Async variants required when using async refinements or transforms.                                |
| `schema.transform(fn)`                              | One-way transform after parsing.                                                                   |
| `schema.refine(fn, opts)`                           | Custom validation. `opts` supports `error`, `path`, `abort`, `when` in v4.                         |
| `schema.check(...checks)`                           | Attach multiple checks/refinements at once (new in v4).                                            |
| `schema.extend({ ... })`                            | Add fields to an existing object schema.                                                           |
| `schema.safeExtend({ ... })`                        | Like `.extend()` but raises a TS error on key overlap (new in v4).                                 |
| `schema.pick({ ... })` / `.omit({ ... })`           | Derive a subschema by selecting/excluding keys.                                                    |
| `schema.partial()` / `.required()`                  | Make all keys optional or required.                                                                |
| `schema.meta(data)`                                 | Attach metadata to a schema and register it in `z.globalRegistry` (new in v4).                     |
| `schema.meta()`                                     | Retrieve previously set metadata (called with no args).                                            |
| `schema.describe(str)`                              | Shorthand for `.meta({ description: str })`; kept for v3 compat.                                   |
| `schema.register(registry, meta)`                   | Register schema in a custom registry with metadata. Returns the original schema (no new instance). |
| `z.infer<typeof schema>`                            | Extract the output TypeScript type from a schema.                                                  |
| `z.input<typeof schema>`                            | Extract the input TypeScript type (before transforms).                                             |
| `z.toJSONSchema(schema)`                            | Convert a Zod schema to JSON Schema (new in v4).                                                   |
| `z.fromJSONSchema(jsonSchema)`                      | Convert JSON Schema to a Zod schema (new in v4).                                                   |
| `z.prettifyError(err)`                              | Render a `ZodError` as a human-readable string (new in v4).                                        |
| `z.treeifyError(err)`                               | Render a `ZodError` as a nested tree structure (new in v4).                                        |
| `z.formatError(err)`                                | Replaces deprecated `.format()` on `ZodError`.                                                     |
| `z.flattenError(err)`                               | Replaces deprecated `.flatten()` on `ZodError`.                                                    |
| `z.globalRegistry`                                  | Built-in registry accepting `{ id, title, description, deprecated, ... }` metadata.                |

## Error Handling

`ZodError` in v4 exposes an `.issues` array. Each issue has a `code`, `path`, and `message`. Instance methods `.format()` and `.flatten()` are **deprecated** — use the standalone `z.formatError()`, `z.flattenError()`, `z.treeifyError()`, and `z.prettifyError()` functions instead.

```ts
const result = schema.safeParse(input)
if (!result.success) {
  console.log(z.prettifyError(result.error))
}
```

## Codecs (v4)

Codecs are bidirectional schemas with `.encode()` and `.decode()`. Unlike `.transform()`, they preserve the ability to round-trip values. Useful built-in codecs include `z.stringToNumber`, `z.isoDatetimeToDate`, `z.json(schema)`, `z.base64ToBytes`, and others. See [https://zod.dev/codecs](https://zod.dev/codecs).

## Metadata & Registries (v4)

```ts
// Attach metadata to a schema (registers it in z.globalRegistry)
const emailSchema = z.email().meta({
  id: "email_address",
  title: "Email address",
  description: "Your email address",
})

// Custom typed registry
const myRegistry = z.registry<{ description: string }>()
z.string().register(myRegistry, { description: "A cool string" })
```

Metadata is instance-scoped — calling `.refine()` or other transforming methods returns a new instance and drops metadata. Re-attach with `.meta()` after such chains.

## Installation

```bash
# Using Bun (recommended)
bun add zod

# Using npm
npm install zod

# Using pnpm
pnpm add zod

# Using Yarn
yarn add zod
```

## v4 Breaking Changes (key items for this project)

- **Import style:** Use `import { z } from "zod"` (not `import * as z from "zod"`). Both styles work, but the project convention is named import.
- **`z.object()` variants:** `.strict()` and `.passthrough()` are deprecated; use `z.strictObject()` and `z.looseObject()`.
- **`z.record()`** now requires two arguments (key schema + value schema).
- **`z.nativeEnum()`** is deprecated; migrate to `z.enum()`.
- **`z.string()` format methods** (`.email()`, `.uuid()`, etc.) are deprecated in favour of top-level `z.email()`, `z.uuid()`, etc.
- **`.merge()`** is deprecated; use `.extend()`.
- **`.deepPartial()`** is dropped.
- **`ZodEffects`** is dropped; replaced by `ZodTransform`.
- **`ZodError` methods** `.format()` and `.flatten()` are deprecated; use `z.formatError()` / `z.flattenError()`.
- **Error customization:** `errorMap`, `invalid_type_error`, and `required_error` options are dropped. Use the `error` param on individual schemas instead.
- **`z.number()` now rejects infinite values** and `.int()` only accepts safe integers.

Full changelog: [https://zod.dev/v4/changelog](https://zod.dev/v4/changelog)

## Best Practices in This Project

- **Define schemas in shared packages.** Place schemas used by both server and client (e.g. room options, game events) in `@partygame/shared` so Colyseus and Svelte components share the same contract.
- **Use `safeParse` for all incoming network data.** Player messages, join options, and HTTP payloads are untrusted; never use `.parse()` directly in `onMessage` or `onJoin`.
- **Keep schemas co-located with their types.** Export both `export const MySchema = z.object(...)` and `export type My = z.infer<typeof MySchema>` from the same file.
- **Don't over-validate internal state.** Zod validation costs should be at trust boundaries (network ingress), not inside hot game loops.
- **Prefer `z.discriminatedUnion` for game events.** All game events have a `type` discriminant — this makes parsing faster and type narrowing automatic. v4's `discriminatedUnion` also handles nested discriminants.
- **Use `z.input` when you need the raw input shape** of a schema that has transforms applied, rather than assuming `z.infer` reflects the unparsed shape.
- **Use top-level format schemas** (`z.email()`, `z.uuid()`, `z.url()`) rather than the chained v3 equivalents (`z.string().email()`), which are deprecated in v4.
- **Use `z.prettifyError` / `z.treeifyError`** for development-time error logging instead of accessing `.issues` directly.
- **Don't use Zod v3 imports alongside v4.** Import from `"zod"` consistently. If a third-party library pins `zod/v3`, that package exposes it at `zod/v3` — keep those imports isolated.

## References

- [Official Docs](https://zod.dev)
- [Basic Usage](https://zod.dev/basics)
- [API Reference](https://zod.dev/api)
- [v4 Release Notes](https://zod.dev/v4)
- [v4 Migration Guide / Changelog](https://zod.dev/v4/changelog)
- [Metadata & Registries](https://zod.dev/metadata)
- [Codecs](https://zod.dev/codecs)
- [JSON Schema](https://zod.dev/json-schema)
- [Error Customization](https://zod.dev/error-customization)
- [Error Formatting](https://zod.dev/error-formatting)
- [Zod Mini](https://zod.dev/packages/mini)
- [LLM index](https://zod.dev/llms.txt)
