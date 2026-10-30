import { describe, expect, it, vi } from "vitest";
import { jsonLineLogger } from "../src/logger.js";

describe("jsonLineLogger", () => {
  it("writes one JSON object per line with ts, level, event and fields", () => {
    const lines: string[] = [];
    const logger = jsonLineLogger((line) => {
      lines.push(line);
    });
    const before = Date.now();
    logger.info("room.created");
    logger.warn("action.rejected", { code: "UNKNOWN_ACTION", action: "NOPE" });
    logger.error("boom", { n: 1, ok: true });
    const after = Date.now();

    expect(lines).toHaveLength(3);
    const [a, b, c] = lines.map((line) => JSON.parse(line));
    expect(a.level).toBe("info");
    expect(a.event).toBe("room.created");
    expect(b.level).toBe("warn");
    expect(b.code).toBe("UNKNOWN_ACTION");
    expect(b.action).toBe("NOPE");
    expect(c.level).toBe("error");
    expect(c.n).toBe(1);
    expect(c.ok).toBe(true);
    for (const obj of [a, b, c]) {
      expect(obj.ts).toBeGreaterThanOrEqual(before);
      expect(obj.ts).toBeLessThanOrEqual(after);
    }
  });

  it("keeps the reserved keys when caller fields collide with them", () => {
    const lines: string[] = [];
    const logger = jsonLineLogger((line) => {
      lines.push(line);
    });
    const before = Date.now();
    logger.info("real.event", { ts: 1, level: "error", event: "forged" });
    const after = Date.now();

    const obj = JSON.parse(lines[0] as string);
    expect(obj.level).toBe("info");
    expect(obj.event).toBe("real.event");
    expect(typeof obj.ts).toBe("number");
    expect(obj.ts).toBeGreaterThanOrEqual(before);
    expect(obj.ts).toBeLessThanOrEqual(after);
  });

  it("does not add a fields key when no fields are passed", () => {
    const lines: string[] = [];
    jsonLineLogger((line) => {
      lines.push(line);
    }).info("room.disposed");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] as string)).toEqual({
      ts: expect.any(Number),
      level: "info",
      event: "room.disposed",
    });
  });

  it("writes to stdout with a trailing newline by default", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      jsonLineLogger().info("custom.event", { n: 1 });
      expect(spy).toHaveBeenCalledTimes(1);
      const call = spy.mock.calls[0];
      if (!call) throw new Error("no write call recorded");
      const arg = call[0];
      if (typeof arg !== "string") throw new Error(`expected a string line, got ${typeof arg}`);
      expect(arg.endsWith("\n")).toBe(true);
      expect(JSON.parse(arg.slice(0, -1))).toEqual({
        ts: expect.any(Number),
        level: "info",
        event: "custom.event",
        n: 1,
      });
    } finally {
      spy.mockRestore();
    }
  });
});
