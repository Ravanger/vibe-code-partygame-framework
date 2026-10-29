import { defineGame } from "@partygame/core";
import type { BaseGameState } from "@partygame/shared/schema";
import { z } from "zod";

/** The password the Locked game's `canJoin` hook requires in `joinData`. */
export const LOCKED_PASSWORD = "sesame";

/** A single-phase game that admits only joins carrying the right password; spectators need it too. */
export const LockedGame = defineGame<BaseGameState, Record<string, never>, Record<string, unknown>>(
  {
    name: "Locked",
    version: "1",
    minPlayers: 1,
    maxPlayers: 4,
    startPhase: "Play",
    options: z.object({}),
    createPrivateState: () => ({}),
    canJoin: (input) =>
      input.joinData.password === LOCKED_PASSWORD
        ? { ok: true }
        : {
            ok: false,
            code: "NO_PASSWORD",
            message: input.spectator ? "Spectators need the password too" : "Wrong password",
          },
    phases: { Play: {} },
  },
);
