import type { GameKitIo } from "./types.js";

export const failWith = (io: GameKitIo, error: unknown): void => {
  io.error(error instanceof Error ? error.message : String(error));
  io.exit(1);
};
