import type { LogFields, Logger } from "@partygame/core";

/**
 * The default structured logger: one JSON object per line — `{ ts, level, event, ...fields }` —
 * written through `write`, which by default appends a newline to stdout. Field values are strings,
 * numbers or booleans (see the framework guide's Logging section); `ts`, `level` and `event` are
 * reserved and win over same-named fields. Pass any other `Logger` to `GameServerOptions.logger`
 * to route lines elsewhere (for example pino).
 */
export function jsonLineLogger(
  write: (line: string) => void = (line) => {
    process.stdout.write(`${line}\n`);
  },
): Logger {
  const emit = (level: "info" | "warn" | "error", event: string, fields?: LogFields): void => {
    write(JSON.stringify({ ...(fields ?? {}), ts: Date.now(), level, event }));
  };
  return {
    info: (event, fields) => emit("info", event, fields),
    warn: (event, fields) => emit("warn", event, fields),
    error: (event, fields) => emit("error", event, fields),
  };
}
