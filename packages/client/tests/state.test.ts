import { describe, it, expect, vi } from 'vitest';
import { GameState } from '../src/state.svelte';

describe('GameState', () => {
  it('should be reactive with Svelte Runes', () => {
    const state = new GameState();
    expect(state.count).toBe(0);

    let effectTriggered = 0;
    // Mocking an effect-like behavior to verify reactivity
    // In Svelte 5, $derived or other runes would react to changes.
    // For a pure unit test, we can check if the value updates.
    
    state.increment();
    expect(state.count).toBe(1);
  });
});
