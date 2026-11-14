import type { GameKitIo } from "./types.js";

/** The result of a terminal argument parser: the parsed value, or the error message to print. */
type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Parses with `parse()` once or exits 2 after printing its error; the parsed value, or `undefined` after exiting. */
export const parseOrExit = <T>(io: GameKitIo, parse: () => Parsed<T>): T | undefined => {
  const result = parse();
  if (!result.ok) {
    io.error(result.error);
    io.exit(2);
    return undefined;
  }
  return result.value;
};
