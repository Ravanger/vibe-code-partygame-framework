import { describe, expect, it } from "vitest";
import { z } from "zod";
import { actionFactory, defineGame, loggingMiddleware, type PhaseState } from "../src/index.js";
import { TestTable } from "../src/testing/TestTable.js";

interface S extends PhaseState {
  log: string[];
}
interface P {
  secret: string;
}
interface O {
  rounds: number;
}

const action = actionFactory<S, P, O>();

class LTable extends TestTable<S, P, O> {
  constructor(lines: string[]) {
    super({
      definition: defineGame<S, P, O>({
        name: "Log",
        minPlayers: 1,
        maxPlayers: 4,
        startPhase: "Play",
        createPrivateState: () => ({ secret: "s" }),
        phases: {
          Play: {
            duration: 1000,
            onTimeout: (ctx) => ctx.transition("Score"),
            actions: {
              GO: action({
                from: "player",
                payload: z.object({}),
                handler: (ctx) => ctx.state.log.push("go"),
              }),
            },
          },
          Score: {},
        },
        middleware: [loggingMiddleware({ log: (line) => lines.push(line) })],
      }),
      state: { phase: "", phaseEndsAt: 0, canStart: false, log: [] },
      options: { rounds: 2 },
      players: 2,
    });
  }
}

describe("loggingMiddleware", () => {
  it("logs lifecycle events and actions in the exact formats", () => {
    const lines: string[] = [];
    const table = new LTable(lines);
    lines.length = 0;
    table.start();
    table.act("p2", "GO");
    table.tick(1000);
    expect(lines).toEqual([
      "action START_GAME by p1 in Lobby",
      "transition Lobby -> Play",
      "enter Play",
      "action GO by p2 in Play",
      "timeout Play",
      "transition Play -> Score",
      "enter Score",
    ]);
  });

  it("emits no line for roster changes", () => {
    const lines: string[] = [];
    const table = new LTable(lines);
    lines.length = 0;
    table.start();
    const before = [...lines];
    table.joinLate("p3");
    expect(lines).toEqual(before);
  });
});
