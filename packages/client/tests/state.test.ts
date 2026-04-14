import { describe, it, expect } from 'vitest';
import { GameClient } from '../src/GameClient.js';

describe('GameClient', () => {
  it('should initialize with connecting status', () => {
    const client = new GameClient({ roomCode: 'ABCD' });
    expect(client.connectionStatus).toBe('connecting');
  });

  it('should allow setting room code', () => {
    const roomCode = 'WXYZ';
    const client = new GameClient({ roomCode });
    // @ts-ignore - access for testing
    expect(client.roomCode).toBe(roomCode);
  });
});
