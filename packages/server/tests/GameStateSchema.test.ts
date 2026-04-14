import { GameStateSchema } from '../src/schema/GameStateSchema';
import { test, expect } from 'vitest';

test('schema includes new fields', () => {
  const state = new GameStateSchema();
  expect(state.currentVotingOptions).toBeDefined();
  expect(state.selectedCategory).toBeDefined();
});
