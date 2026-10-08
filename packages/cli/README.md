# @partygame/cli

Scaffolds a new game into this monorepo from the built-in template.

```sh
bun run new <slug>                       # root script
bun packages/cli/src/cli.ts create <slug>   # direct
```

The `partygame` bin in `package.json` is for publishing this package; inside the monorepo it is never linked,
so use one of the two forms above.

## `create`

`create <slug> [--name "Display Name"]` writes a complete, working, fully-tested game to `games/<slug>/` and
runs `bun install` at the repo root so it is ready to play.

- The slug must be kebab-case starting with a letter (`[a-z][a-z0-9]*(-[a-z0-9]+)*`), not a reserved name, and
  there must be no existing `games/<slug>/`.
- Every name is derived from the slug: package `@partygame/<slug>`, room `<slug>` with dashes as underscores,
  PascalCase/camelCase identifiers and a spaced display name. `--name` overrides only the display name.
- The repo root is found by walking up to the nearest `package.json` whose `workspaces` include `games/*`;
  anything else fails with a clear error (this targets this monorepo only).

The template is a small wave-based game (phases `Waving` and `Results`) with a Svelte client, a terminal client,
bots and launcher wiring. Replace the ruleset in `games/<slug>/src/` with your own game. See
`docs/framework/README.md` for how each piece works.
