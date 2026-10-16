# @partygame/content

Content-directory tooling for games: parse commented-JSON (`.json`/`.jsonc`) content folders and validate them against a Zod schema. Game-agnostic — the schemas and vocabulary stay in the game.

## Exports

| Subpath | What |
|---|---|
| `@partygame/content` | `stripJsonComments`, `loadJsoncDir` |

```ts
import { loadJsoncDir } from "@partygame/content";
import { z } from "zod";

const Item = z.object({ id: z.string(), n: z.number() });

// Every .json/.jsonc file in the folder, name order, validated; duplicate ids throw.
const items = await loadJsoncDir("./content/items", Item, { idOf: (item) => item.id, label: "Item" });
```

- `stripJsonComments(input)` removes `//` and `/* */` comments without touching comment-like sequences inside string literals.
- `loadJsoncDir(dir, schema, { idOf, label, onInvalid?, maxFiles?, maxFileBytes? })` loads every regular `.json`/`.jsonc` file in `dir` (name order; symlinks and subdirectories are ignored), parses it with `schema`, and refuses duplicate ids. A missing directory throws.
- Fail loudly by default: an unparsable file or a schema failure throws, naming the file (and the failing entry for schema errors). Pass `onInvalid: "skip"` to skip such files with a `console.warn` instead.
- Caps: more than `maxFiles` files (default 256) or a file above `maxFileBytes` bytes (default 1 MiB) throws.
