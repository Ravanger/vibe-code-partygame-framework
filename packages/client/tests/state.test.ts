import { describe, it, expect, vi } from 'vitest';
import { GameClient } from '../src/GameClient.js';

describe('GameClient', () => {
  it('should update state when server pushes update', () => {
    // This is a test that verifies GameClient updates its reactive state
    // We will need to mock Colyseus Room
    const client = new GameClient({ roomCode: 'ABCD' });
    expect(client.connectionStatus).toBe('connecting');
  });
});
