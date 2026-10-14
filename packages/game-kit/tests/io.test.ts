import { describe, expect, it } from "vitest";
import { defaultIo } from "../src/io.js";

describe("defaultIo", () => {
  it("binds the real process", () => {
    const io = defaultIo();
    expect(io.env).toBe(process.env);
    expect(io.argv).toEqual(process.argv.slice(2));
    expect(io.exit).toBe(process.exit);
    expect(io.log).toBe(console.log);
    expect(io.error).toBe(console.error);
  });

  it("registers signal handlers on the process", () => {
    const io = defaultIo();
    const handler = () => {};
    const before = process.listenerCount("SIGINT");
    io.onSignal?.("SIGINT", handler);
    expect(process.listenerCount("SIGINT")).toBe(before + 1);
    process.removeListener("SIGINT", handler);
  });
});
