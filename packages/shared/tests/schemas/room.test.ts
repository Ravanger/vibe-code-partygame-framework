import { describe, it, expect } from 'vitest';
import { RoomCodeSchema } from '../../src/schemas/room';

describe('RoomCodeSchema', () => {
  it('should validate a 4-character uppercase alphanumeric string', () => {
    const code = 'ABCD';
    const result = RoomCodeSchema.safeParse(code);
    expect(result.success).toBe(true);
  });

  it('should reject a non-4-character string', () => {
    const code = 'ABC';
    const result = RoomCodeSchema.safeParse(code);
    expect(result.success).toBe(false);
  });

  it('should reject lowercase letters', () => {
    const code = 'abcd';
    const result = RoomCodeSchema.safeParse(code);
    expect(result.success).toBe(false);
  });

  it('should reject special characters', () => {
    const code = 'AB!D';
    const result = RoomCodeSchema.safeParse(code);
    expect(result.success).toBe(false);
  });
});
