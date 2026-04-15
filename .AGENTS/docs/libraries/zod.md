# Zod Documentation

> **Version:** v4 (imported via `"zod"` or `"zod/v4"`)

## Overview

Zod is a TypeScript-first schema validation library used throughout `vibe-coded` as the single source of truth for data shapes. It validates and parses untrusted data at runtime — player payloads, room options, game events — while inferring TypeScript types automatically. A schema defined once in a shared package drives both server-side validation and client-side type safety with zero duplication.

## Key Concepts

- **Schema:** A `z.*` declaration that describes a data shape and performs runtime parsing/validation.
- **Parsing vs. Safeparsing:** `schema.parse()` throws on invalid input; `schema.safeParse()` returns `{ success, data, error }` — prefer the latter for untrusted network data.
- **Type Inference:** `z.infer<typeof schema>` extracts the TypeScript type from a schema — no separate `interface` needed.
- **Transformations:** `.transform()` converts parsed values (e.g. trimming strings, normalising IDs) in one step.
- **Global Registry (v4):** `z.globalRegistry` lets you register schemas by name for shared/dynamic lookup across packages.
- **`z.infer` vs `z.output`:** Use `z.infer` (alias of `z.output`) for the shape after transforms; use `z.input` for the raw input shape.

## Common Functions/Methods

| Function | Description |
|---|---|
| `z.object({ ... })` | Define an object schema with typed keys. |
| `z.string()` / `.min()` / `.max()` | String schema with optional length constraints. |
| `z.number()` / `.int()` / `.positive()` | Number schema with numeric guards. |
| `z.enum(["a", "b"])` | Typed literal union from an array of values. |
| `z.union([...])` / `z.discriminatedUnion()` | Union of schemas; use discriminated when there's a shared tag field (faster). |
| `z.literal(value)` | Exact value match. |
| `z.array(schema)` | Array of a given schema type. |
| `z.optional(schema)` / `.nullable()` | Mark a field as `T \| undefined` or `T \| null`. |
| `schema.parse(data)` | Parse and return typed data, throws `ZodError` on failure. |
| `schema.safeParse(data)` | Returns `{ success: true, data }` or `{ success: false, error }`. |
| `schema.transform(fn)` | Chain a transform function after parsing. |
| `schema.extend({ ... })` | Add fields to an existing object schema. |
| `schema.pick({ ... })` / `.omit({ ... })` | Derive a subschema by selecting/excluding keys. |
| `z.infer<typeof schema>` | Extract the TypeScript type from a schema. |

## Best Practices in This Project

- **Define schemas in shared packages.** Place schemas used by both server and client (e.g. room options, game events) in a shared `packages/schemas` package so Colyseus and Svelte components share the same contract.
- **Use `safeParse` for all incoming network data.** Player messages, join options, and HTTP payloads are untrusted; never use `.parse()` directly in `onMessage` or `onJoin`.
- **Keep schemas co-located with their types.** Export both `export const MySchema = z.object(...)` and `export type My = z.infer<typeof MySchema>` from the same file.
- **Don't over-validate internal state.** Zod validation costs should be at trust boundaries (network ingress), not inside hot game loops.
- **Prefer `z.discriminatedUnion` for game events.** All game events have a `type` discriminant — this makes parsing faster and type narrowing automatic.
- **Avoid chaining `.transform()` on schemas that are also used for type inference** in places where you need the raw input shape; use `z.input<typeof schema>` when you need both.
- **Don't use Zod v3 imports alongside v4.** Import from `"zod"` (v4 root) consistently. If a third-party library pins `zod/v3`, import that separately.

## References

- [Official Docs](https://zod.dev)
- [v4 Migration Guide](https://zod.dev/v4)
- [API Reference](https://zod.dev/api)
