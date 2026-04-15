# Turbo (Turborepo) Documentation

> **Version:** v2.7 (December 2025)

## Overview

Turborepo is the build system orchestrating the `vibe-coded` monorepo. It understands the dependency graph between packages (`shared`, `server`, `client`, `schemas`) and runs tasks — `build`, `test`, `lint`, `dev` — in the correct order, in parallel where possible, and with content-aware caching so unchanged packages are never rebuilt. In a party game project where the server and client share schema and utility packages, Turbo ensures that a change to `packages/schemas` correctly triggers downstream rebuilds in both `apps/server` and `apps/client`.

## Key Concepts

- **Task:** A script defined in `package.json` that Turbo knows about via `turbo.json`. Tasks have inputs, outputs, and dependencies.
- **`turbo.json`:** The root configuration file. Defines tasks under the `"tasks"` key (v2 syntax — previously `"pipeline"`).
- **`dependsOn`:** Declares task ordering. `"^build"` means "run `build` in all dependency packages first". A plain `"test"` (no caret) means "run `test` in the same package before this task".
- **Caching:** Turbo hashes inputs (source files, env vars, lockfile) and skips task execution on a cache hit. Outputs (e.g. `dist/`) are saved and restored.
- **Remote Caching:** Share the cache across machines and CI. Connect via `npx turbo login && npx turbo link` (Vercel Remote Cache) or configure a custom provider.
- **`--filter`:** Scope tasks to specific packages. Supports package names, paths, and git diff ranges (`--filter=[main...HEAD]`).
- **`--affected`:** Run tasks only for packages changed since a baseline (e.g. `--affected --base=origin/main`). Introduced in v2.1.
- **Persistent tasks:** Tasks with `"persistent": true` (e.g. `dev`) run indefinitely and are never cached.
- **Package Configurations:** Per-package `turbo.json` files that extend and override root config. As of v2.7, `extends` can reference any package, not just the root.
- **Devtools (v2.7):** Run `turbo devtools` to visually explore the Package Graph and Task Graph.

## Common Functions/Methods

| Command | Description |
|---|---|
| `turbo run build` | Run the `build` task across the repo, respecting `dependsOn`. |
| `turbo run dev` | Start all `dev` tasks (persistent; not cached). |
| `turbo run test --filter=@vibe-coded/server` | Run tests for a specific package only. |
| `turbo run build --filter=[main...HEAD]` | Build only packages changed since `main`. |
| `turbo run build --affected --base=origin/main` | Build changed packages and their dependents. |
| `turbo run build --dry=json` | Print the execution plan as JSON without running tasks. |
| `turbo devtools` | Open the visual Package/Task Graph explorer. |
| `npx create-turbo@latest` | Scaffold a new Turborepo. |
| `npx @turbo/codemod migrate` | Run the automated upgrade CLI. |

### `turbo.json` Task Config Reference

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],       // run deps' build first
      "outputs": ["dist/**"]          // cache these directories
    },
    "test": {
      "dependsOn": ["build"],         // run local build before test
      "outputs": ["coverage/**"]
    },
    "lint": {
      "dependsOn": []                 // no ordering needed
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

## Best Practices in This Project

- **Define `outputs` precisely.** Overly broad outputs (e.g. `"**"`) bloat the cache. Target only what downstream tasks consume — usually `dist/`, `build/`, `.svelte-kit/`.
- **Set `cache: false` on `dev` and any watch tasks.** These are always-running and should never be cached.
- **Use `--filter` in CI for affected package builds,** but rely on Turbo's own caching for full repo builds — the cache is usually faster than computing the diff.
- **Put shared config packages (ESLint config, TypeScript config) as `devDependencies`, not runtime deps.** They don't need build tasks; Turbo won't try to schedule them.
- **Use per-package `turbo.json` (Package Configurations)** if the `server` and `client` apps need different task behaviour — don't overload the root config with environment-specific overrides.
- **Add `.turbo/` to `.gitignore`.** It stores local task output metadata that shouldn't be committed.
- **Pin Turbo version** in the root `package.json` `devDependencies`. Turbo updates can change cache invalidation behaviour.

## References

- [Official Docs](https://turborepo.dev/docs)
- [Configuring Tasks](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks)
- [Running Tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks)
- [Turborepo 2.7 Release Notes](https://turborepo.dev/blog/turbo-2-7)
