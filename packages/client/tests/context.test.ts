import { expect, it, describe, vi } from 'vitest';
import { provideGameClient, useGameClient } from '../src/context.js';
import { GameClient } from '../src/GameClient.js';
import { setContext, getContext } from 'svelte';

// Mock svelte context
vi.mock('svelte', () => ({
  setContext: vi.fn(),
  getContext: vi.fn(),
}));

describe('Context', () => {
  it('should provide and use game client', () => {
    const client = new GameClient({ roomCode: 'TEST' });
    provideGameClient(client);
    expect(setContext).toHaveBeenCalled();
    
    vi.mocked(getContext).mockReturnValue(client);
    const retrieved = useGameClient();
    expect(retrieved).toBe(client);
  });
});
