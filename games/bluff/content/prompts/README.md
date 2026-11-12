# Bluff prompts

One `.jsonc` file per pack, loaded in name order. Each pack is shaped:

```jsonc
{ "id": "<kebab-case>", "prompts": [ { "id", "question", "truth" } ] }
```

- Pack ids and prompt ids must be unique across every file (a duplicate refuses to start).
- Prompt id format: lowercase kebab-case.
- Comments are allowed (JSONC) and ignored.

**Quality bar:** the truth must be surprising enough to sound fake. If most players already know the answer, there is nothing left to bluff — replace it.
