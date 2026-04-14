# Design: Core DSL Builders (@partygame/core)

## Architecture

We will implement helper builders for `phase` and `action` to complement the existing `defineGame` function. These will be pure TypeScript functions that return parts of the `GameDefinition<TState>` structure, allowing users to build the game definition incrementally or keep it as a clean configuration object.

## Components

- `createAction<TState, TPayload>(config: ActionDefinition<TState, TPayload>)`: Helper to ensure types for action handlers.
- `createPhase<TState>(config: PhaseDefinition<TState>)`: Helper to construct phase definitions with actions.

## Data Flow

Users will import these helpers to construct their `phases` object:

```typescript
const lobby = createPhase({
  actions: {
    join: createAction({
      from: 'player',
      handler: (ctx) => { ... }
    })
  }
});
```

## Testing Strategy

- Unit tests for `createAction` and `createPhase` in `packages/core/tests/builders.test.ts`.
- Verify TypeScript inference in tests.

## Error Handling

- Rely on TypeScript static analysis for schema validation. Zod will be used at the server layer for runtime validation of incoming data.
