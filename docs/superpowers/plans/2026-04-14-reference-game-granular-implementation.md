# Granular Reference Game Implementation Plan (TDD-First)

**Goal:** Implement game phases using a strictly test-first approach.
**Architecture:** Orchestrator/Phase Handler.

---

### Task 1: Foundation (Actions & Types)
- [ ] **Step 1.1: Create directory `packages/shared/src/schemas`**
- [ ] **Step 1.2: Write tests for `GameActionSchema` first (Task 1.3/1.4 combined)**
  - Create `packages/shared/tests/schemas/game-actions.test.ts`
  - Assert valid actions (`SubmitAnswer`, `CastVote`, `AcknowledgeReveal`) pass.
  - Assert invalid actions (unknown types, missing fields) fail.
- [ ] **Step 1.3: Run tests and watch them FAIL**
- [ ] **Step 1.4: Implement `GameActionSchema` in `packages/shared/src/schemas/game-actions.ts`**
- [ ] **Step 1.5: Run tests and verify PASS**
- [ ] **Step 1.6: Commit**

### Task 2: Core Phase Infrastructure
- [ ] **Step 2.1: Create `packages/core/src/phases` directory**
- [ ] **Step 2.2: Write "test" for `PhaseHandler` interface (using type-level check or dummy implementation test)**
- [ ] **Step 2.3: Define `PhaseHandler` interface in `packages/core/src/phases/types.ts`**
- [ ] **Step 2.4: Commit**

### Task 3: Prompt Phase Implementation (TDD Cycle)
- [ ] **Step 3.1: Write failing tests in `packages/core/tests/phases/PromptPhase.test.ts`**
  - Test 1: `handleAction` rejects non-`SubmitAnswer`.
  - Test 2: `computeVisibility` returns correct phase.
- [ ] **Step 3.1.1: Run tests and watch them FAIL**
- [ ] **Step 3.2: Implement `PromptPhase` in `packages/core/src/phases/PromptPhase.ts` to pass Test 1**
- [ ] **Step 3.3: Run tests and watch Test 2 fail**
- [ ] **Step 3.4: Implement `computeVisibility` to pass Test 2**
- [ ] **Step 3.5: Run tests and verify PASS**
- [ ] **Step 3.6: Commit**

### Task 4: Orchestrator Integration (TDD Cycle)
- [ ] **Step 4.1: Write failing integration test in `packages/server/tests/GameRoom.orchestration.test.ts`**
  - Test: "GameRoom transitions to Prompting phase on start"
- [ ] **Step 4.2: Implement Orchestrator changes to pass test**
- [ ] **Step 4.3: Verify PASS, Commit**

### Task 5: Voting Phase (TDD Cycle)
- [ ] **Step 5.1: Write tests for `VotePhase` (before implementation)**
  - Test 1: `handleAction` rejects non-`CastVote`.
  - Test 2: Voting logic (tallying).
  - Test 3: Self-vote prevention.
- [ ] **Step 5.2: Run tests and watch them FAIL**
- [ ] **Step 5.3: Implement `VotePhase` iteratively, running tests at each stage**
- [ ] **Step 5.4: Run all phase tests, verify PASS, Commit**
