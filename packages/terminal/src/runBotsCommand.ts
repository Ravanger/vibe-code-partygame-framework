import { type BotKit, type BotOptions, type BotPlayer, joinBots } from "@partygame/bots";
import type { BaseGameState } from "@partygame/shared/schema";
import { parseBotsArgs } from "./args.js";

export interface BotsCommandOptions<TState extends BaseGameState> {
  kit: BotKit<TState>;
  /** The most bots the game seats besides a human host. */
  maxBots: number;
  /** `CODE [count] [--endpoint URL] [--api-port N]` */
  argv: string[];
  out: (line: string) => void;
  err: (line: string) => void;
  /** Printed to `err` and used as the error message when `argv` is bad. */
  usage: string;
  bot?: BotOptions;
  /** Called before joining with a function that removes the bots (waiting for the join) and reports a failure to `err`; wire it to Ctrl+C. */
  onInterrupt?: (stop: () => Promise<void>) => void;
}

export interface BotsCommandHandle {
  /** Removes the bots from the room. */
  leave(): Promise<void>;
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The `bots <CODE> [count]` command: seats bots in a room made elsewhere and reports to `out`; rejects after writing to `err` on bad arguments or a failed join. */
export const runBotsCommand = async <TState extends BaseGameState>(
  options: BotsCommandOptions<TState>,
): Promise<BotsCommandHandle> => {
  const { kit, maxBots, out, err, usage, bot } = options;
  const parsed = parseBotsArgs(options.argv, { maxBots, usage });
  if (!parsed.ok) {
    err(parsed.error);
    throw new Error(parsed.error);
  }
  const { code, count, endpoint, apiPort } = parsed.value;
  const seating = joinBots({
    stateClass: kit.stateClass,
    strategy: kit.strategy,
    code,
    count,
    endpoint,
    apiPort,
    ...(bot ? { bot } : {}),
  });
  seating.catch(() => undefined);
  options.onInterrupt?.(async () => {
    try {
      await Promise.all((await seating).map((each) => each.leave()));
    } catch (error) {
      err(`Could not leave cleanly: ${messageOf(error)}`);
    }
  });
  let seated: BotPlayer<TState>[];
  try {
    seated = await seating;
  } catch (error) {
    err(`Could not join ${code}: ${messageOf(error)}`);
    throw error;
  }
  for (const each of seated) out(`${each.name} joined ${code}`);
  out("Bots are playing. Ctrl+C removes them.");
  return { leave: async () => void (await Promise.all(seated.map((each) => each.leave()))) };
};
