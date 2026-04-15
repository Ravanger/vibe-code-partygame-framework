# Vitest Documentation

## Overview
Vitest is the primary test runner for the `vibe-coded` party game framework, used for both unit and integration tests across the monorepo packages.

## Key Concepts
- **Watch Mode:** Runs by default (`vitest`); reruns tests on file changes.
- **Run Mode:** Single-pass execution (`vitest run`); preferred for CI and non-interactive environments to prevent hanging.
- **Test Filters:** Support file paths, filenames, and line numbers (e.g., `vitest file.test.ts:10`).
- **Benchmark:** Specialized mode for performance testing (`vitest bench`).

## Common Commands
| Command | Description |
|----------|-------------|
| `vitest run` | Single test execution; recommended for automated workflows. |
| `vitest` or `vitest watch` | Watch mode for interactive development. |
| `vitest related [files]` | Run only tests related to specific source files. |
| `vitest list` | Print matching test names or files without running them. |
| `vitest init [name]` | Setup project configuration. |

## Best Practices in This Project
- **Always use `vitest run`** in automated environments (CI, scripts) or non-interactive terminals to ensure the process exits.
- Use `vitest related` with `--run` in git hooks or linting setups.
- Use file filters to isolate tests when debugging specific failures.

## References
- [Vitest Official Documentation](https://vitest.dev/)
