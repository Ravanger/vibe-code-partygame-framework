import type { GameKitIo } from "../../src/index.js";

export const fakeIo = (argv: string[], over: Partial<GameKitIo> = {}) => {
  const log: string[] = [];
  const err: string[] = [];
  const exits: number[] = [];
  const io: GameKitIo = {
    env: {},
    argv,
    exit: (code) => void exits.push(code),
    log: (line) => void log.push(line),
    error: (line) => void err.push(line),
    onSignal: () => {},
    prompter: () => {
      throw new Error("no prompter in this test");
    },
    startServer: () => Promise.reject(new Error("no server starter in this test")),
    runLauncher: () => Promise.reject(new Error("no launcher in this test")),
    ...over,
  };
  return { io, log, err, exits };
};
