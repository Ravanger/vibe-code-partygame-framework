import { ErrorCode } from "@partygame/shared";
import { z } from "zod";
import {
  type ActionLog,
  actionFactory,
  actionLogMiddleware,
  defineGame,
  getActionLog,
  type PhaseMiddleware,
  type PhaseState,
} from "../../src/index.js";
import { TestTable } from "../../src/testing/TestTable.js";

export interface LoggedState extends PhaseState {
  pings: number[];
}
export interface LoggedPriv {
  secret: string;
}
export interface LoggedOptions {
  rounds: number;
}

const action = actionFactory<LoggedState, LoggedPriv, LoggedOptions>();

/** A timed Play phase with custom and built-in actions, and an un-timed Score. */
export const loggedDefinition = defineGame<LoggedState, LoggedPriv, LoggedOptions>({
  name: "LoggedPlay",
  version: "1",
  minPlayers: 1,
  maxPlayers: 4,
  startPhase: "Play",
  createPrivateState: () => ({ secret: "s" }),
  phases: {
    Play: {
      duration: 1000,
      onTimeout: (ctx) => ctx.transition("Score"),
      actions: {
        PING: action({
          from: "player",
          payload: z.object({ n: z.number() }),
          handler: (ctx) => {
            ctx.state.pings.push(ctx.payload.n);
          },
        }),
        REJECT_ME: action({
          from: "player",
          payload: z.object({}),
          handler: (ctx) => {
            ctx.reject(ErrorCode.NOT_ALLOWED, "nope");
          },
        }),
      },
    },
    Score: {},
  },
});

export const newLoggedState = (): LoggedState => ({
  phase: "",
  phaseEndsAt: 0,
  canStart: false,
  pings: [],
});

export class LoggedTable extends TestTable<LoggedState, LoggedPriv, LoggedOptions> {
  constructor(
    middleware: PhaseMiddleware<LoggedState, LoggedPriv, LoggedOptions>[] = [actionLogMiddleware()],
  ) {
    super({
      definition: { ...loggedDefinition, middleware },
      state: newLoggedState(),
      options: { rounds: 2 },
      players: 2,
    });
  }

  log(): ActionLog | undefined {
    return getActionLog(this.priv);
  }
}
