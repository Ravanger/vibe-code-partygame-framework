import { DemoRun } from "@partygame/terminal";
import { witClashKit } from "../bots/witClashBot.js";
import type { CategoryRepository } from "../src/content/CategoryRepository.js";
import { witClashGame } from "../src/hostedGame.js";
import { isGameOver } from "../src/isGameOver.js";
import type { WitClashState } from "../src/state.js";
import { Narrator } from "./Narrator.js";

export interface WitClashDemoRunOptions {
  /** Players in total, the host bot included. */
  players: number;
  rounds: number;
  categories: CategoryRepository;
  out: (line: string) => void;
  bot?: { thinkMs: [number, number]; reactMs: [number, number] };
  timeoutMs?: number;
}

/** A narrated all-bot WitClash game on its own server, checked against the scoreboard. */
export const witClashDemo = (options: WitClashDemoRunOptions): DemoRun<WitClashState> => {
  const narrator = new Narrator();
  return new DemoRun({
    games: [witClashGame(options.categories)],
    kit: witClashKit(),
    bots: options.players - 1,
    roomOptions: {
      totalRounds: options.rounds,
      categoryVoteSeconds: 5,
      promptSeconds: 15,
      voteSeconds: 5,
      revealSeconds: 2,
    },
    bot: options.bot ?? { thinkMs: [800, 2500], reactMs: [500, 1500] },
    finished: isGameOver,
    narrate: (state) => narrator.update(state),
    problems: (state) => narrator.discrepancies(state),
    passMessage: "PASS: scores match the reveals, no action was rejected",
    out: options.out,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  });
};
