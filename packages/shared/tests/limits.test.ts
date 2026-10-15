import { describe, expect, it } from "vitest";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, sanitizeRoomCode } from "../src/limits.js";
import { RoomCodeSchema } from "../src/protocol.js";

describe("room code rules", () => {
  it("keeps RoomCodeSchema in step with the length and alphabet constants", () => {
    const first = ROOM_CODE_ALPHABET.charAt(0);
    const last = ROOM_CODE_ALPHABET.charAt(ROOM_CODE_ALPHABET.length - 1);
    expect(RoomCodeSchema.safeParse(first.repeat(ROOM_CODE_LENGTH)).success).toBe(true);
    expect(RoomCodeSchema.safeParse(last.repeat(ROOM_CODE_LENGTH)).success).toBe(true);
    expect(RoomCodeSchema.safeParse(first.repeat(ROOM_CODE_LENGTH + 1)).success).toBe(false);
    expect(RoomCodeSchema.safeParse(first.repeat(ROOM_CODE_LENGTH - 1)).success).toBe(false);
    expect(RoomCodeSchema.safeParse("a".repeat(ROOM_CODE_LENGTH)).success).toBe(false);
  });

  it("upper-cases, keeps only alphabet characters and cuts to the length", () => {
    expect(sanitizeRoomCode("a1b-cdEFG")).toBe("ABCD");
    expect(sanitizeRoomCode(`${ROOM_CODE_ALPHABET}!`)).toBe(
      ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH),
    );
  });
});
