# Phase 5: Reference Game Detailed Design (Quiplash-style)

## 1. Overview
A modular, turn-based party game built using the `vibe-coded` framework. Architecture centers on an **XState Orchestrator** for game lifecycle and **Phase Handlers** for state/logic encapsulation.

## 2. Core Architectural Patterns
### 2.1 XState Orchestrator
The finite state machine (FSM) defining the global lifecycle of a game session.
- **States**: `Lobby` -> `Prompting` -> `Voting` -> `Reveal` -> `RoundEnd`.
- **Transitions**: Strictly controlled via events.
- **Data Model**: Global game state (players, scores, current prompt pairs).

### 2.2 Phase Handlers (Command Handlers)
Independent objects encapsulating logic for a single game state.
- **Interface**:
  - `onEnter()`: Lifecycle hook.
  - `handleAction(action: GameAction)`: Logic for incoming player inputs.
  - `computeVisibility()`: Determines what to pass to `RoleBasedStateView`.
- **Encapsulation**: Handlers never modify global state directly; they return state diffs to the Orchestrator.

### 2.3 Command Pattern
- **Action Schema (Zod)**: Strongly typed definition for every possible user action (e.g., `SubmitAnswer`, `CastVote`).
- **Processing**: Orchestrator validates the action against the current handler, ensuring players cannot perform illegal actions for a phase.

## 3. Detailed Game Loop Implementation
### 3.1 Setup & Lobby Phase
- Initialize room.
- Register player connections (schema management).
- Transition to `Prompting` once player count threshold is met.

### 3.2 Prompt Phase
- **Input**: `SubmitAnswer(answer: string)`
- **Logic**: 
  - Assign prompts to players.
  - Track submission status (who answered?).
  - Automatically transition to `Voting` when all players have submitted.

### 3.3 Voting Phase
- **Input**: `CastVote(answerId: string)`
- **Logic**:
  - Present prompt + pairing.
  - Deny self-votes (logic check).
  - Track vote tally.
  - Transition to `Reveal` after all players vote.

### 3.4 Reveal Phase
- **Input**: `AcknowledgeReveal()`
- **Logic**:
  - Display votes per answer.
  - Compute points.
  - Transition to `RoundEnd` or next prompt cycle.

## 4. Testing & Validation Strategy
### 4.1 Unit Testing
- Each Phase Handler must have 100% logic coverage in isolation.
- Use mocks for Orchestrator state.

### 4.2 Integration Testing
- Verify Orchestrator transitions trigger correct Phase Handler lifecycle methods.

### 4.3 Visibility Testing
- Use `RoleBasedStateView` assertions to ensure players only see what they should (e.g., in `Prompting`, players shouldn't see others' answers).

---
*Does this granular design look right to you?*
