import { parseArgs } from "node:util";
import { RoomCodeSchema } from "@partygame/shared";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export interface DemoArgs {
  players: number;
  rounds: number;
}

export interface PlayArgs {
  name: string;
  bots: number;
  join: string | undefined;
  endpoint: string;
  apiPort: number;
  /** True when no endpoint or port was given, so a missing local server may be started. */
  usesDefaults: boolean;
}

export const DEFAULT_ENDPOINT = "ws://localhost:2567";
export const DEFAULT_API_PORT = 3001;

const DEMO_USAGE =
  "Usage: bun run cli:demo [--bots=3..8 (players in total, default 4)] [--rounds=1..10]";
const PLAY_USAGE =
  "Usage: bun run cli:play [--bots=0..7] [--name=You] [--join=ABCD] [--endpoint=ws://host:2567 --api-port=3001]";

/** Command line parsing for the two terminal tools. */
export class CliArgs {
  demo(argv: string[]): Parsed<DemoArgs> {
    const values = this.read(argv, ["bots", "rounds"]);
    if (!values) return { ok: false, error: DEMO_USAGE };
    const players = Number(values.bots ?? "4");
    const rounds = Number(values.rounds ?? "1");
    if (!this.between(players, 3, 8) || !this.between(rounds, 1, 10)) {
      return { ok: false, error: DEMO_USAGE };
    }
    return { ok: true, value: { players, rounds } };
  }

  play(argv: string[]): Parsed<PlayArgs> {
    const values = this.read(argv, ["bots", "name", "join", "endpoint", "api-port"]);
    if (!values) return { ok: false, error: PLAY_USAGE };
    const join = values.join === undefined ? undefined : values.join.toUpperCase();
    const bots = Number(values.bots ?? (join === undefined ? "3" : "0"));
    const name = (values.name ?? "You").trim();
    const apiPort = Number(values["api-port"] ?? DEFAULT_API_PORT);
    const endpoint = values.endpoint ?? DEFAULT_ENDPOINT;
    const valid =
      this.between(bots, 0, 7) &&
      this.between(name.length, 1, 20) &&
      this.between(apiPort, 1, 65535) &&
      URL.canParse(endpoint) &&
      (join === undefined || RoomCodeSchema.safeParse(join).success);
    if (!valid) return { ok: false, error: PLAY_USAGE };
    const usesDefaults = values.endpoint === undefined && values["api-port"] === undefined;
    return { ok: true, value: { name, bots, join, endpoint, apiPort, usesDefaults } };
  }

  private between(value: number, min: number, max: number): boolean {
    return Number.isInteger(value) && value >= min && value <= max;
  }

  private read(argv: string[], allowed: string[]): Record<string, string | undefined> | undefined {
    try {
      const { values } = parseArgs({
        args: argv,
        options: {
          bots: { type: "string" },
          rounds: { type: "string" },
          name: { type: "string" },
          join: { type: "string" },
          endpoint: { type: "string" },
          "api-port": { type: "string" },
        },
        strict: true,
        allowPositionals: false,
      });
      return Object.keys(values).every((key) => allowed.includes(key)) ? values : undefined;
    } catch {
      return undefined;
    }
  }
}
