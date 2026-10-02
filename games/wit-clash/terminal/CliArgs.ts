import { parseArgs } from "node:util";
import { between, type Parsed } from "@partygame/shared";
import { MAX_PLAYERS, MIN_PLAYERS } from "../src/playerLimits.js";

export interface DemoArgs {
  players: number;
  rounds: number;
}

const DEMO_USAGE = `Usage: bun run --cwd games/wit-clash demo [--bots=${MIN_PLAYERS}..${MAX_PLAYERS} (players in total, default 4)] [--rounds=1..10]`;

/** Command line parsing for the narrated demo. */
export class CliArgs {
  demo(argv: string[]): Parsed<DemoArgs> {
    const values = this.read(argv);
    if (!values) return { ok: false, error: DEMO_USAGE };
    const players = Number(values.bots ?? "4");
    const rounds = Number(values.rounds ?? "1");
    if (!between(players, MIN_PLAYERS, MAX_PLAYERS) || !between(rounds, 1, 10)) {
      return { ok: false, error: DEMO_USAGE };
    }
    return { ok: true, value: { players, rounds } };
  }

  private read(argv: string[]): Record<string, string | undefined> | undefined {
    try {
      const { values } = parseArgs({
        args: argv,
        options: { bots: { type: "string" }, rounds: { type: "string" } },
        strict: true,
        allowPositionals: false,
      });
      return values;
    } catch {
      return undefined;
    }
  }
}
