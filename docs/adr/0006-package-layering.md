# ADR 0006: Package layering enforces dependency direction

**Status:** Proposed

## Context

A monorepo can become a tangle of cross-cutting imports if packages can import each other freely. Game code can leak into the framework; framework code can split across multiple packages.

## Decision

Dependency direction is layered and enforced:
- **Server side:** `games/* -> server -> core -> shared`. Core has no Colyseus; server bridges them. Games import only server for hosting.
- **Client side:** `games/* -> game-ui -> game-client -> shared`. UI viewmodels are generic; games plug in screens and options schemas.
- **Core and server are devDependencies for games** (they are for testing and launching, not at runtime).
- **No package imports `games/*`; no relative `../../games` paths anywhere.**
- **Game vocabulary** (phase names, prompts, actions) lives only in `games/`; framework packages are game-agnostic.

## Alternatives considered

- **Flat package graph:** Any package can import any other. Rejected because it makes refactoring, testing and onboarding harder.
- **Circular boundaries:** Let packages import as long as the cycle is small. Rejected because it hides dependencies and couples unrelated concerns.

## Consequences

A clean split between framework and game code. A new game author learns the framework by reading `packages/core`, `packages/shared` and their package READMEs. Refactoring framework code is low-risk because dependents are known. Import cycles are impossible. The boundary is checked by `check:boundaries` (turbo task) and enforced by the `biome` linter and `vitest` coverage bounds per package.

## Where it lives

- `packages/*/AGENTS.md` — per-package boundaries (what never goes in, allowed imports)
- `scripts/checkBoundaries.ts` — the enforcer (reads package READMEs and package.json, reports violations)
- `bun.lock` — workspace dependency declarations
- `docs/framework/README.md` — Dependency direction section

**Sources:** Code inspection, each package's `AGENTS.md`, `scripts/checkBoundaries.ts` (enforcement logic).
