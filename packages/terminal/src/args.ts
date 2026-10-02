import { parseArgs } from "node:util";
import { between, NAME_MAX_LENGTH, type Parsed, RoomCodeSchema } from "@partygame/shared";

export interface PlayArgs {
  name: string;
  bots: number;
  join: string | undefined;
  endpoint: string;
  apiPort: number;
  /** True when no endpoint or port was given, so a missing local server may be started. */
  usesDefaults: boolean;
}

export interface BotsArgs {
  code: string;
  count: number;
  endpoint: string;
  apiPort: number;
}

export interface ArgsLimits {
  maxBots: number;
  /** Returned as the error for any bad argument. */
  usage: string;
}

export const DEFAULT_ENDPOINT = "ws://localhost:2567";
export const DEFAULT_API_PORT = 3001;

const read = (
  argv: string[],
  allowed: string[],
  positionals: number,
): { values: Record<string, string | undefined>; positionals: string[] } | undefined => {
  try {
    const parsed = parseArgs({
      args: argv,
      options: {
        bots: { type: "string" },
        name: { type: "string" },
        join: { type: "string" },
        endpoint: { type: "string" },
        "api-port": { type: "string" },
      },
      strict: true,
      allowPositionals: positionals > 0,
    });
    const valid =
      parsed.positionals.length <= positionals &&
      Object.keys(parsed.values).every((key) => allowed.includes(key));
    return valid ? { values: parsed.values, positionals: parsed.positionals } : undefined;
  } catch {
    return undefined;
  }
};

/** Parses `--bots --name --join --endpoint --api-port` for a terminal play command. */
export const parsePlayArgs = (argv: string[], limits: ArgsLimits): Parsed<PlayArgs> => {
  const fail = { ok: false, error: limits.usage } as const;
  const input = read(argv, ["bots", "name", "join", "endpoint", "api-port"], 0);
  if (!input) return fail;
  const { values } = input;
  const join = values.join === undefined ? undefined : values.join.toUpperCase();
  const bots = Number(values.bots ?? (join === undefined ? "3" : "0"));
  const name = (values.name ?? "You").trim();
  const apiPort = Number(values["api-port"] ?? DEFAULT_API_PORT);
  const endpoint = values.endpoint ?? DEFAULT_ENDPOINT;
  const valid =
    between(bots, 0, limits.maxBots) &&
    between(name.length, 1, NAME_MAX_LENGTH) &&
    between(apiPort, 1, 65535) &&
    URL.canParse(endpoint) &&
    (join === undefined || RoomCodeSchema.safeParse(join).success);
  if (!valid) return fail;
  const usesDefaults = values.endpoint === undefined && values["api-port"] === undefined;
  return { ok: true, value: { name, bots, join, endpoint, apiPort, usesDefaults } };
};

/** Parses `CODE [count] --endpoint --api-port` for a command that seats bots in an existing room. */
export const parseBotsArgs = (argv: string[], limits: ArgsLimits): Parsed<BotsArgs> => {
  const fail = { ok: false, error: limits.usage } as const;
  const input = read(argv, ["endpoint", "api-port"], 2);
  if (!input) return fail;
  const code = RoomCodeSchema.safeParse((input.positionals[0] ?? "").toUpperCase());
  const count = Number(input.positionals[1] ?? "3");
  const apiPort = Number(input.values["api-port"] ?? DEFAULT_API_PORT);
  const endpoint = input.values.endpoint ?? DEFAULT_ENDPOINT;
  if (
    !code.success ||
    !between(count, 1, limits.maxBots) ||
    !between(apiPort, 1, 65535) ||
    !URL.canParse(endpoint)
  ) {
    return fail;
  }
  return { ok: true, value: { code: code.data, count, endpoint, apiPort } };
};
