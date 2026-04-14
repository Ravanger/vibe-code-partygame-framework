import { expect, it } from 'vitest';
import { GameRoomState } from '../src/state.svelte.js';

it('should sync state from server', () => {
  const state = new GameRoomState();
  state.sync({ count: 10 });
  expect(state.count).toBe(10);
});
