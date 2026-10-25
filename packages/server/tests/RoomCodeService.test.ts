import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, RoomCodeSchema } from "@partygame/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { RoomCodeService } from "../src/services/RoomCodeService.js";

describe("RoomCodeService", () => {
  let service: RoomCodeService;

  beforeEach(() => {
    service = new RoomCodeService();
  });

  it("should generate a 4-letter uppercase code", () => {
    const code = service.generateCode();
    expect(RoomCodeSchema.safeParse(code).success).toBe(true);
  });

  it("should generate unique codes", () => {
    const code1 = service.generateCode();
    const code2 = service.generateCode();
    expect(code1).not.toBe(code2);
  });

  it("should register and resolve codes", () => {
    const code = service.generateCode();
    service.register(code, "room-123");
    expect(service.resolve(code)).toBe("room-123");
  });

  it("should return undefined for unregistered codes", () => {
    expect(service.resolve("ABCD")).toBeUndefined();
  });

  it("should unregister codes", () => {
    const code = service.generateCode();
    service.register(code, "room-123");
    service.unregister(code);
    expect(service.resolve(code)).toBeUndefined();
  });

  it("exposes the number of registered rooms as size and drops it after unregister", () => {
    expect(service.size).toBe(0);
    const code1 = service.generateCode();
    const code2 = service.generateCode();
    service.register(code1, "room-1");
    service.register(code2, "room-2");
    expect(service.size).toBe(2);
    service.unregister(code1);
    expect(service.size).toBe(1);
  });

  it("should generate non-colliding codes", () => {
    const code1 = service.generateAndRegister("room-1");
    const code2 = service.generateAndRegister("room-2");
    expect(code1).not.toBe(code2);
    expect(service.resolve(code1)).toBe("room-1");
    expect(service.resolve(code2)).toBe("room-2");
  });

  it("should retry on duplicate code collision", () => {
    let calls = 0;
    const retryService = new RoomCodeService(() => {
      ++calls;
      return calls <= 4 ? 0 : 13;
    });
    retryService.register("AAAA", "room-1");
    // First attempt draws AAAA (a collision); the retry draws NNNN.
    expect(retryService.generateCode()).toBe("NNNN");
  });

  it("draws every letter from the alphabet with an even distribution by default", () => {
    const counts = new Array<number>(ROOM_CODE_ALPHABET.length).fill(0);
    for (let n = 0; n < 5000; ++n) {
      for (const letter of service.generateCode()) {
        const index = ROOM_CODE_ALPHABET.indexOf(letter);
        counts[index] = (counts[index] ?? 0) + 1;
      }
    }
    const expected = (5000 * ROOM_CODE_LENGTH) / ROOM_CODE_ALPHABET.length;
    for (const count of counts) {
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(expected * 2);
    }
  });

  it("should clean up reverse mapping on unregister", () => {
    const code = service.generateCode();
    service.register(code, "room-123");
    expect(service.resolveByRoomId("room-123")).toBe(code);
    service.unregister(code);
    expect(service.resolveByRoomId("room-123")).toBeUndefined();
  });

  it("should handle unregister of non-existent code", () => {
    service.unregister("ZZZZ");
    expect(service.resolve("ZZZZ")).toBeUndefined();
  });

  it("succeeds when only the tenth attempt is free", () => {
    let calls = 0;
    const lastFreeService = new RoomCodeService(() => {
      ++calls;
      return calls <= 9 * 4 ? 0 : 13;
    });
    lastFreeService.register("AAAA", "room-1");
    expect(lastFreeService.generateCode()).toBe("NNNN");
  });

  it("throws an actionable error when every attempt collides", () => {
    const exhaustedService = new RoomCodeService(() => 0);
    exhaustedService.register("AAAA", "room-1");
    expect(() => exhaustedService.generateCode()).toThrow(
      "Could not generate a unique room code after 10 attempts; too many open rooms",
    );
  });
});
