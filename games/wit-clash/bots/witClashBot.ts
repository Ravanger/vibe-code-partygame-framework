import type { BotKit, BotStrategy, BotTurn } from "@partygame/bots";
import { ACTION } from "../src/actionNames.js";
import { PHASE } from "../src/phaseNames.js";
import { ROOM_NAME } from "../src/roomName.js";
import { type Matchup, WitClashState } from "../src/state.js";

export const BOT_ANSWERS: readonly string[] = [
  "A suspiciously large goose",
  "My neighbour's wifi password",
  "Honestly, a nap",
  "Whatever the cat knocked over",
  "Three raccoons in a trench coat",
  "Lukewarm soup",
  "The sequel nobody asked for",
  "Gravity, but optional",
  "Grandma's secret recipe",
  "An aggressively average sandwich",
  "A very polite volcano",
  "Dad, but with a cape",
  "Eleven pigeons and a spreadsheet",
  "The wrong kind of cheese",
  "A haunted toaster",
  "Exactly one sock",
  "My emotional support cactus",
  "Mild panic and a trombone",
  "A wizard who forgot his password",
  "Someone else's leftovers",
  "A tiny man in a very big hat",
  "The last slice, obviously",
  "Unlimited breadsticks",
  "A lawsuit shaped like a duck",
  "Twelve minutes of silence",
  "A raccoon with a dental plan",
  "Karaoke, but legally binding",
  "The moon, on a budget",
  "A sentient traffic cone",
  "Soup that knows too much",
  "Clearance-rack destiny",
  "A llama with opinions",
  "Whatever grandpa said it was",
  "An emergency croissant",
  "Pineapple, but evil",
  "A suspicious amount of glitter",
  "Gary from accounting",
  "A knight allergic to horses",
  "The mayor's secret mixtape",
  "Two toddlers in a hoodie",
  "Free samples, forever",
  "A very slow escape room",
  "Disappointing fireworks",
  "A ghost with a gym membership",
  "Three out of five stars",
  "The smell of a new backpack",
  "A cursed IKEA shelf",
  "Premium regret",
  "A dramatic reading of the terms and conditions",
];

export interface WitClashBotOptions {
  /** Host only: pause on a round's results before pressing Next Round. */
  nextRoundDelayMs?: number;
}

type Turn = BotTurn<WitClashState>;

/** WitClash bot brain: votes a category, writes answers, votes on matchups; as host, advances rounds. */
class WitClashBot implements BotStrategy<WitClashState> {
  constructor(private readonly options: WitClashBotOptions = {}) {}

  play(turn: Turn): void {
    const { state } = turn;
    switch (state.phase) {
      case PHASE.CategorySelection:
        this.voteCategory(turn);
        break;
      case PHASE.Prompting:
      case PHASE.TieBreakerPrompting:
        this.answer(turn);
        break;
      case PHASE.MatchupVoting:
        this.voteOn(turn, state.matchups[state.activeMatchupIndex]);
        break;
      case PHASE.TieBreakerVoting:
        this.voteOn(turn, state.tieBreakers[state.tieBreakers.length - 1]);
        break;
    }
  }

  host(turn: Turn): void {
    const { state } = turn;
    if (state.phase !== PHASE.Results || state.isFinalRound) return;
    const pause = this.options.nextRoundDelayMs ?? 0;
    turn.once(`next:${state.roundNumber}`, () =>
      turn.later([pause, pause], () => turn.act(ACTION.NEXT_ROUND)),
    );
  }

  private stage(turn: Turn): string {
    return `${turn.state.roundNumber}:${turn.state.phase}`;
  }

  private voteCategory(turn: Turn): void {
    const option = turn.pick([...turn.state.categoryOptions]);
    if (!option) return;
    turn.once(this.stage(turn), () =>
      turn.later("react", () =>
        turn.act(ACTION.VOTE_CATEGORY, { categoryId: option.id }, `votes for ${option.name}`),
      ),
    );
  }

  private answer(turn: Turn): void {
    const open = [...(turn.state.mine.get(turn.playerId)?.prompts ?? [])].filter(
      (prompt) => !prompt.submitted,
    );
    if (open.length === 0) return;
    turn.once(`${this.stage(turn)}:typing`, () =>
      turn.act(ACTION.SET_TYPING, { typing: true }, "types"),
    );
    for (const prompt of open) {
      turn.once(`${this.stage(turn)}:${prompt.matchupId}`, () =>
        turn.later("think", () =>
          turn.act(
            ACTION.SUBMIT_ANSWER,
            { matchupId: prompt.matchupId, answer: turn.pick(BOT_ANSWERS) ?? "" },
            `answers ${prompt.promptText}`,
          ),
        ),
      );
    }
  }

  private voteOn(turn: Turn, matchup: Matchup | undefined): void {
    const answer = matchup ? turn.pick([...matchup.answers]) : undefined;
    if (!matchup || !answer || !turn.state.mine.get(turn.playerId)?.canVote) return;
    turn.once(`${this.stage(turn)}:${matchup.id}`, () =>
      turn.later("react", () =>
        turn.act(ACTION.CAST_VOTE, { answerId: answer.id }, `votes for ${answer.text}`),
      ),
    );
  }
}

/** The WitClash strategy, ready to hand to a `BotPlayer` or a bot table. */
export const witClashBot = (options: WitClashBotOptions = {}): BotStrategy<WitClashState> =>
  new WitClashBot(options);

/** What the bot tables need to play WitClash. */
export const witClashKit = (options: WitClashBotOptions = {}): BotKit<WitClashState> => ({
  roomName: ROOM_NAME,
  stateClass: WitClashState,
  strategy: witClashBot(options),
});
