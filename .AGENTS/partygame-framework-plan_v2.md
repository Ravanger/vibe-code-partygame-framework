# Party Game Framework: Optimized Development Plan

> **Codename:** `partygame` (rename before publishing)  
> **Goal:** A flexible, modern, TypeScript-first framework for building Jackbox-style party games.  
> **Methodology:** Test-Driven Development (TDD) — red → green → refactor, at every phase.  
> **Audience for this doc:** Any developer (LLM or human) executing the plan step by step.

---

## Table of Contents

1. [Executive Summary of Optimizations](#1-executive-summary-of-optimizations)
2. [Research Summary](#2-research-summary)
3. [Architecture Overview](#3-architecture-overview)
4. [Stack Decision Guide](#4-stack-decision-guide)
5. [Monorepo Layout](#5-monorepo-layout)
6. [TDD Rules for This Project](#6-tdd-rules-for-this-project)
7. [Phase 0 — Foundations & Tooling](#phase-0--foundations--tooling)
8. [Phase 1 — Core Types & `defineGame` API](#phase-1--core-types--definegame-api)
9. [Phase 2 — Server Room & State Machine](#phase-2--server-room--state-machine)
10. [Phase 3 — Private State & Role Routing](#phase-3--private-state--role-routing)
11. [Phase 4 — Client SDK](#phase-4--client-sdk)
12. [Phase 5 — Reference Game (Quiplash-style)](#phase-5--reference-game-quiplash-style)
13. [Phase 6 — CLI & Scaffolding](#phase-6--cli--scaffolding)
14. [Phase 7 — Polish, Performance & Production](#phase-7--polish-performance--production)
15. [Phase 8 — Post-Launch (Optional)](#phase-8--post-launch-optional)
16. [Architectural Patterns Quick Reference](#architectural-patterns-quick-reference)
17. [Debugging & Common Pitfalls](#debugging--common-pitfalls)
18. [Risk Register](#risk-register)

---

## 1. Executive Summary of Optimizations

### Critical Improvements Made

| Area                 | Original            | Optimized                                | Impact                           |
| -------------------- | ------------------- | ---------------------------------------- | -------------------------------- |
| **Security**         | No input validation | Zod schemas for all inputs               | Prevents injection attacks       |
| **Scalability**      | Single-node only    | Redis adapter pattern                    | Horizontal scaling support       |
| **DX**               | Manual setup        | Dev container + GitHub Codespaces        | Onboarding time: 30min → 5min    |
| **Testing**          | Unit tests only     | Property-based + contract tests          | Catches edge cases automatically |
| **Observability**    | Console logs only   | Structured logging + OpenTelemetry       | Production debugging             |
| **State Management** | JSON strings        | Structured Schema with migrations        | Backward compatibility           |
| **CI/CD**            | Not specified       | GitHub Actions matrix + semantic release | Automated quality gates          |

### New Additions

1. **Phase 0.5: Development Environment** — Dev container, VS Code extensions, pre-commit hooks
2. **Phase 3.5: State Migration System** — For evolving game state schemas
3. **Phase 7.6: Security Hardening** — Rate limiting, input sanitization, audit logging
4. **Phase 8: Post-Launch** — Analytics, A/B testing framework, community plugins

---

## 2. Research Summary

### 2.1 Existing Jackbox-Specific Frameworks

All of these exist. None are production-grade or actively maintained:

| Name                         | Stack             | Status      | Notes                                                      |
| ---------------------------- | ----------------- | ----------- | ---------------------------------------------------------- |
| `hackbox` (tomalama)         | npm, Node         | Abandoned   | Closest to a real framework; phone+browser controllers     |
| `party-box` (hammre)         | Node, WebSocket   | Abandoned   | 3-component arch (broker, game, client) — good design      |
| `mulberry` (dane-johnson)    | Node, npm         | Abandoned   | "libre party platform", early-dev                          |
| `free-radish` (Daikon Games) | Node.js WebSocket | Partial OSS | Built in 7 days; bones of a server; Unity game side closed |
| Phoenix LiveView + Elixir    | Elixir            | Demo only   | One-person hackathon werewolf game                         |

**Verdict:** There is no maintained, general-purpose Jackbox framework. This is a greenfield project building on top of general multiplayer infrastructure.

### 2.2 General Multiplayer Frameworks (Relevant Primitives)

#### Colyseus (★★★★★ — Use This)

- **MIT licensed**, Node.js/Bun, actively developed (v0.16 — Feb 2025)
- Room-based matchmaking, binary delta state sync, reconnection support
- v0.16 introduced `StateView` — per-client state visibility control
- `@colyseus/bun-websockets` transport makes it native on Bun
- Built-in dev tools: Playground UI to inspect rooms & state live
- Scales horizontally; self-hostable or Colyseus Cloud
- **Gaps for Jackbox:** No role model, no phase state machine, no short room codes

#### XState v5 (★★★★★ — Use This)

- MIT licensed, zero dependencies
- State machines + statecharts + actor model
- `@xstate/svelte` and `@xstate/react` integrations
- Delayed transitions perfect for phase timers
- Visual debugging via Stately Studio

#### Additional Tools Added

| Tool                      | Purpose            | Why Added                                           |
| ------------------------- | ------------------ | --------------------------------------------------- |
| **Zod**                   | Runtime validation | Type-safe at runtime, not just compile-time         |
| **ioredis**               | Pub/sub adapter    | Horizontal scaling across multiple server instances |
| **Pino**                  | Structured logging | Production observability                            |
| **Helmet**                | Security headers   | OWASP compliance                                    |
| **Rate-limiter-flexible** | DDoS protection    | Production hardening                                |

### 2.3 HTTP / WebSocket Frameworks

#### Elysia (★★★★★ — Recommended for Bun-native DX)

- Bun-native, Eden Treaty for end-to-end types
- TypeBox validation (2–4× faster than Zod)
- **Enhancement:** Add `elysia-rate-limit` plugin

#### Hono (★★★★ — Portable Option)

- Runs on Bun, Node, Deno, Cloudflare Workers
- Use if portability matters over performance

### 2.4 Frontend Options

| Framework | Pros                                     | Cons               | Recommendation         |
| --------- | ---------------------------------------- | ------------------ | ---------------------- |
| Svelte 5  | Minimal boilerplate, runes, small bundle | Smaller ecosystem  | **Primary**            |
| React 19  | Massive ecosystem, familiar              | More boilerplate   | Optional package       |
| SolidJS   | Fastest DOM, fine-grained                | Smallest ecosystem | Community contribution |

### 2.5 Testing Strategy (Enhanced)

| Tool                | Use                    | Coverage Target          |
| ------------------- | ---------------------- | ------------------------ |
| `vitest`            | Unit + integration     | 100% core, 90% server    |
| `@colyseus/testing` | Room simulation        | All room lifecycles      |
| `@xstate/test`      | Model-based testing    | All state transitions    |
| `fast-check`        | Property-based testing | Edge case discovery      |
| `playwright`        | E2E browser tests      | Critical user paths      |
| `k6`                | Load testing           | 1000+ concurrent players |

---

## 3. Architecture Overview

### 3.1 The Jackbox Model (Enhanced)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GAME SESSION                                     │
│                                                                          │
│  ┌──────────────┐          ┌───────────────────┐     ┌──────────────┐    │
│  │  HOST SCREEN │          │  PLAYER PHONES    │     │  AUDIENCE    │    │
│  │  (TV / PC)   │  ◄──┐   │  (browsers)       │     │  (spectators)│    │
│  │              │     │   │                   │     │              │    │
│  │  Shows game  │     │   │  Per-player UI    │     │  Read-only   │    │
│  │  state +     │     │   │  text input       │     │  view        │    │
│  │  animations  │     │   │  drawing canvas   │     │              │    │
│  └──────────────┘     │   │  vote buttons     │     └──────────────┘    │
│                        │   └───────────────────┘                         │
│                        │                                                 │
│               ┌────────┴────────────────────────┐                        │
│               │         GAME SERVER              │                        │
│               │                                  │                        │
│               │  ┌──────────────────────────┐   │                        │
│               │  │   Colyseus Room          │   │                        │
│               │  │   + XState FSM           │   │                        │
│               │  │   + StateViews           │   │                        │
│               │  └──────────────────────────┘   │                        │
│               │                                  │                        │
│               │  ┌──────────────────────────┐   │  ┌──────────────┐      │
│               │  │   Redis Adapter (opt)    │◄──┼──┤   Other      │      │
│               │  │   (horizontal scaling)   │   │  │   Nodes      │      │
│               │  └──────────────────────────┘   │  └──────────────┘      │
│               │                                  │                        │
│               │  ┌──────────────────────────┐   │                        │
│               │  │   Structured Logger      │   │                        │
│               │  │   (Pino + OpenTelemetry) │   │                        │
│               │  └──────────────────────────┘   │                        │
│               └──────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Package Architecture (Enhanced)

```
packages/
│
├── core/                    @partygame/core
│   Purpose: Pure TypeScript types + DSL builders
│   Exports: defineGame(), phase(), action(), when(), timer(), zod schemas
│
├── server/                  @partygame/server
│   Purpose: Colyseus + XState integration
│   Exports: createGameServer(), GameRoom class, RedisAdapter
│
├── client/                  @partygame/client
│   Purpose: Svelte 5 stores + hooks
│   Exports: createGameClient(), useGameState(), useMyRole(), useSend()
│
├── client-react/            @partygame/client-react (Phase 7)
│   Purpose: React 19 hooks
│
├── cli/                     @partygame/cli
│   Purpose: `create-partygame` scaffold tool
│   Exports: npx create-partygame my-game
│
└── shared/                  @partygame/shared (NEW)
    Purpose: Validation schemas, types shared between client/server
    Exports: zod schemas, type guards, constants

games/
├── reference/               The canonical Quiplash-style demo
├── trivia/                  Second demo (flexibility proof)
└── stress-test/             Performance validation game (NEW)

docs/                        VitePress documentation
└── ...

infra/                       (NEW) Deployment configs
├── docker/
├── kubernetes/
└── terraform/
```

### 3.3 Data Flow (Enhanced with Validation)

```
Player phone action
      │
      ▼
┌─────────────────┐
│  Zod validation │  ← NEW: Runtime type safety
│  (input schema) │
└────────┬────────┘
         │
         ▼
client.send({ type: 'SUBMIT_ANSWER', answer: 'My funny answer' })
      │
      ▼ (WebSocket, binary encoded by Colyseus)
GameRoom.onMessage()  ← Colyseus
      │
      ▼
┌─────────────────┐
│  Rate limiting  │  ← NEW: DDoS protection
│  (per-client)   │
└────────┬────────┘
         │
         ▼
machine.send({ type: 'SUBMIT_ANSWER', clientId, answer })  ← XState
      │
      ▼
XState action handler mutates Colyseus Schema state
      │
      ▼ (binary delta broadcast, StateView filtered)
Each client receives only what they're allowed to see
      │
      ▼
Zod validation on client (defensive)  ← NEW
      │
      ▼
Svelte $state / React useState updates UI reactively
```

### 3.4 Game Phase State Machine (Enhanced)

```
               ┌──────────────────────────────────────────────────┐
               │                   GAME MACHINE                    │
               │                                                    │
    ┌──────────▼──────────┐                                         │
    │        LOBBY        │                                         │
    │  • players join     │                                         │
    │  • host starts      │ ──[HOST: startGame]──►                  │
    │  • validation       │                                         │
    └─────────────────────┘                                         │
                                                                    │
    ┌─────────────────────┐   all answered OR timer                │
    │     ANSWERING       │ ──────────────────────►                │
    │  • 90s timer        │                                         │
    │  • private answers  │                                         │
    │  • input validation │                                         │
    └─────────────────────┘                                         │
                                                                    │
    ┌─────────────────────┐   all voted OR timer                   │
    │      VOTING         │ ──────────────────────►                │
    │  • answers revealed │                                         │
    │  • vote validation  │                                         │
    │  • anti-cheat       │                                         │
    └─────────────────────┘                                         │
                                                                    │
    ┌─────────────────────┐   timer                                 │
    │      RESULTS        │ ──────────────────────► back to         │
    │  • scores shown     │                          ANSWERING      │
    │  • 10s display      │                          (next round)   │
    │  • leaderboard      │                    or ──► GAME_OVER     │
    └─────────────────────┘                                         │
                                                                    │
    ┌─────────────────────┐                                         │
    │     GAME_OVER       │                                         │
    │  • final scores     │                                         │
    │  • play again?      │ ──[HOST: playAgain]──► LOBBY            │
    └─────────────────────┘                                         │
               └────────────────────────────────────────────────────┘
```

---

## 4. Stack Decision Guide

### Option A — Bun-native Production Stack (Recommended)

| Layer              | Choice                    | Why                                    |
| ------------------ | ------------------------- | -------------------------------------- |
| Runtime            | **Bun 1.1+**              | Native TS, 1.2M concurrent connections |
| Multiplayer server | **Colyseus 0.16**         | StateView, binary sync, reconnection   |
| HTTP framework     | **Elysia**                | Eden Treaty, TypeBox validation        |
| State machine      | **XState v5**             | Actor model, delayed transitions       |
| Validation         | **Zod**                   | Runtime + compile-time safety          |
| Frontend           | **Svelte 5**              | Runes, minimal boilerplate             |
| Test runner        | **Vitest**                | TS-native, fast, Bun-compatible        |
| Property testing   | **fast-check**            | Edge case discovery                    |
| Monorepo           | **pnpm + Turborepo**      | Workspace linking, cached builds       |
| DB                 | **SQLite (Bun)**          | Zero-dep, fast                         |
| Caching            | **Redis**                 | Horizontal scaling, session store      |
| Linting            | **Biome**                 | 35× faster than ESLint + Prettier      |
| Logging            | **Pino**                  | Structured, OpenTelemetry support      |
| Security           | **Helmet + rate-limiter** | OWASP compliance                       |

### Option B — Node.js / Portable Stack

| Layer          | Choice           |
| -------------- | ---------------- |
| Runtime        | Node.js 22 LTS   |
| HTTP framework | Hono             |
| Frontend       | React 19         |
| Validation     | Zod              |
| Other          | Same as Option A |

---

## 5. Monorepo Layout

```
partygame/
├── .devcontainer/              (NEW) Dev container config
│   ├── devcontainer.json
│   └── Dockerfile
├── .github/
│   ├── workflows/              (NEW) CI/CD pipelines
│   │   ├── ci.yml
│   │   ├── release.yml
│   │   └── load-test.yml
│   └── CODEOWNERS
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── biome.json
├── tsconfig.base.json
├── .pre-commit-config.yaml     (NEW) Git hooks
│
├── packages/
│   ├── shared/                 (NEW) Shared validation schemas
│   │   ├── src/
│   │   │   ├── schemas/        # Zod schemas
│   │   │   ├── types/          # Shared TypeScript types
│   │   │   └── constants/
│   │   └── package.json
│   │
│   ├── core/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   ├── builders.ts
│   │   │   ├── machine.ts
│   │   │   └── validators.ts   (NEW) Input validation
│   │   └── tests/
│   │
│   ├── server/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── GameRoom.ts
│   │   │   ├── RoomCode.ts
│   │   │   ├── StateView.ts
│   │   │   ├── RateLimiter.ts  (NEW)
│   │   │   ├── Logger.ts       (NEW)
│   │   │   ├── RedisAdapter.ts (NEW)
│   │   │   ├── migrations/     (NEW) State migrations
│   │   │   └── schema/
│   │   └── tests/
│   │
│   ├── client/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── GameClient.ts
│   │   │   ├── stores.svelte.ts
│   │   │   └── validators.ts   (NEW)
│   │   └── tests/
│   │
│   └── cli/
│       └── src/
│
├── games/
│   ├── reference/
│   │   ├── server/
│   │   ├── client/
│   │   └── tests/
│   │       ├── unit/
│   │       ├── integration/
│   │       └── e2e/            (NEW)
│   │
│   └── stress-test/            (NEW)
│
├── docs/
│   ├── guide/
│   ├── api/
│   └── examples/
│
└── infra/                      (NEW)
    ├── docker/
    ├── k8s/
    └── terraform/
```

---

## 6. TDD Rules for This Project

### The Cycle (Repeat for Every Feature)

```
1. WRITE TEST   — describe what you want, in plain English first
2. RUN TEST     — it must FAIL (red)
3. WRITE CODE   — minimum code to make test pass
4. RUN TEST     — it must PASS (green)
5. REFACTOR     — clean up, run tests again
6. PROPERTY TEST — (NEW) add fast-check tests for edge cases
7. COMMIT       — git commit with conventional commit message
```

### Test File Conventions

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { fc, it as itProp } from "fast-check" // NEW: Property testing

describe("<FeatureName>", () => {
  describe("<SubFeature>", () => {
    // Unit test
    it("<does something specific in plain english>", () => {
      // Arrange
      // Act
      // Assert
    })

    // Property test (NEW)
    itProp("<property description>", [fc.string()], (input) => {
      // Property: for ALL strings, this should hold
    })
  })
})
```

### Coverage Targets (Enhanced)

| Package        | Target | Notes                             |
| -------------- | ------ | --------------------------------- |
| `core`         | 100%   | Pure logic, no excuses            |
| `shared`       | 100%   | Validation schemas                |
| `server`       | 90%+   | Room lifecycle, state transitions |
| `client`       | 70%+   | Focus on state sync               |
| Reference game | E2E    | Happy path + edge cases           |

---

## Phase 0 — Foundations & Tooling

**Goal:** Working monorepo with CI, linting, dev environment, and passing tests.

**Checkpoint:** `pnpm test` passes. `pnpm build` produces artifacts. Dev container works.

---

### Step 0.1 — Create the monorepo

```bash
mkdir partygame && cd partygame
git init
pnpm init
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
  - "games/*"
```

Create root `package.json`:

```json
{
  "name": "partygame",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "test:ci": "turbo test:ci",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "turbo typecheck",
    "dev": "turbo dev",
    "changeset": "changeset",
    "release": "changeset publish"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@changesets/cli": "^2.27.0",
    "turbo": "^2.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "bun": ">=1.1.0"
  }
}
```

---

### Step 0.2 — Turbo config (Enhanced)

Create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".svelte-kit/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "cache": false
    },
    "test:ci": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

### Step 0.3 — Base TypeScript config (Enhanced)

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "lib": ["ES2022", "DOM"],
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

---

### Step 0.4 — Biome config (Enhanced)

Create `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "style": {
        "useConst": "error",
        "useTemplate": "error"
      },
      "suspicious": {
        "noConsoleLog": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  }
}
```

---

### Step 0.5 — Create package scaffolds

For each package (`shared`, `core`, `server`, `client`, `cli`):

```bash
mkdir -p packages/shared/src packages/shared/tests
```

Create `packages/shared/package.json`:

```json
{
  "name": "@partygame/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./schemas": {
      "import": "./dist/schemas/index.js",
      "types": "./dist/schemas/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:ci": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "*",
    "typescript": "*",
    "@vitest/coverage-v8": "^2.0.0"
  }
}
```

---

### Step 0.6 — Write shared validation schemas (NEW)

Create `packages/shared/src/schemas/index.ts`:

```typescript
import { z } from "zod"

// Player role validation
export const PlayerRoleSchema = z.enum(["host", "player", "audience"])
export type PlayerRole = z.infer<typeof PlayerRoleSchema>

// Room code validation
export const RoomCodeSchema = z.string().regex(/^[A-Z]{4}$/)

// Player name validation
export const PlayerNameSchema = z
  .string()
  .min(1, "Name is required")
  .max(20, "Name too long")
  .regex(/^[\w\s-]+$/, "Invalid characters in name")

// Action payload validation
export const ActionPayloadSchema = z.record(z.unknown()).default({})

// Game action validation
export const GameActionSchema = z.object({
  name: z.string(),
  data: ActionPayloadSchema,
})

// Connection options
export const ConnectOptionsSchema = z.object({
  roomName: z.string(),
  roomCode: RoomCodeSchema.optional(),
  playerName: PlayerNameSchema.optional(),
  asAudience: z.boolean().default(false),
})

// Answer validation (for reference game)
export const AnswerSchema = z
  .string()
  .min(1, "Answer is required")
  .max(200, "Answer too long")
  .transform((s) => s.trim())
```

---

### Step 0.7 — Dev container setup (NEW)

Create `.devcontainer/devcontainer.json`:

```json
{
  "name": "Party Game Framework",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:20",
  "features": {
    "ghcr.io/shyim/devcontainers-features/bun:0": {}
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "biomejs.biome",
        "bradlc.vscode-tailwindcss",
        "svelte.svelte-vscode"
      ]
    }
  },
  "postCreateCommand": "pnpm install",
  "forwardPorts": [2567, 5173]
}
```

---

### Step 0.8 — GitHub Actions CI (NEW)

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]
        runtime: [node, bun]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - name: Setup ${{ matrix.runtime }}
        uses: actions/setup-node@v4
        if: matrix.runtime == 'node'
        with:
          node-version: ${{ matrix.node-version }}
      - uses: oven-sh/setup-bun@v2
        if: matrix.runtime == 'bun'
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test:ci
      - uses: codecov/codecov-action@v4
        if: matrix.runtime == 'node' && matrix.node-version == 20
```

---

### ✅ Phase 0 Checkpoint

- [ ] `pnpm install` succeeds
- [ ] `pnpm test` passes in all packages
- [ ] `pnpm build` compiles TypeScript
- [ ] Biome lint passes
- [ ] Dev container builds successfully
- [ ] CI passes on PR
- [ ] Git commit: `chore: monorepo scaffold with CI`

---

## Phase 1 — Core Types & `defineGame` API

**Goal:** Define the framework's type system and DSL with runtime validation.

**Checkpoint:** `@partygame/core` fully typed, tested, and validated.

---

### Step 1.1 — Write type tests FIRST (Enhanced with Zod)

Create `packages/core/tests/builders.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { fc, it as itProp } from "fast-check"
import { defineGame, phase, action, when, timer } from "../src/index.js"

describe("defineGame()", () => {
  it("returns a GameDefinition with the provided name", () => {
    const def = defineGame({
      name: "my-game",
      minPlayers: 2,
      maxPlayers: 8,
      phases: {},
    })
    expect(def.name).toBe("my-game")
  })

  it("sets default minPlayers to 2 if not provided", () => {
    const def = defineGame({
      name: "game",
      maxPlayers: 8,
      phases: {},
    })
    expect(def.minPlayers).toBe(2)
  })

  it("rejects maxPlayers < minPlayers at runtime", () => {
    expect(() =>
      defineGame({ name: "bad", minPlayers: 8, maxPlayers: 3, phases: {} }),
    ).toThrowError(/maxPlayers must be >= minPlayers/)
  })

  // NEW: Property test
  itProp(
    "always creates valid game with valid inputs",
    [
      fc.string({ minLength: 1 }),
      fc.integer({ min: 2, max: 20 }),
      fc.integer({ min: 2, max: 20 }),
    ],
    (name, minP, maxP) => {
      const maxPlayers = Math.max(minP, maxP)
      const minPlayers = Math.min(minP, maxP)
      const def = defineGame({ name, minPlayers, maxPlayers, phases: {} })
      expect(def.name).toBe(name)
      expect(def.minPlayers).toBe(minPlayers)
      expect(def.maxPlayers).toBe(maxPlayers)
    },
  )
})

describe("phase()", () => {
  it("returns a PhaseDefinition with the correct name", () => {
    const p = phase({ actions: {} })
    expect(p).toMatchObject({ actions: {} })
  })

  it("stores duration when provided", () => {
    const p = phase({ duration: 30_000, actions: {} })
    expect(p.duration).toBe(30_000)
  })

  it("duration defaults to undefined (no timer)", () => {
    const p = phase({ actions: {} })
    expect(p.duration).toBeUndefined()
  })

  // NEW: Validation test
  it("rejects negative duration", () => {
    expect(() => phase({ duration: -1000, actions: {} })).toThrowError(
      /duration must be non-negative/,
    )
  })
})

describe("action()", () => {
  it("creates a player action by default", () => {
    const a = action({ handler: () => {} })
    expect(a.from).toBe("player")
  })

  it('allows "host" as sender', () => {
    const a = action({ from: "host", handler: () => {} })
    expect(a.from).toBe("host")
  })

  it("validates payload with zod schema when provided", () => {
    const schema = z.object({ answer: z.string() })
    const a = action({
      handler: () => {},
      validate: schema,
    })
    expect(a.validate).toBe(schema)
  })
})
```

---

### Step 1.2 — Write enhanced `types.ts`

Create `packages/core/src/types.ts`:

```typescript
import type { ZodSchema } from "zod"

// ─── Roles ─────────────────────────────────────────────────────────────────

export type PlayerRole = "host" | "player" | "audience"

// ─── Validation ─────────────────────────────────────────────────────────────

export interface ValidationResult {
  success: boolean
  errors?: string[]
}

// ─── Action Definition ──────────────────────────────────────────────────────

export interface ActionDefinition<TState = unknown, TPayload = unknown> {
  /** Who can trigger this action */
  from: PlayerRole
  /** Whether the action payload is private until phase ends */
  private?: boolean
  /** Zod schema for runtime validation (NEW) */
  validate?: ZodSchema<TPayload>
  /** Handler function */
  handler: (ctx: ActionContext<TState, TPayload>) => void | ValidationResult
}

export interface ActionContext<TState, TPayload> {
  state: TState
  clientId: string
  role: PlayerRole
  data: TPayload
  /** Timestamp of action (NEW) */
  timestamp: number
}

// ─── Transitions ────────────────────────────────────────────────────────────

export interface GuardedTransition<TState = unknown> {
  guard: (ctx: GuardContext<TState>) => boolean
  orTimeout: boolean
  /** Priority for transition ordering (NEW) */
  priority?: number
}

export interface GuardContext<TState> {
  state: TState
  players: PlayerInfo[]
  phase: string
  /** Phase start timestamp (NEW) */
  phaseStartTime: number
}

export interface PlayerInfo {
  id: string
  role: PlayerRole
  name: string
  connected: boolean
  /** Join timestamp (NEW) */
  joinedAt: number
}

// ─── Phase Definition ───────────────────────────────────────────────────────

export interface PhaseDefinition<TState = unknown> {
  /** Duration in ms before auto-transitioning. undefined = no timer. */
  duration?: number
  /** Actions available in this phase */
  actions: Record<string, ActionDefinition<TState>>
  /** Called when entering phase */
  onEnter?: (ctx: PhaseEnterContext<TState>) => void
  /** Called when exiting phase */
  onExit?: (ctx: PhaseExitContext<TState>) => void
  /** Phase transition guards */
  transitions?: Record<string, GuardedTransition<TState>>
  /** Can players join during this phase? (NEW) */
  allowJoin?: boolean
}

export interface PhaseEnterContext<TState> {
  state: TState
  players: PlayerInfo[]
  previousPhase?: string
}

export type PhaseExitContext<TState> = PhaseEnterContext<TState>

// ─── Game Definition ────────────────────────────────────────────────────────

export interface GameDefinition<TState = unknown> {
  name: string
  minPlayers: number
  maxPlayers: number
  initialState: () => TState
  phases: Record<string, PhaseDefinition<TState>>
  initialPhase?: string
  /** State version for migrations (NEW) */
  version?: number
  /** Migration functions (NEW) */
  migrations?: Record<number, (state: unknown) => TState>
}
```

---

### Step 1.3 — Write enhanced `builders.ts`

Create `packages/core/src/builders.ts`:

```typescript
import type { ZodSchema } from "zod"
import type {
  ActionDefinition,
  GameDefinition,
  GuardedTransition,
  PhaseDefinition,
  PlayerRole,
} from "./types.js"

// ─── Validation helpers ─────────────────────────────────────────────────────

const MAX_DURATION = 24 * 60 * 60 * 1000 // 24 hours
const MAX_PLAYERS = 1000

// ─── defineGame ─────────────────────────────────────────────────────────────

export function defineGame<TState>(
  config: Omit<GameDefinition<TState>, "minPlayers"> & { minPlayers?: number },
): GameDefinition<TState> {
  const minPlayers = Math.max(1, config.minPlayers ?? 2)
  const maxPlayers = Math.min(MAX_PLAYERS, config.maxPlayers)

  if (maxPlayers < minPlayers) {
    throw new Error(
      `maxPlayers must be >= minPlayers (got ${maxPlayers} < ${minPlayers})`,
    )
  }

  if (minPlayers > 100) {
    throw new Error(`minPlayers seems unreasonably high: ${minPlayers}`)
  }

  const phases = config.phases
  const phaseNames = Object.keys(phases)
  const initialPhase = config.initialPhase ?? phaseNames[0]

  if (!initialPhase || !phases[initialPhase]) {
    throw new Error(`initialPhase "${initialPhase}" not found in phases`)
  }

  // Validate phase durations
  for (const [name, phase] of Object.entries(phases)) {
    if (phase.duration !== undefined) {
      if (phase.duration < 0) {
        throw new Error(`Phase "${name}" has negative duration`)
      }
      if (phase.duration > MAX_DURATION) {
        throw new Error(`Phase "${name}" duration exceeds maximum (24h)`)
      }
    }
  }

  return {
    ...config,
    minPlayers,
    maxPlayers,
    version: config.version ?? 1,
    initialPhase,
    initialState: config.initialState ?? (() => ({}) as TState),
  }
}

// ─── phase ──────────────────────────────────────────────────────────────────

export function phase<TState>(
  config: PhaseDefinition<TState>,
): PhaseDefinition<TState> {
  if (config.duration !== undefined && config.duration < 0) {
    throw new Error("duration must be non-negative")
  }
  return { allowJoin: false, ...config }
}

// ─── action ─────────────────────────────────────────────────────────────────

export function action<TState, TPayload = unknown>(
  config: Omit<ActionDefinition<TState, TPayload>, "from"> & {
    from?: PlayerRole
    validate?: ZodSchema<TPayload>
  },
): ActionDefinition<TState, TPayload> {
  return {
    from: "player",
    ...config,
  }
}

// ─── when ───────────────────────────────────────────────────────────────────

export function when<TState>(
  guard: GuardedTransition<TState>["guard"],
  modifier?: "or-timeout",
  priority?: number,
): GuardedTransition<TState> {
  return {
    guard,
    orTimeout: modifier === "or-timeout",
    priority: priority ?? 0,
  }
}

// ─── timer ──────────────────────────────────────────────────────────────────

export function timer<TState>(
  durationMs: number,
  targetPhase: string,
): GuardedTransition<TState> {
  return {
    guard: () => false, // Timer-only transition
    orTimeout: true,
    priority: -1,
  }
}
```

---

### Step 1.4 — Implement `machine.ts` (Enhanced)

Create `packages/core/src/machine.ts`:

```typescript
import { assign, createMachine, type StateMachine } from "xstate"
import type { GameDefinition, PlayerInfo } from "./types.js"

interface MachineContext<TState> {
  gameState: TState
  players: PlayerInfo[]
  currentPhase: string
  phaseStartTime: number
}

type MachineEvent<TState> =
  | {
      type: "ACTION"
      phase: string
      name: string
      clientId: string
      role: "host" | "player" | "audience"
      data: unknown
      timestamp: number
    }
  | { type: "PLAYER_JOIN"; player: PlayerInfo }
  | { type: "PLAYER_LEAVE"; playerId: string }
  | { type: "TIMER_EXPIRED" }

export function buildXStateMachine<TState>(
  def: GameDefinition<TState>,
): StateMachine<MachineContext<TState>, any, MachineEvent<TState>> {
  const phaseEntries = Object.entries(def.phases)
  const states: Record<string, unknown> = {}

  for (const [phaseName, phaseDef] of phaseEntries) {
    const on: Record<string, unknown> = {}

    // Handle ACTION events
    on["ACTION"] = [
      {
        guard: ({
          context,
          event,
        }: {
          context: MachineContext<TState>
          event: MachineEvent<TState>
        }) => {
          if (event.type !== "ACTION") return false
          if (event.phase !== phaseName) return false

          const actionDef = phaseDef.actions[event.name]
          if (!actionDef) return false

          // Role check
          if (actionDef.from === "host" && event.role !== "host") return false
          if (actionDef.from === "audience" && event.role !== "audience")
            return false
          // 'player' allows host too (host can do player actions)

          return true
        },
        actions: assign(
          ({
            context,
            event,
          }: {
            context: MachineContext<TState>
            event: MachineEvent<TState>
          }) => {
            if (event.type !== "ACTION") return context
            const actionDef = phaseDef.actions[event.name]
            if (!actionDef) return context

            // Validate payload if schema provided
            if (actionDef.validate) {
              const result = actionDef.validate.safeParse(event.data)
              if (!result.success) {
                // Log validation error but don't throw
                console.warn(
                  `Action ${event.name} validation failed:`,
                  result.error,
                )
                return context
              }
            }

            const newGameState = structuredClone(context.gameState) as TState
            actionDef.handler({
              state: newGameState,
              clientId: event.clientId,
              role: event.role,
              data: event.data,
              timestamp: event.timestamp,
            })

            // Check transitions
            let nextPhase: string | undefined
            if (phaseDef.transitions) {
              const sortedTransitions = Object.entries(
                phaseDef.transitions,
              ).sort((a, b) => (b[1].priority ?? 0) - (a[1].priority ?? 0))

              for (const [transName, transition] of sortedTransitions) {
                if (
                  transition.guard({
                    state: newGameState,
                    players: context.players,
                    phase: phaseName,
                    phaseStartTime: context.phaseStartTime,
                  })
                ) {
                  nextPhase = transName.replace(/^to/, "")
                  nextPhase =
                    nextPhase.charAt(0).toLowerCase() + nextPhase.slice(1)
                  break
                }
              }
            }

            return {
              gameState: newGameState,
              currentPhase: nextPhase ?? context.currentPhase,
              phaseStartTime: nextPhase ? Date.now() : context.phaseStartTime,
            }
          },
        ),
      },
    ]

    // Handle PLAYER_JOIN
    on["PLAYER_JOIN"] = {
      actions: assign(
        ({
          context,
          event,
        }: {
          context: MachineContext<TState>
          event: MachineEvent<TState>
        }) => {
          if (event.type !== "PLAYER_JOIN") return context
          return { players: [...context.players, event.player] }
        },
      ),
    }

    // Handle PLAYER_LEAVE
    on["PLAYER_LEAVE"] = {
      actions: assign(
        ({
          context,
          event,
        }: {
          context: MachineContext<TState>
          event: MachineEvent<TState>
        }) => {
          if (event.type !== "PLAYER_LEAVE") return context
          return {
            players: context.players.filter((p) => p.id !== event.playerId),
          }
        },
      ),
    }

    // Build timed transitions
    const after: Record<string, unknown> = {}
    if (phaseDef.duration !== undefined) {
      const timedTransitions = Object.entries(
        phaseDef.transitions ?? {},
      ).filter(([, t]) => t.orTimeout)

      if (timedTransitions.length > 0) {
        const [transName] = timedTransitions[0]!
        const targetPhase = transName.replace(/^to/, "")
        const targetPhaseName =
          targetPhase.charAt(0).toLowerCase() + targetPhase.slice(1)
        after[phaseDef.duration] = {
          target: targetPhaseName,
          actions: assign({ phaseStartTime: Date.now() }),
        }
      }
    }

    states[phaseName] = {
      on,
      ...(Object.keys(after).length > 0 ? { after } : {}),
      entry: phaseDef.onEnter
        ? assign(({ context }: { context: MachineContext<TState> }) => {
            phaseDef.onEnter!({
              state: context.gameState,
              players: context.players,
              previousPhase: context.currentPhase,
            })
            return { phaseStartTime: Date.now() }
          })
        : undefined,
    }
  }

  return createMachine({
    id: def.name,
    initial: def.initialPhase ?? phaseEntries[0]?.[0] ?? "lobby",
    context: (): MachineContext<TState> => ({
      gameState: def.initialState(),
      players: [],
      currentPhase: def.initialPhase ?? phaseEntries[0]?.[0] ?? "lobby",
      phaseStartTime: Date.now(),
    }),
    states,
  })
}
```

---

### ✅ Phase 1 Checkpoint

- [ ] `pnpm test` green in `packages/core`
- [ ] `pnpm build` succeeds
- [ ] Property tests pass (fast-check)
- [ ] Input validation works (Zod)
- [ ] Git commit: `feat(core): defineGame API with validation`

---

## Phase 2 — Server Room & State Machine

**Goal:** Working Colyseus room with rate limiting, logging, and horizontal scaling support.

---

### Step 2.1 — Install dependencies (Enhanced)

```bash
cd packages/server
pnpm add colyseus @colyseus/core @colyseus/bun-websockets @colyseus/schema
pnpm add @partygame/core @partygame/shared xstate zod
pnpm add pino helmet rate-limiter-flexible
pnpm add -D @colyseus/testing vitest typescript @types/node
```

---

### Step 2.2 — Create RateLimiter (NEW)

Create `packages/server/src/RateLimiter.ts`:

```typescript
import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible"
import type { Redis } from "ioredis"

export interface RateLimitConfig {
  points: number // Number of actions
  duration: number // Per seconds
  blockDuration?: number
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  action: { points: 30, duration: 10 }, // 30 actions per 10s
  join: { points: 5, duration: 60 }, // 5 joins per minute
  message: { points: 100, duration: 10 }, // 100 messages per 10s
}

export class RateLimiter {
  private limiters: Map<string, RateLimiterMemory | RateLimiterRedis>

  constructor(redis?: Redis) {
    this.limiters = new Map()

    for (const [key, config] of Object.entries(DEFAULT_LIMITS)) {
      this.limiters.set(
        key,
        redis
          ? new RateLimiterRedis({ storeClient: redis, ...config })
          : new RateLimiterMemory(config),
      )
    }
  }

  async consume(type: string, key: string, points = 1): Promise<boolean> {
    const limiter = this.limiters.get(type)
    if (!limiter) return true

    try {
      await limiter.consume(key, points)
      return true
    } catch {
      return false
    }
  }
}
```

---

### Step 2.3 — Create Logger (NEW)

Create `packages/server/src/Logger.ts`:

```typescript
import pino from "pino"

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty" }
      : undefined,
  base: {
    service: "partygame-server",
    version: process.env.npm_package_version,
  },
})

export function createRoomLogger(roomCode: string) {
  return logger.child({ roomCode })
}
```

---

### Step 2.4 — Implement enhanced `GameRoom.ts`

Create `packages/server/src/GameRoom.ts`:

```typescript
import { Room, type Client } from "colyseus"
import { createActor, type AnyActorRef } from "xstate"
import { StateView } from "@colyseus/schema"
import type { GameDefinition, PlayerInfo } from "@partygame/core"
import { buildXStateMachine } from "@partygame/core"
import { PlayerNameSchema } from "@partygame/shared"
import { generateRoomCode } from "./RoomCode.js"
import { GameStateSchema } from "./schema/GameStateSchema.js"
import { PlayerSchema } from "./schema/PlayerSchema.js"
import { RateLimiter } from "./RateLimiter.js"
import { createRoomLogger } from "./Logger.js"
import type { Logger } from "pino"

export interface GameRoomOptions {
  redis?: any // ioredis instance for rate limiting
}

export class GameRoom<TState = unknown> extends Room<GameStateSchema> {
  private machine!: AnyActorRef
  private gameDefinition!: GameDefinition<TState>
  private rateLimiter!: RateLimiter
  private logger!: Logger

  setDefinition(def: GameDefinition<TState>) {
    this.gameDefinition = def
  }

  onCreate(options: GameRoomOptions = {}) {
    this.setState(new GameStateSchema())

    this.state.roomCode = generateRoomCode()
    this.roomId = this.state.roomCode
    this.maxClients = this.gameDefinition.maxPlayers + 10 // +10 for audience

    this.rateLimiter = new RateLimiter(options.redis)
    this.logger = createRoomLogger(this.state.roomCode)

    this.logger.info(
      { maxPlayers: this.gameDefinition.maxPlayers },
      "Room created",
    )

    const xstateMachine = buildXStateMachine(this.gameDefinition)
    this.machine = createActor(xstateMachine)

    this.machine.subscribe((snapshot) => {
      const ctx = snapshot.context as {
        currentPhase: string
        gameState: TState
      }
      const prevPhase = this.state.phase
      this.state.phase = ctx.currentPhase
      this.state.publicData = JSON.stringify(ctx.gameState)

      if (prevPhase !== ctx.currentPhase) {
        this.logger.info(
          { from: prevPhase, to: ctx.currentPhase },
          "Phase transition",
        )
        this.broadcast("PHASE_CHANGE", { phase: ctx.currentPhase })
      }
    })

    this.machine.start()

    this.onMessage(
      "ACTION",
      async (client, message: { name: string; data: unknown }) => {
        // Rate limit check
        const allowed = await this.rateLimiter.consume(
          "action",
          client.sessionId,
        )
        if (!allowed) {
          this.logger.warn(
            { clientId: client.sessionId },
            "Rate limit exceeded",
          )
          client.send("ERROR", {
            code: "RATE_LIMITED",
            message: "Too many actions",
          })
          return
        }

        const player = this.state.players.get(client.sessionId)
        if (!player) return

        this.machine.send({
          type: "ACTION",
          phase: this.state.phase,
          name: message.name,
          clientId: client.sessionId,
          role: player.role as "host" | "player" | "audience",
          data: message.data,
          timestamp: Date.now(),
        })
      },
    )
  }

  async onJoin(
    client: Client,
    options?: { name?: string; asAudience?: boolean },
  ) {
    // Rate limit joins
    const allowed = await this.rateLimiter.consume("join", client.sessionId)
    if (!allowed) {
      throw new Error("Join rate limit exceeded")
    }

    const isFirst = this.state.players.size === 0
    const wantsAudience = options?.asAudience ?? false

    // Validate name
    const nameResult = PlayerNameSchema.safeParse(options?.name)
    const playerName = nameResult.success
      ? nameResult.data
      : `Player ${this.state.players.size + 1}`

    const player = new PlayerSchema()
    player.sessionId = client.sessionId
    player.name = playerName
    player.role = isFirst ? "host" : wantsAudience ? "audience" : "player"
    player.connected = true
    player.joinedAt = Date.now()

    this.state.players.set(client.sessionId, player)

    // Configure StateView
    client.view = new StateView()
    this.state.players.forEach((p) => {
      client.view!.add(p)
    })
    client.view.add(player, 1) // Private view

    this.machine.send({
      type: "PLAYER_JOIN",
      player: {
        id: client.sessionId,
        role: player.role as "host" | "player" | "audience",
        name: player.name,
        connected: true,
        joinedAt: player.joinedAt,
      },
    })

    this.logger.info(
      {
        clientId: client.sessionId,
        role: player.role,
        name: player.name,
      },
      "Player joined",
    )
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId)
    if (!player) return

    this.logger.info(
      {
        clientId: client.sessionId,
        consented,
      },
      "Player leaving",
    )

    if (!consented) {
      player.connected = false
      try {
        await this.allowReconnection(client, 30)
        player.connected = true
        this.logger.info({ clientId: client.sessionId }, "Player reconnected")
      } catch {
        this.state.players.delete(client.sessionId)
        this.machine.send({ type: "PLAYER_LEAVE", playerId: client.sessionId })
        this.logger.info(
          { clientId: client.sessionId },
          "Reconnect window expired",
        )
      }
    } else {
      this.state.players.delete(client.sessionId)
      this.machine.send({ type: "PLAYER_LEAVE", playerId: client.sessionId })
    }
  }

  onDispose() {
    this.logger.info("Room disposed")
    this.machine.stop()
  }
}
```

---

### ✅ Phase 2 Checkpoint

- [ ] Rate limiting works
- [ ] Structured logging in place
- [ ] Input validation on join
- [ ] Reconnection works
- [ ] Git commit: `feat(server): GameRoom with rate limiting and logging`

---

## Phase 3 — Private State & Role Routing

**Goal:** Players see only what they're supposed to see. Enhanced with proper testing.

---

### Step 3.1 — Enhanced private state tests

Create `packages/server/tests/PrivateState.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest"
import { ColyseusTestServer, boot } from "@colyseus/testing"
import { defineGame, phase, action } from "@partygame/core"
import { createGameRoom } from "../src/index.js"

const privateGame = defineGame({
  name: "private-test",
  maxPlayers: 4,
  initialState: () => ({
    prompts: {} as Record<string, string>,
    answers: {} as Record<string, string>,
  }),
  phases: {
    answering: phase({
      onEnter: ({ state, players }) => {
        players.forEach((p, i) => {
          ;(state as { prompts: Record<string, string> }).prompts[p.id] =
            `Prompt ${i + 1}`
        })
      },
      actions: {
        submitAnswer: action({
          private: true,
          validate: z.object({ answer: z.string().min(1).max(200) }),
          handler: ({ state, clientId, data }) => {
            ;(state as { answers: Record<string, string> }).answers[clientId] =
              (data as { answer: string }).answer
          },
        }),
      },
    }),
  },
})

describe("Private state (StateView)", () => {
  let server: ColyseusTestServer

  beforeAll(async () => {
    server = await boot({
      rooms: { "private-test": createGameRoom(privateGame) },
    })
  })

  afterAll(() => server.shutdown())
  afterEach(() => server.cleanup())

  it("each player receives their own private prompt", async () => {
    const room = await server.createRoom("private-test")
    const p1 = await server.connectTo(room)
    const p2 = await server.connectTo(room)

    room.state.phase = "answering"
    const state = JSON.parse(room.state.publicData) as {
      prompts: Record<string, string>
    }
    const prompts = Object.values(state.prompts)
    expect(new Set(prompts).size).toBe(prompts.length)
  })

  it("rejects invalid answer payload", async () => {
    const room = await server.createRoom("private-test")
    const p1 = await server.connectTo(room)

    room.state.phase = "answering"
    p1.send("ACTION", { name: "submitAnswer", data: { answer: "" } })
    await new Promise((r) => setTimeout(r, 50))

    // Answer should not be stored (validation failed)
    const state = JSON.parse(room.state.publicData) as {
      answers: Record<string, string>
    }
    expect(Object.keys(state.answers)).toHaveLength(0)
  })
})
```

---

### ✅ Phase 3 Checkpoint

- [ ] Private state tests pass
- [ ] Input validation rejects bad payloads
- [ ] Git commit: `feat(server): private state with validation`

---

## Phase 3.5 — State Migration System (NEW)

**Goal:** Allow game state schemas to evolve without breaking existing games.

---

### Step 3.5.1 — Migration tests

Create `packages/server/tests/Migration.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { migrateState } from "../src/migrations/index.js"

describe("State migrations", () => {
  it("migrates v1 state to v2", () => {
    const v1State = { players: [], score: 100 }
    const v2State = migrateState(v1State, 1, 2)
    expect(v2State).toHaveProperty("players")
    expect(v2State).toHaveProperty("scores") // renamed from score
    expect(v2State).toHaveProperty("version", 2)
  })

  it("returns same state if versions match", () => {
    const state = { version: 3, data: "test" }
    const result = migrateState(state, 3, 3)
    expect(result).toEqual(state)
  })
})
```

---

### Step 3.5.2 — Migration implementation

Create `packages/server/src/migrations/index.ts`:

```typescript
export type Migration = (state: unknown) => unknown

const migrations: Record<number, Migration> = {
  1: (state) => state, // Initial version
  2: (state) => ({
    ...(state as object),
    scores: (state as { score?: number }).score ?? 0,
    version: 2,
  }),
  // Add more migrations as needed
}

export function migrateState(
  state: unknown,
  fromVersion: number,
  toVersion: number,
): unknown {
  if (fromVersion === toVersion) return state

  let currentState = state
  for (let v = fromVersion + 1; v <= toVersion; v++) {
    const migration = migrations[v]
    if (!migration) {
      throw new Error(`No migration found for version ${v}`)
    }
    currentState = migration(currentState)
  }

  return currentState
}
```

---

### ✅ Phase 3.5 Checkpoint

- [ ] Migration tests pass
- [ ] Migration system documented
- [ ] Git commit: `feat(server): state migration system`

---

## Phase 4 — Client SDK

**Goal:** Lightweight Svelte 5 client with validation and error handling.

---

### Step 4.1 — Enhanced GameClient with error handling

Create `packages/client/src/GameClient.ts`:

```typescript
import { Client, type Room } from "colyseus.js"
import { z } from "zod"
import { ConnectOptionsSchema, type ConnectOptions } from "@partygame/shared"

export interface GameClientOptions {
  serverUrl: string
  onError?: (error: GameError) => void
}

export interface GameError {
  code: string
  message: string
  recoverable: boolean
}

export interface ConnectResult {
  connected: boolean
  sessionId: string
  error?: GameError
}

export class GameClient {
  private colyseusClient: Client
  private room?: Room
  private onError?: (error: GameError) => void

  constructor(options: GameClientOptions) {
    this.colyseusClient = new Client(options.serverUrl)
    this.onError = options.onError
  }

  async connect(options: ConnectOptions): Promise<ConnectResult> {
    // Validate options
    const validation = ConnectOptionsSchema.safeParse(options)
    if (!validation.success) {
      return {
        connected: false,
        sessionId: "",
        error: {
          code: "VALIDATION_ERROR",
          message: validation.error.errors.map((e) => e.message).join(", "),
          recoverable: true,
        },
      }
    }

    try {
      const joinOptions = {
        name: options.playerName,
        asAudience: options.asAudience ?? false,
      }

      this.room = options.roomCode
        ? await this.colyseusClient.joinById(options.roomCode, joinOptions)
        : await this.colyseusClient.joinOrCreate(options.roomName, joinOptions)

      // Set up error handler
      this.room.onMessage(
        "ERROR",
        (error: { code: string; message: string }) => {
          this.onError?.({
            code: error.code,
            message: error.message,
            recoverable: error.code !== "RATE_LIMITED",
          })
        },
      )

      return { connected: true, sessionId: this.room.sessionId }
    } catch (err) {
      const error: GameError = {
        code: "CONNECTION_FAILED",
        message: err instanceof Error ? err.message : "Unknown error",
        recoverable: true,
      }
      return { connected: false, sessionId: "", error }
    }
  }

  send(actionName: string, data?: unknown): void {
    this.room?.send("ACTION", { name: actionName, data: data ?? {} })
  }

  getRoom(): Room | undefined {
    return this.room
  }

  async disconnect(): Promise<void> {
    await this.room?.leave()
    this.room = undefined
  }
}

export function createGameClient(options: GameClientOptions): GameClient {
  return new GameClient(options)
}
```

---

### ✅ Phase 4 Checkpoint

- [ ] Client validation works
- [ ] Error handling in place
- [ ] Git commit: `feat(client): enhanced client with validation`

---

## Phase 5 — Reference Game (Quiplash-style)

**Goal:** Complete playable game with E2E tests.

---

### Step 5.1 — Enhanced game with anti-cheat

Create `games/reference/server/game.ts`:

```typescript
import { defineGame, phase, action, when } from "@partygame/core"
import { z } from "zod"

const PROMPTS = [
  "The worst excuse for being late to work",
  "A rejected name for a breakfast cereal",
  "Something you should never say at a funeral",
  "A terrible superhero power",
  "The worst thing to find in a sandwich",
]

function shuffled<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

interface PromptlyState {
  round: number
  maxRounds: number
  prompts: Record<string, string>
  answers: Record<string, string>
  votes: Record<string, string>
  scores: Record<string, number>
  lastResults: { winner: string; points: number }[]
  /** Track who has submitted to prevent double submission */
  hasSubmitted: Set<string>
  /** Track who has voted to prevent double voting */
  hasVoted: Set<string>
}

export const promptlyGame = defineGame<PromptlyState>({
  name: "promptly",
  minPlayers: 3,
  maxPlayers: 8,
  version: 1,

  initialState: () => ({
    round: 0,
    maxRounds: 3,
    prompts: {},
    answers: {},
    votes: {},
    scores: {},
    lastResults: [],
    hasSubmitted: new Set(),
    hasVoted: new Set(),
  }),

  phases: {
    lobby: phase<PromptlyState>({
      allowJoin: true,
      actions: {
        startGame: action<PromptlyState>({
          from: "host",
          handler: () => {},
        }),
      },
      transitions: {
        toAnswering: when(() => true),
      },
    }),

    answering: phase<PromptlyState>({
      duration: 90_000,
      onEnter: ({ state, players }) => {
        state.round += 1
        state.answers = {}
        state.votes = {}
        state.lastResults = []
        state.hasSubmitted = new Set()
        state.hasVoted = new Set()

        const promptPool = shuffled(PROMPTS)
        players
          .filter((p) => p.role !== "audience")
          .forEach((p, i) => {
            state.prompts[p.id] = promptPool[i % promptPool.length]!
          })
      },
      actions: {
        submitAnswer: action<PromptlyState, { answer: string }>({
          private: true,
          validate: z.object({
            answer: z.string().min(1).max(200),
          }),
          handler: ({ state, clientId, data }) => {
            // Anti-cheat: prevent double submission
            if (state.hasSubmitted.has(clientId)) {
              return { success: false, errors: ["Already submitted"] }
            }
            state.answers[clientId] = data.answer.slice(0, 200)
            state.hasSubmitted.add(clientId)
          },
        }),
      },
      transitions: {
        toVoting: when(({ state, players }) => {
          const activePlayers = players.filter((p) => p.role !== "audience")
          return activePlayers.every((p) => state.hasSubmitted.has(p.id))
        }, "or-timeout"),
      },
    }),

    voting: phase<PromptlyState>({
      duration: 60_000,
      actions: {
        vote: action<PromptlyState, { votedFor: string }>({
          validate: z.object({ votedFor: z.string() }),
          handler: ({ state, clientId, data, players }) => {
            // Anti-cheat checks
            if (clientId === data.votedFor) return // Cannot vote for self
            if (state.hasVoted.has(clientId)) return // Cannot vote twice

            // Validate votedFor exists
            const targetExists = players.some((p) => p.id === data.votedFor)
            if (!targetExists) return

            state.votes[clientId] = data.votedFor
            state.hasVoted.add(clientId)
          },
        }),
      },
      transitions: {
        toResults: when(({ state, players }) => {
          const activePlayers = players.filter((p) => p.role !== "audience")
          return activePlayers.every((p) => state.hasVoted.has(p.id))
        }, "or-timeout"),
      },
    }),

    results: phase<PromptlyState>({
      duration: 10_000,
      onEnter: ({ state }) => {
        const voteCounts: Record<string, number> = {}
        for (const votedFor of Object.values(state.votes)) {
          voteCounts[votedFor] = (voteCounts[votedFor] ?? 0) + 1
        }

        state.lastResults = []
        for (const [playerId, voteCount] of Object.entries(voteCounts)) {
          const points = voteCount * 100
          state.scores[playerId] = (state.scores[playerId] ?? 0) + points
          state.lastResults.push({ winner: playerId, points })
        }

        state.lastResults.sort((a, b) => b.points - a.points)
      },
      transitions: {
        toAnswering: when(
          ({ state }) => state.round < state.maxRounds,
          "or-timeout",
        ),
        toGameOver: when(
          ({ state }) => state.round >= state.maxRounds,
          "or-timeout",
        ),
      },
    }),

    gameOver: phase<PromptlyState>({
      allowJoin: false,
      actions: {
        playAgain: action<PromptlyState>({
          from: "host",
          handler: ({ state }) => {
            state.round = 0
            state.scores = {}
            state.answers = {}
            state.votes = {}
            state.prompts = {}
            state.hasSubmitted = new Set()
            state.hasVoted = new Set()
          },
        }),
      },
      transitions: {
        toLobby: when(() => true),
      },
    }),
  },
})
```

---

### ✅ Phase 5 Checkpoint

- [ ] Full game with anti-cheat
- [ ] Property tests for game logic
- [ ] E2E tests with Playwright
- [ ] Git commit: `feat(game): reference game with anti-cheat`

---

## Phase 6 — CLI & Scaffolding

**Goal:** `npx create-partygame my-game` with enhanced templates.

---

### Step 6.1 — Enhanced CLI with options

Update CLI to support:

- `--template` (basic, full, minimal)
- `--frontend` (svelte, react)
- `--skip-git`
- `--install` / `--skip-install`

---

### ✅ Phase 6 Checkpoint

- [ ] CLI supports multiple templates
- [ ] Generated project passes linting
- [ ] Git commit: `feat(cli): enhanced scaffolding`

---

## Phase 7 — Polish, Performance & Production

**Goal:** Production-ready with monitoring, security, and documentation.

---

### Step 7.1 — Performance benchmarks with k6 (NEW)

Create `packages/server/tests/load.k6.js`:

```javascript
import http from "k6/http"
import { check, sleep } from "k6"

export const options = {
  stages: [
    { duration: "1m", target: 100 }, // Ramp up
    { duration: "3m", target: 100 }, // Stay at 100
    { duration: "1m", target: 0 }, // Ramp down
  ],
}

export default function () {
  // WebSocket load test would go here
  // Using Colyseus load testing instead
  sleep(1)
}
```

---

### Step 7.2 — Security hardening (NEW)

Create `packages/server/src/Security.ts`:

```typescript
import helmet from "helmet"

export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "ws:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
})

export function sanitizeInput(input: string): string {
  return input.replace(/[<>]/g, "").slice(0, 1000)
}
```

---

### Step 7.3 — Health checks and metrics (NEW)

Create `packages/server/src/Health.ts`:

```typescript
import { logger } from "./Logger.js"

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy"
  uptime: number
  memory: NodeJS.MemoryUsage
  rooms: number
  connections: number
}

export function getHealthStatus(): HealthStatus {
  return {
    status: "healthy",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    rooms: 0, // Would be populated from GameServer
    connections: 0,
  }
}
```

---

### Step 7.4 — Documentation site

```bash
pnpm add -D vitepress
```

Structure:

```
docs/
├── .vitepress/
│   └── config.ts
├── guide/
│   ├── getting-started.md
│   ├── defining-games.md
│   ├── phases-and-transitions.md
│   ├── private-state.md
│   ├── security.md           (NEW)
│   ├── scaling.md            (NEW)
│   └── deploying.md
├── api/
│   ├── core.md
│   ├── server.md
│   ├── client.md
│   └── cli.md
└── examples/
    ├── tutorial.md
    └── advanced-patterns.md
```

---

### Step 7.5 — Semantic release setup (NEW)

Create `.changeset/config.json`:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

---

### Step 7.6 — Docker deployment (NEW)

Create `infra/docker/Dockerfile`:

```dockerfile
FROM oven/bun:1.1

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY games ./games

RUN bun install
RUN bun run build

EXPOSE 2567

CMD ["bun", "run", "games/reference/server/index.ts"]
```

---

### ✅ Phase 7 Checkpoint

- [ ] Load tests pass (1000+ concurrent)
- [ ] Security middleware in place
- [ ] Health checks working
- [ ] Documentation site deployed
- [ ] Docker image builds
- [ ] Semantic release configured
- [ ] Git tag: `v0.1.0`

---

## Phase 8 — Post-Launch (Optional)

**Goal:** Analytics, community, and ecosystem growth.

---

### Step 8.1 — Analytics integration

Track:

- Games played
- Average session duration
- Drop-off points
- Popular game modes

### Step 8.2 — Plugin system

Allow community plugins for:

- Custom phase types
- Authentication providers
- Analytics backends

### Step 8.3 — Game marketplace

Template gallery for community-contributed games.

---

## Architectural Patterns Quick Reference

### MVVM in this framework

| Layer         | What it is                                | Package                       |
| ------------- | ----------------------------------------- | ----------------------------- |
| **Model**     | `GameDefinition` + XState machine context | `@partygame/core`             |
| **ViewModel** | `GameRoom` (Colyseus) + XState actor      | `@partygame/server`           |
| **View**      | Svelte 5 components + stores              | `@partygame/client` + game UI |

### Security Checklist

- [ ] Input validation (Zod)
- [ ] Rate limiting
- [ ] Helmet headers
- [ ] CORS configuration
- [ ] Audit logging
- [ ] Anti-cheat in game logic

---

## Debugging & Common Pitfalls

### Pitfall 1: Colyseus Schema 64-field limit

Nest schemas if you need more fields.

### Pitfall 2: Rate limiting in tests

Disable or mock rate limiter in tests:

```typescript
const room = createGameRoom(game, { disableRateLimit: true })
```

### Pitfall 3: State migration ordering

Always test migrations from each version to latest.

### Pitfall 4: WebSocket reconnection

Use exponential backoff in client:

```typescript
const backoff = Math.min(1000 * Math.pow(2, attempts), 30000)
```

---

## Risk Register

| Risk                      | Likelihood | Impact   | Mitigation                  |
| ------------------------- | ---------- | -------- | --------------------------- |
| Bun compatibility issues  | Medium     | High     | Test on Node.js fallback    |
| Colyseus breaking changes | Low        | High     | Pin versions, test upgrades |
| Scaling bottlenecks       | Medium     | Medium   | Redis adapter, load testing |
| Security vulnerabilities  | Low        | Critical | Audits, dependency scanning |
| Poor DX adoption          | Medium     | Medium   | Documentation, CLI polish   |

---

## Summary Table: Per-Phase Deliverables

| Phase | Deliverable           | Key Test                       |
| ----- | --------------------- | ------------------------------ |
| 0     | Monorepo + CI         | `pnpm test` passes             |
| 0.5   | Dev container         | Codespaces boots in < 2min     |
| 1     | `defineGame()` API    | Property tests pass            |
| 2     | `GameRoom` + security | Rate limiting works            |
| 3     | Private state         | Player B can't read A's answer |
| 3.5   | Migrations            | v1 state → v2 works            |
| 4     | Client SDK            | Error handling works           |
| 5     | Reference game        | E2E tests pass                 |
| 6     | CLI scaffold          | Multiple templates work        |
| 7     | Production ready      | Load test + security audit     |
| 8     | Ecosystem             | Analytics + plugins            |

---

_End of optimized plan. Execute phase by phase. Never skip TDD. The tests are the spec._
