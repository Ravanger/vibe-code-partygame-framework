import type { GameKitIo } from "./types.js";

/** The real process behind a one-line entry stub; tests pass their own `GameKitIo`. */
export const defaultIo = (): GameKitIo => ({
  env: process.env,
  argv: process.argv.slice(2),
  exit: process.exit,
  log: console.log,
  error: console.error,
  onSignal: (signal, handler) => {
    process.on(signal, handler);
  },
});
