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
- The slug must not collide with the rest of the workspace: `@partygame/<slug>` may not be an existing package
  name, `<slug>`/`<slug>-game` may not be an existing game folder or its vitest project names (`<folder>`,
  `<folder>-game`), and `cli`/`scripts` are taken by fixed projects.
- Every name is derived from the slug: package `@partygame/<slug>`, room `<slug>` with dashes as underscores,
  PascalCase/camelCase identifiers and a spaced display name. `--name` overrides only the display name; it is
  trimmed and must not be empty. The display name may contain any characters (HTML, quotes, backslashes,
  newlines): code contexts render it as an escaped string literal, HTML placeholders as entities, and Markdown
  placeholders as entities with doubled backslashes and line breaks collapsed to spaces.
- The repo root is found by walking up to the nearest `package.json` whose `workspaces` include `games/*`;
  anything else fails with a clear error (this targets this monorepo only).
- When rendering or formatting fails, the incomplete `games/<slug>/` is removed and the command can simply be
  re-run. When `bun install` fails, the complete `games/<slug>/` is kept: re-run `bun install` from the repo
  root, or remove the directory and run the command again.

The template is a small wave-based game (phases `Waving` and `Results`) with a Svelte client, a terminal client,
bots and one declaration (`gamePackage.ts`) the entry files stub over. Replace the ruleset in `games/<slug>/src/` with your own game. See
`docs/framework/README.md` for how each piece works.

## Smoke test

`bun run smoke:template` renders the template into a test game, installs it, runs its tests and typecheck to ensure the template is ready for use; CI runs this on every pull request.
