import { createInterface } from "node:readline/promises";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { ReadlinePrompter } from "../src/Prompter.js";

const setup = (terminal = false) => {
  const input = new PassThrough();
  const output = new PassThrough();
  let written = "";
  output.on("data", (chunk) => {
    written += String(chunk);
  });
  const lines = createInterface({ input, output, terminal });
  const prompter = new ReadlinePrompter(lines, output);
  return { input, lines, prompter, written: () => written };
};

describe("ReadlinePrompter", () => {
  it("asks a one-line question and resolves with the typed line", async () => {
    const { input, lines, prompter, written } = setup();
    const answer = prompter.ask("Name? ", new AbortController().signal);
    input.write("Ann\n");
    expect(await answer).toBe("Ann");
    expect(written()).toContain("Name? ");
    lines.close();
  });

  it("prints the head of a multi-line question and prompts with the last line", async () => {
    const { input, lines, prompter, written } = setup();
    const answer = prompter.ask("Pick one:\n1) a\n2) b\n> ", new AbortController().signal);
    input.write("2\n");
    expect(await answer).toBe("2");
    expect(written()).toContain("Pick one:\n1) a\n2) b\n");
    expect(written()).toContain("> ");
    lines.close();
  });

  it("redraws the pending prompt and the typed text under a printed line", async () => {
    const { input, lines, prompter, written } = setup(true);
    const answer = prompter.ask("Say: ", new AbortController().signal);
    input.write("he");
    await new Promise((resolve) => setTimeout(resolve, 10));
    prompter.print("Bob joined.");
    expect(written()).toContain("\r\x1b[KBob joined.\nSay: he");
    input.write("y\n");
    expect(await answer).toBe("hey");
    lines.close();
  });

  it("prints a bare line when nothing is pending", () => {
    const { lines, prompter, written } = setup();
    prompter.print("hello");
    expect(written()).toBe("\r\x1b[Khello\n");
    lines.close();
  });

  it("rejects when aborted and clears the pending prompt", async () => {
    const { lines, prompter, written } = setup();
    const abort = new AbortController();
    const answer = prompter.ask("Say: ", abort.signal);
    abort.abort();
    await expect(answer).rejects.toThrow();
    prompter.print("later");
    expect(written().endsWith("\r\x1b[Klater\n")).toBe(true);
    lines.close();
  });

  it("keeps a newer prompt pending when an older one settles", async () => {
    const { input, lines, prompter, written } = setup();
    const first = new AbortController();
    const older = prompter.ask("One: ", first.signal);
    first.abort();
    const newer = prompter.ask("Two: ", new AbortController().signal);
    await expect(older).rejects.toThrow();
    prompter.print("note");
    expect(written()).toContain("\r\x1b[Knote\nTwo: ");
    input.write("x\n");
    await newer;
    lines.close();
  });
});
