# @partygame/content

Content tooling for games: parse commented-JSON (`.json`/`.jsonc`) content folders and validate them against a Zod schema; filter free text (answers, player names) against an English profanity dataset. Game-agnostic — the schemas and vocabulary stay in the game.

## Exports

| Subpath | What |
|---|---|
| `@partygame/content` | `stripJsonComments`, `loadJsoncDir`, `loadJsoncDirWithFiles` |
| `@partygame/content/filter` | `TextFilter`, `FilterLevel`, `FilterResult`, `createTextFilter` |

```ts
import { loadJsoncDir } from "@partygame/content";
import { z } from "zod";

const Item = z.object({ id: z.string(), n: z.number() });

// Every .json/.jsonc file in the folder, name order, validated; duplicate ids throw.
const items = await loadJsoncDir("./content/items", Item, { idOf: (item) => item.id, label: "Item" });
```

- `stripJsonComments(input)` removes `//` and `/* */` comments without touching comment-like sequences inside string literals.
- `loadJsoncDir(dir, schema, { idOf, label, onInvalid?, maxFiles?, maxFileBytes? })` loads every regular `.json`/`.jsonc` file in `dir` (name order; symlinks and subdirectories are ignored), parses it with `schema`, and refuses duplicate ids. A missing directory throws.
- `loadJsoncDirWithFiles(dir, schema, options)` is the same loader but returns `{ file, value }` per item, so a caller can name the source file in its own errors (e.g. cross-file checks).
- Fail loudly by default: an unparsable file or a schema failure throws, naming the file (and the failing entry for schema errors). Pass `onInvalid: "skip"` to skip such files with a `console.warn` instead.
- Caps: more than `maxFiles` files (default 256) or a file above `maxFileBytes` bytes (default 1 MiB) throws.

## Text filtering

`createTextFilter()` returns the default English `TextFilter`, backed by the [obscenity](https://github.com/jo3-l/obscenity) dataset and its recommended transformers (case folding, confusables, leet-speak such as `$` for `s`, repeated-letter collapse). Matchers are built lazily on first use.

```ts
import { createTextFilter } from "@partygame/content/filter";

const filter = createTextFilter();
filter.check("hello world", "moderate"); // { ok: true }
filter.check("what the $hit", "moderate"); // { ok: false, reason: "contains inappropriate language" }
```

Levels (`FilterLevel`):

- `off` — everything passes.
- `moderate` — slurs and profanity fail; mild terms (e.g. `ass`, `bastard`, `boob`) pass.
- `strict` — the full dataset fails, mild terms included.

On rejection the `reason` is a short fixed string per level (`"contains inappropriate language"` at moderate, `"contains strong language"` at strict); it never contains the matched word, so it is safe to show to players. The filter lives on its own subpath so consumers that only load content files do not pull the dataset in.
