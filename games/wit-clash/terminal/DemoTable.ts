import { type BotOptions, DemoTable } from "@partygame/bots";
import { witClashKit } from "../bots/witClashBot.js";
import { isGameOver } from "../src/isGameOver.js";
import type { WitClashOptions } from "../src/options.js";
import type { WitClashState } from "../src/state.js";

export const DEMO_ROOM_OPTIONS: WitClashOptions = {
  totalRounds: 2,
  categoryVoteSeconds: 8,
  promptSeconds: 20,
  voteSeconds: 8,
  revealSeconds: 6,
};

export const DEMO_BOT_OPTIONS: BotOptions = {
  thinkMs: [2000, 9000],
  reactMs: [1000, 4000],
};

export const DEMO_NEXT_ROUND_MS = 8000;

export interface WitClashDemoOptions {
  endpoint: string;
  apiPort: number;
  /** Bots besides the host bot. */
  bots: number;
  room?: Partial<WitClashOptions>;
  bot?: BotOptions;
  nextRoundDelayMs?: number;
}

/** A watch-only WitClash room played by bots; finished on the final results. */
export const createDemoTable = (options: WitClashDemoOptions): DemoTable<WitClashState> =>
  new DemoTable({
    ...witClashKit({ nextRoundDelayMs: options.nextRoundDelayMs ?? 0 }),
    endpoint: options.endpoint,
    apiPort: options.apiPort,
    bots: options.bots,
    roomOptions: { ...DEMO_ROOM_OPTIONS, ...options.room },
    ...(options.bot ? { bot: options.bot } : {}),
    isFinished: isGameOver,
  });
