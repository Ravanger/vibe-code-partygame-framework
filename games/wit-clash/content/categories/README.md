# WitClash Categories

Each file in this directory defines one category of prompts for WitClash games. In free play (the default) every round the game offers
three random categories and the players vote for one; its prompts become that round's matchups. In daily mode (`mode: "daily"` room
option, see the game README) the vote is skipped and each round plays the next category of a day-seeded order of exactly these files —
they are the canon every server plays on a given UTC date, so adding or editing a file changes what daily rooms deal.

## File Format

- One file per category
- Supported extensions: `.json` and `.jsonc` (JSON with comments)
- Comments are allowed in `.jsonc` files using `//` or `/* */`

## Category Schema

```jsonc
{
  "id": "my-category",      // REQUIRED: unique across all files, lowercase letters, digits and hyphens
  "name": "My Category",    // REQUIRED: display name
  "emoji": "🎲",            // OPTIONAL: default is 🎲
  "prompts": [              // REQUIRED: at least one; see the recommendation below
    { "id": "my-category-1", "text": "Your prompt text here." }
  ],
  "tieBreakers": [          // OPTIONAL: used when the final round ends level, see below
    { "id": "my-category-tb-1", "text": "Tie-breaker prompt." }
  ],
  "weight": 1,              // OPTIONAL: default is 1; relative chance of being offered in free play
  "rating": "family"        // OPTIONAL: default is "family"; "mature" is only offered when the room allows it
}
```

## Weighting and ratings (free play)

- **`weight`** is a relative chance, not a probability: a category with weight 2 is offered about twice as often as one
  with weight 1. A weight of 0 means the category is never offered in free play (its prompts are simply unreachable there).
  Daily mode ignores weights and plays the canon in its day-seeded order.
- **`rating`** tags a category `"family"` or `"mature"`. The room option `contentRating` (lobby settings, default `"any"`)
  decides what free play may offer: `"any"` offers everything, `"family"` never offers a `"mature"` category. Daily mode
  ignores ratings too.

## Tie-breakers

If two or more players share the top score after the final round, the tied players answer one tie-breaker prompt and everyone else
votes. An unused tie-breaker of the category played last is picked first, then an unused one of any other category. A vote that ends
level plays another prompt among the players still level, so the more tie-breakers the content has, the longer a stubborn tie can go on;
when none are left the tie stands as a shared win. Like prompts, tie-breaker ids must be unique across all files, and each is used at most
once per game. A category without any simply adds nothing to the pool.

## Rules

1. **Unique category ids:** `id` must match `^[a-z0-9-]+$` and be unique across ALL files. A duplicate stops the server from starting.
2. **Unique prompt ids:** The game remembers used prompts by `id` across the whole game, so every prompt `id` should be unique across ALL
   files. Prefix them with the category name, as the bundled files do. The loader does not check this.
3. **Prompt count:** A round uses one prompt per player (up to 8), and a prompt is not repeated within a game until its category runs out.
   At least 16 per category is a sane floor; the bundled files have 40 each.
4. **Bad files are skipped:** A file that is not valid JSON or does not match the schema is skipped with a `[CategoryRepository] Skipping <file>`
   warning in the server log, so a typo quietly removes a category. Check the log after adding one.
5. **Minimum:** The server refuses to start with fewer than 3 valid categories, or with fewer than 3 family-rated ones (a
   room set to `contentRating: "family"` would have nothing to play).
6. **Restart to reload:** Files are read once at startup. Set `WITCLASH_CONTENT_DIR` to read the free-play content from another
   directory; daily mode always uses this repo directory and ignores the variable.

## Adding a Category

1. Create a new file like `my-category.jsonc` in this directory
2. Follow the schema above
3. Restart the game server and look for a `Skipping` warning

## Examples

See `animals.jsonc`, `politics.jsonc`, `conspiracy-corner.jsonc` and `afterlife-support.jsonc` for working examples.
