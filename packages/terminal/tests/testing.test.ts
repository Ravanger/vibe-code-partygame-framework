import { describe, expect, it } from "vitest";
import { ScriptedIo } from "../src/testing.js";

describe("ScriptedIo", () => {
  it("records questions and prints, and answers the pending question", async () => {
    const io = new ScriptedIo();
    expect(io.isWaiting).toBe(false);
    expect(io.lastQuestion).toBe("");
    const answer = io.ask("Name? ", new AbortController().signal);
    io.print("hello");
    expect(io.isWaiting).toBe(true);
    expect(io.lastQuestion).toBe("Name? ");
    await io.type("Ann");
    expect(await answer).toBe("Ann");
    expect(io.isWaiting).toBe(false);
    expect(io.asked).toEqual(["Name? "]);
    expect(io.printed).toEqual(["hello"]);
    expect(io.signals).toHaveLength(1);
  });

  it("rejects a pending question when its signal aborts and ignores typing with none pending", async () => {
    const io = new ScriptedIo();
    const abort = new AbortController();
    const answer = io.ask("Say: ", abort.signal);
    abort.abort();
    await expect(answer).rejects.toThrow("aborted");
    await io.type("nobody listens");
  });
});
