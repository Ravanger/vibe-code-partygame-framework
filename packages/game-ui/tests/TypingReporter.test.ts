import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TypingReporter } from "../src/TypingReporter.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("TypingReporter", () => {
  function makeReporter(idleMs?: number) {
    const send = vi.fn();
    return { send, reporter: new TypingReporter(send, idleMs) };
  }

  it("reports one message per change, not per keystroke", () => {
    const { send, reporter } = makeReporter();
    reporter.keystroke();
    reporter.keystroke();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith(true);
    reporter.stop();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(false);
    vi.advanceTimersByTime(5000);
    expect(send).toHaveBeenCalledTimes(2);
    reporter.keystroke();
    expect(send).toHaveBeenCalledTimes(3);
    expect(send).toHaveBeenLastCalledWith(true);
  });

  it("reports stopped after the default idle timeout", () => {
    const { send, reporter } = makeReporter();
    reporter.keystroke();
    vi.advanceTimersByTime(2499);
    expect(send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(false);
  });

  it("resets the idle timer on every keystroke", () => {
    const { send, reporter } = makeReporter(1000);
    reporter.keystroke();
    vi.advanceTimersByTime(600);
    reporter.keystroke();
    vi.advanceTimersByTime(999);
    expect(send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("sends nothing when stopping while not typing", () => {
    const { send, reporter } = makeReporter();
    reporter.stop();
    expect(send).not.toHaveBeenCalled();
  });
});
