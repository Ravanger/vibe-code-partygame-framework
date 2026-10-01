import type { WitClashPhase } from "../private.js";
import { Round } from "../round.js";
import { TieBreakerFlow } from "../tieBreakerFlow.js";
import { answeringActions, answersComplete } from "./answering.js";

export const TieBreakerPrompting: WitClashPhase = {
  duration: (ctx) => ctx.options.promptSeconds * 1000,
  onEnter: (ctx) => new TieBreakerFlow(ctx).begin(),
  onTimeout: (ctx) => new TieBreakerFlow(ctx).finishAnswering(),
  onRosterChange: (ctx) => {
    const round = new Round(ctx);
    if (round.endIfTooFewPlayers()) return;
    round.remember();
    round.pruneDeparted();
    const flow = new TieBreakerFlow(ctx);
    if (flow.dropDeparted() || flow.endIfNoVoters()) return;
    if (answersComplete(ctx)) flow.finishAnswering();
  },
  actions: answeringActions((ctx) => new TieBreakerFlow(ctx).finishAnswering()),
};
