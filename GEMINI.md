# Party Game Framework (vibe-coded)

> **Goal:** A flexible, modern, TypeScript-first framework for building immersive, multi-device social party games.
> **Status:** Initial Setup (Phase 0)

## Core Mandates

- **Terminology:** DO NOT mention "Jackbox" in any documentation, code, or communication.
- **TDD First:** NO production code without a failing test first. 100% coverage target for `core` and `shared`.
- **Modern Tech Stack:** Bun 1.1+, Colyseus 0.16, XState v5, Zod, Svelte 5, Vitest, Biome.
- **Strict Separation:** Clear boundaries between `core` (logic), `server` (multiplayer), and `client` (UI).
- **Security:** Zod validation for all inputs, rate limiting, and structured logging.
- **Horizontal Scalability:** Redis adapter pattern for multi-node support.
- **Documentation First:** All public-facing APIs MUST have clear, DX-friendly documentation (JSDoc, API reference site, usage examples) established BEFORE implementation. Documentation is a living design document.

## Project Structure (Monorepo)

- `packages/shared`: Validation schemas, types, and constants.
- `packages/core`: Pure TypeScript game engine logic and DSL (`defineGame`).
- `packages/server`: Colyseus room implementation and XState integration.
- `packages/client`: Svelte 5 SDK for game clients.
- `packages/cli`: Scaffolding tool for new games.
- `games/reference`: Canonical demo game (Quiplash-style).

## Development Workflow

1. **Research & Plan:** Use `writing-plans` to define tasks.
2. **TDD Cycle:** 
   - Write failing test (RED).
   - Verify failure.
   - Write minimal implementation (GREEN).
   - Verify pass.
   - Refactor.
3. **Commit:** Use conventional commits. (User will handle final commits).

## Tech Stack Details

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Multiplayer | Colyseus 0.16 |
| State Machine | XState v5 |
| Validation | Zod |
| Frontend | Svelte 5 (Runes) |
| Testing | Vitest + fast-check |
| Linting/Formatting | Biome |
| Logging | Pino |

## MVP Checklist

- [ ] Phase 0: Monorepo Scaffold & Tooling
- [ ] Phase 1: Core DSL (`defineGame`, `phase`, `action`)
- [ ] Phase 2: Server-side Room Logic & State Machine Sync
- [ ] Phase 3: Role-based State Visibility (StateView)
- [ ] Phase 4: Svelte 5 Client SDK
- [ ] Phase 5: Reference Game Implementation (Quiplash-style)
