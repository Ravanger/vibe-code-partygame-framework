import { beforeEach, describe, expect, it } from "vitest";
import { RoomCodeService } from "../src/services/RoomCodeService.js";

describe("RoomCodeService", () => {
  let service: RoomCodeService;

  beforeEach(() => {
    service = new RoomCodeService();
  });

  it("should generate a 4-letter uppercase code", () => {
    const code = service.generateCode();
    expect(code).toMatch(/^[A-Z]{4}$/);
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

  it("should generate non-colliding codes", () => {
    const code1 = service.generateAndRegister("room-1");
    const code2 = service.generateAndRegister("room-2");
    expect(code1).not.toBe(code2);
    expect(service.resolve(code1)).toBe("room-1");
    expect(service.resolve(code2)).toBe("room-2");
  });
});
