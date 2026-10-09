# Architecture Decision Records

Short, plain decisions that live in the codebase. Each record states the decision, the alternatives not taken, and the consequences, with a pointer to the code that implements it.

## Index

1. [Colyseus owns rooms; game rules are Colyseus-free](0001-colyseus-room-ownership.md)
2. [One XState actor per room drives phases](0002-xstate-phase-machines.md)
3. [Zod validates every trust boundary](0003-zod-trust-boundaries.md)
4. [Seeded randomness and an action log make sessions replayable](0004-seeded-replay.md)
5. [Svelte 5 runes viewmodels hold UI logic; screens stay markup](0005-svelte-runes-viewmodels.md)
6. [Package layering enforces dependency direction](0006-package-layering.md)

## Rule

Never edit an ADR after acceptance, except to replace it with a new superseding record (mark the old one "Superseded"). Add new decisions as new records with the next number.

## Open questions for the maintainer

- **0001 (Colyseus):** Why Colyseus over other WebSocket hosts? Tradeoffs with custom protocols or other frameworks?
- **0002 (XState):** Why XState specifically? How was timer ownership (`duration` in the definition vs Colyseus clock) decided?
