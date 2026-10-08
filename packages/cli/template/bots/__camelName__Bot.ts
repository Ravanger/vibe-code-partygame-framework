import type { BotKit, BotStrategy, BotTurn } from "@partygame/bots";
import { ACTION } from "../src/actionNames.js";
import { PHASE } from "../src/phaseNames.js";
import { ROOM_NAME } from "../src/roomName.js";
import { __PascalName__State } from "../src/state.js";

type Turn = BotTurn<__PascalName__State>;

/** The wave game's bot brain: waves steadily until the goal is reached. */
export class __PascalName__Bot implements BotStrategy<__PascalName__State> {
  play(turn: Turn): void {
    if (turn.state.phase !== PHASE.Waving) return;
    const count = turn.state.waves.get(turn.playerId) ?? 0;
    turn.once(`wave:${count}`, () => turn.later("react", () => turn.act(ACTION.WAVE, {}, "waves")));
  }
}

/** The strategy, ready to hand to a `BotPlayer` or a bot table. */
export const __camelName__Bot = (): BotStrategy<__PascalName__State> => new __PascalName__Bot();

/** What the bot tables need to play the wave game. */
export const __camelName__Kit = (): BotKit<__PascalName__State> => ({
  roomName: ROOM_NAME,
  stateClass: __PascalName__State,
  strategy: __camelName__Bot(),
});
