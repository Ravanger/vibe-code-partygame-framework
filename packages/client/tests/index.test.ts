import { expect, it, describe } from 'vitest';
import * as index from '../src/index.js';

describe('SDK Exports', () => {
  it('should export GameClient and createGameClient', () => {
    expect(index.GameClient).toBeDefined();
    expect(index.createGameClient).toBeDefined();
  });
});
