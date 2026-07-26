# WitClash Categories

Each file in this directory defines one category of prompts for WitClash games.

## File Format

- One file per category
- Supported extensions: `.json` and `.jsonc` (JSON with comments)
- Comments are allowed in `.jsonc` files using `//` or `/* */`

## Category Schema

```jsonc
{
  "id": "my-category",      // REQUIRED: unique across all files, lowercase kebab-case
  "name": "My Category",    // REQUIRED: display name
  "emoji": "🎲",            // OPTIONAL: default is 🎲
  "prompts": [              // REQUIRED: at least 8 prompts recommended
    { "id": "myp-1", "text": "Your prompt text here." }
  ],
  "tieBreakers": [          // OPTIONAL: used for tie-breaker rounds
    { "id": "myp-tb-1", "text": "Tie-breaker prompt." }
  ]
}
```

## Rules

1. **Unique IDs:** The `id` field must be unique across ALL category files and match `^[a-z0-9-]+$`.
2. **Prompt IDs:** Each prompt needs a unique `id` within its file.
3. **Minimum prompts:** At least 8 prompts per category is recommended. With fewer, prompts may repeat within a single round when there are many players.
4. **Server reloads on restart:** Changes to category files take effect when the server restarts.

## Adding a Category

1. Create a new file like `my-category.jsonc` in this directory
2. Follow the schema above
3. Restart the game server

## Examples

See `politics.jsonc`, `food.jsonc`, `sci-fi.jsonc`, and `workplace.jsonc` for working examples.