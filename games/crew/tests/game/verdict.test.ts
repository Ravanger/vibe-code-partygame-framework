import { describe, expect, it } from "vitest";
import { playToVerdict, revealOf, Table } from "./support.js";

describe("Verdict", () => {
  it("wins on a correct guess and reveals everything", () => {
    const t = Table.started({ options: { rounds: 1 } });
    playToVerdict(t);
    t.guess("p2", t.priv.target);
    expect(t.phase).toBe("Results");
    expect(t.state.outcome).toBe("win");
    expect(t.state.target).toBe(t.priv.target);
    expect(t.state.guesses.length).toBe(1);
    expect(t.state.guesses[0]?.correct).toBe(true);
    for (const [id, signal] of Object.entries(t.priv.signals)) {
      expect(revealOf(t, id)).toBe(signal);
    }
  });

  it("records wrong guesses and loses on the third", () => {
    const t = Table.started({ options: { rounds: 1 } });
    playToVerdict(t);
    const wrong = t.priv.target + 1;
    t.guess("p1", wrong);
    expect(t.phase).toBe("Verdict");
    expect(t.state.guesses.length).toBe(1);
    expect(t.state.guesses[0]?.correct).toBe(false);
    t.guess("p2", wrong);
    expect(t.phase).toBe("Verdict");
    t.guess("p3", wrong);
    expect(t.phase).toBe("Results");
    expect(t.state.outcome).toBe("lose");
  });

  it("loses on the timeout", () => {
    const t = Table.started({ options: { rounds: 1 } });
    playToVerdict(t);
    t.tick(30_000);
    expect(t.phase).toBe("Results");
    expect(t.state.outcome).toBe("lose");
  });

  it("rejects an out-of-range guess", () => {
    const t = Table.started({ options: { rounds: 1 } });
    playToVerdict(t);
    const error = t.guess("p1", 100);
    expect(error?.code).toBe("INVALID_ACTION");
    expect(t.state.guesses.length).toBe(0);
  });

  it("ignores GUESS outside the Verdict phase", () => {
    const t = new Table();
    const error = t.guess("p1", 5);
    expect(error?.code).toBe("WRONG_PHASE");
  });
});
