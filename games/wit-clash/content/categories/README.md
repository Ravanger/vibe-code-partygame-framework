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
  "weight": 1,              // OPTIONAL: default is 1; relative chance of being offered in free play, 0 = never
  "rating": "family"        // OPTIONAL: "family" or "mature"; mature is only offered when the room's contentRating is "any"
}
```

## Tie-breakers

If two or more players share the top score after the final round, the tied players answer one tie-breaker prompt and everyone else
votes. An unused tie-breaker of the category played last is picked first, then an unused one of any other category. A vote that ends
level plays another prompt among the players still level, so the more tie-breakers the content has, the longer a stubborn tie can go on;
when none are left the tie stands as a shared win. Like prompts, tie-breaker ids must be unique across all files, and each is used at most
once per game. A category without any simply adds nothing to the pool.

## Rules

1. **Unique category ids:** `id` must match `^[a-z0-9-]+$` and be unique across ALL files. A duplicate stops the server from starting.
2. **Unique prompt ids:** The game remembers used prompts by `id` across the whole game, so every prompt `id` must be unique across ALL
   files — prompts and tie-breakers share one id space, and a repeat within one file counts too. Prefix them with the category name, as the
   bundled files do. A duplicate stops the server from starting and names both locations; every repeat is listed in one error.
3. **Prompt count:** A round uses one prompt per player (up to 8), and a prompt is not repeated within a game until its category runs out.
   At least 16 per category is a sane floor; the bundled files have 40 each.
4. **Bad files stop startup:** A file that is not valid JSON or does not match the schema stops the server from starting with an error that
   names the file and, for schema problems, every failing field. Unknown fields are rejected too — a typo in a key is an error, not a
   silently ignored category.
5. **Weighting:** In free play the three offered categories are sampled by `weight` — a category's share of offerings tracks its
   weight, and a weight of 0 means it is never offered. Equal weights (the default) deal a uniform pick as before. Daily mode deals
   from its day-seeded order and ignores weights.
6. **Rating:** `rating` is `"family"` (the default) or `"mature"`. Mature categories are only offered in free play when the room's
   `contentRating` option is `"any"`; a `"family"` room never sees them. Daily mode plays every category regardless of rating.
7. **Minimum:** The server refuses to start with fewer than 3 offerable (`weight` > 0) categories, or fewer than 3 offerable
   family-rated ones — a weight-0 category is never offered, so it does not count; a family-rated room must always have options.
8. **Restart to reload:** Files are read once at startup. Set `WITCLASH_CONTENT_DIR` to read the free-play content from another
   directory; daily mode always uses this repo directory and ignores the variable.

## Example errors

A prompt id repeated in two files (every repeat is listed, one per line):

```text
Duplicate prompt id "animals-1" at tieBreakers[0] in afterlife-support.jsonc (category "afterlife"); already used at prompts[0] in animals.jsonc (category "animals")
```

An unknown field in a category file:

```text
[Category] my-category.jsonc failed validation: ✖ Unrecognized key: "weigth"
```

## Adding a Category

1. Create a new file like `my-category.jsonc` in this directory
2. Follow the schema above
3. Restart the game server; a content problem stops the start and names the file and field to fix

## Examples

See `animals.jsonc`, `politics.jsonc`, `conspiracy-corner.jsonc` and `afterlife-support.jsonc` for working examples.
