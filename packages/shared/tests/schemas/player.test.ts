import { describe, it, expect } from 'vitest';
import { PlayerNameSchema } from '../../src/schemas/player';

describe('PlayerNameSchema', () => {
  it('should validate a valid player name', () => {
    expect(PlayerNameSchema.safeParse('Alice').success).toBe(true);
  });

  it('should reject a player name that is too short', () => {
    expect(PlayerNameSchema.safeParse('A').success).toBe(false);
  });

  it('should reject an empty player name', () => {
    expect(PlayerNameSchema.safeParse('').success).toBe(false);
  });

  it('should reject a player name that is too long', () => {
    expect(PlayerNameSchema.safeParse('a'.repeat(21)).success).toBe(false);
  });
});
