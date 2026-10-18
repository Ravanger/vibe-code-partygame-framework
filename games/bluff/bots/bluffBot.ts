import type { BotKit, BotStrategy, BotTurn } from "@partygame/bots";
import { ACTION } from "../src/actionNames.js";
import { META } from "../src/meta.js";
import { PHASE } from "../src/phaseNames.js";
import { BluffState } from "../src/state.js";

type Turn = BotTurn<BluffState>;

/** The fakes a bot writes; plausibility is not the point, showing up is. */
const FAKES = ["The moon", "42", "A sandwich", "Tuesday", "Absolutely not"];

/** The bluff game's bot brain: writes a fake, then votes for something that is not its own. */
export class BluffBot implements BotStrategy<BluffState> {
  play(turn: Turn): void {
    const { state } = turn;
    if (state.phase === PHASE.Writing && !state.progress.get(turn.playerId)) {
      turn.once("fake", () =>
        turn.later("think", () =>
          turn.act(ACTION.SUBMIT_FAKE, { text: turn.pick(FAKES) ?? "No idea" }, "fakes"),
        ),
      );
    }
    if (state.phase === PHASE.Voting) {
      const mine = state.mine.get(turn.playerId)?.myOptionId ?? "";
      const others = [...state.choices].filter((choice) => choice.id !== mine);
      if (others.length === 0) return;
      turn.once("vote", () =>
        turn.later("react", () => {
          const choice = turn.pick(others);
          if (choice !== undefined) turn.act(ACTION.CAST_VOTE, { optionId: choice.id }, "votes");
        }),
      );
    }
  }
}

/** The strategy, ready to hand to a `BotPlayer` or a bot table. */
export const bluffBot = (): BotStrategy<BluffState> => new BluffBot();

/** What the bot tables need to play the bluff game. */
export const bluffKit = (): BotKit<BluffState> => ({
  roomName: META.roomName,
  stateClass: BluffState,
  strategy: bluffBot(),
});
