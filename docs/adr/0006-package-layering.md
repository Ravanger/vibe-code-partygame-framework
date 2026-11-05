# ADR 0006: Package layering enforces dependency direction

**Status:** Accepted

## Context

A monorepo can become a tangle of cross-cutting imports if packages can import each other freely. Game code can leak into the framework; framework code can split across multiple packages.

## Decision

Dependency direction is layered and enforced:
- **Server side:** `games/* -> server -> core -> shared`. Core has no Colyseus; server bridges them. A game lists the framework packages it uses (`core`, `server`, `game-kit`, `bots`, `terminal` and others) as `dependencies`; only `@partygame/cli` is off limits to it.
- **Client side:** `games/* -> game-ui -> game-client -> shared`. UI viewmodels are generic; games plug in screens and options schemas. `core` and `server` are `devDependencies` of the client-side packages (`game-client`), there for tests only.
- **Supporting packages** (`client-utils`, `content`, `bots`, `terminal`, `launcher`, `game-kit`) each have a fixed list of allowed runtime and dev dependencies; the table is `LAYERS` in `scripts/checkBoundaries.ts`.
- **No package imports `games/*`; no relative `../../games` paths anywhere.**
- **Game vocabulary** (phase names, prompts, actions) lives only in `games/`; framework packages are game-agnostic.

## Alternatives considered

- **Flat package graph:** Any package can import any other. Rejected because it makes refactoring, testing and onboarding harder.
- **Circular boundaries:** Let packages import as long as the cycle is small. Rejected because it hides dependencies and couples unrelated concerns.

## Consequences

A clean split between framework and game code. A new game author learns the framework by reading `packages/core`, `packages/shared` and their package READMEs. Refactoring framework code is low-risk because dependents are known. Import cycles are impossible. The boundary is checked by `bun run check:boundaries`, a root script (`scripts/checkBoundariesCli.ts`), and enforced by the `biome` linter and `vitest` coverage bounds per package.

## Where it lives

- `packages/*/AGENTS.md` — per-package boundaries (what never goes in, allowed imports)
- `scripts/checkBoundaries.ts` — the enforcer (reads each `package.json` and the source imports, reports violations; the allowed layers are its `LAYERS` table)
- `bun.lock` — workspace dependency declarations
- `docs/framework/README.md` — Dependency direction section

**Sources:** Code inspection, each package's `AGENTS.md`, `scripts/checkBoundaries.ts` (enforcement logic).
