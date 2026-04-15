# Biome Documentation

> **Version:** v2.x (v2.0 released June 2025)

## Overview

Biome is the unified linter and formatter for `vibe-coded`, replacing the ESLint + Prettier combination with a single Rust-powered tool and one config file (`biome.json`). It lints and formats TypeScript, JavaScript, JSON, and CSS across all packages in the monorepo. With v2.0, Biome added type-aware linting (via its own inference engine — no `tsconfig` required), linter plugins, and a new "Assist" system for non-diagnostic code actions like import organisation.

## Key Concepts

- **Formatter:** Prettier-compatible output (97%+). Opinionated with few options — indent style/width, quote style, semicolons, line width, trailing commas.
- **Linter:** 479+ rules organised into groups: `correctness`, `suspicious`, `style`, `complexity`, `performance`, `security`, `a11y`. Rules starting with `use*` enforce something; rules starting with `no*` deny something.
- **Rule domains:** Biome auto-enables domain-specific rules when it detects matching `package.json` dependencies (e.g. test rules for Vitest, React rules for React projects).
- **Assist:** Non-diagnostic code actions (formerly "Import Organizer"). Handles import sorting, export sorting, and will expand to more actions. Not linter, not formatter — a third category.
- **Type-aware linting (v2):** Biome infers types without the TypeScript compiler. Opt-in via the file scanner (adds a slight startup cost). Catches issues like `noFloatingPromises` at ~85% of typescript-eslint coverage.
- **`biome-ignore` comment:** Inline suppression for specific rules on the next line.
- **VCS integration:** `--changed` / `--staged` flags process only files changed since last commit / staged files. Useful in pre-commit hooks.
- **`biome check`:** Runs formatter, linter, and assist together. The preferred all-in-one command for CI.

## Common Functions/Methods

| Command | Description |
|---|---|
| `biome check --write .` | Run all checks and apply safe fixes (format + lint). Primary CI command. |
| `biome format --write .` | Format files only. |
| `biome lint --write .` | Lint and apply safe fixes only. |
| `biome ci .` | Check all files; exits non-zero on any violation. Use in CI pipelines. |
| `biome init` | Scaffold a `biome.json` config file. |
| `biome migrate` | Migrate from ESLint/Prettier config to `biome.json`. |
| `// biome-ignore lint/suspicious/noConsoleLog: debug` | Inline suppression comment. Always include a reason. |

### Minimal `biome.json` for this project

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noConsoleLog": "warn"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "trailingCommas": "es5",
      "semicolons": "always"
    }
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  }
}
```

## Best Practices in This Project

- **Run `biome check --write` as the pre-commit hook**, not separate format and lint passes. One command, one config, no drift.
- **Add `biome ci` to the Turbo `lint` task** (with `cache: false` or inputs scoped to source files). It exits non-zero in CI on any violation.
- **Don't mix Biome with ESLint or Prettier** in the same package. If migrating, run `biome migrate` and commit the full reformat in a single chore commit before adding feature work.
- **Set `"recommended": true` and selectively override rules** rather than listing every rule manually. This keeps you on safe defaults and gains new rules on upgrades.
- **Use `biome-ignore` with a reason string.** The reason is machine-readable and helps audits. No silent suppressions.
- **Opt into type-aware linting gradually.** Enable the file scanner in `biome.json` and check performance. On large repos, consider scoping it to specific packages.
- **Scope `biome.json` per-package for per-package overrides** (e.g. relaxed rules in test files) using the `overrides` array. Don't duplicate the root config.
- **The Turborepo 2.7 `noUndeclaredEnvVars` Biome rule** is relevant here — enable it to catch env vars used in turbo tasks that aren't declared in `turbo.json` env inputs.

## References

- [Official Docs](https://biomejs.dev)
- [Linter Rules](https://biomejs.dev/linter/rules)
- [Configuration Reference](https://biomejs.dev/reference/configuration)
- [Biome v2 Release Notes](https://biomejs.dev/blog/biome-v2)
