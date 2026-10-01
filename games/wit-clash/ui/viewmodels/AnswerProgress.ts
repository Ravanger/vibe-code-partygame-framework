import type { WitClashManager } from "../manager.js";

export interface ProgressRow {
  playerId: string;
  name: string;
  answered: number;
  expected: number;
  done: boolean;
  typing: boolean;
  isMe: boolean;
}

/** How many answers each answering player has handed in, and who is typing right now. */
export class AnswerProgress {
  constructor(private readonly manager: WitClashManager) {}

  get rows(): ProgressRow[] {
    const state = this.manager.state;
    const expected = state?.answersPerPlayer ?? 0;
    return [...(state?.progress.entries() ?? [])].map(([playerId, answered]) => {
      const done = expected > 0 && answered >= expected;
      return {
        playerId,
        name: state?.players.get(playerId)?.name ?? "",
        answered,
        expected,
        done,
        typing: !done && state?.typing.get(playerId) === true,
        isMe: playerId === this.manager.playerId,
      };
    });
  }
}
