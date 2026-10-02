import { required } from "@partygame/core";
import { END_GAME } from "@partygame/shared";
import type { TerminalStrategy, TerminalTurn } from "@partygame/terminal";
import { ACTION } from "../src/actionNames.js";
import { PHASE } from "../src/phaseNames.js";
import type { WitClashState } from "../src/state.js";
import { Narrator } from "./Narrator.js";

type Turn = TerminalTurn<WitClashState>;

class WitClashTerminal implements TerminalStrategy<WitClashState> {
  private readonly narrator = new Narrator();

  stageOf(state: WitClashState): string {
    const round = `${state.roundNumber}:${state.phase}`;
    if (state.phase === PHASE.MatchupVoting) return `${round}:${state.activeMatchupIndex}`;
    return `${round}:${state.tieBreakers.length}`;
  }

  narrate(state: WitClashState): string[] {
    return this.narrator.update(state);
  }

  play(turn: Turn): Promise<void> {
    switch (turn.state.phase) {
      case PHASE.CategorySelection:
        return this.pickCategory(turn);
      case PHASE.Prompting:
      case PHASE.TieBreakerPrompting:
        return this.answerPrompts(turn);
      case PHASE.MatchupVoting:
      case PHASE.TieBreakerVoting:
        return this.castVote(turn);
      case PHASE.Results:
        return this.results(turn);
      default:
        return Promise.resolve();
    }
  }

  private async askLower(turn: Turn, question: string): Promise<string> {
    return (await turn.ask(question)).toLowerCase();
  }

  private async pickCategory(turn: Turn): Promise<void> {
    const options = [...turn.state.categoryOptions];
    while (!turn.signal.aborted) {
      const answer = await this.askLower(
        turn,
        `Vote for a category, 1-${options.length}${turn.timeLeft()}, ${turn.quitWord} to quit: `,
      );
      if (answer === turn.quitWord) return turn.quit();
      const option = options[Number(answer) - 1];
      if (option) {
        await turn.send(
          ACTION.VOTE_CATEGORY,
          { categoryId: option.id },
          `Voted for ${option.name}.`,
        );
      } else {
        turn.print(`Enter a number from 1 to ${options.length}.`);
      }
    }
  }

  private async answerPrompts(turn: Turn): Promise<void> {
    const answered = new Set<string>();
    let typing = false;
    let waiting = false;
    while (!turn.signal.aborted) {
      const mine = turn.state.mine.get(turn.playerId);
      const open = [...(mine?.prompts ?? [])].filter(
        (prompt) => !prompt.submitted && !answered.has(prompt.matchupId),
      );
      const next = open[0];
      if (!next) {
        if (!waiting) turn.print("Waiting for the others...");
        waiting = true;
        await turn.changed();
        continue;
      }
      waiting = false;
      if (!typing) {
        typing = true;
        turn.notify(ACTION.SET_TYPING, { typing: true });
      }
      const text = await turn.ask(
        `Prompt: ${next.promptText}\nYour answer${turn.timeLeft()} (/${turn.quitWord} quits): `,
      );
      if (text === `/${turn.quitWord}`) return turn.quit();
      if (text === "") continue;
      const sent = await turn.send(
        ACTION.SUBMIT_ANSWER,
        { matchupId: next.matchupId, answer: text },
        "Answer sent.",
      );
      if (sent) answered.add(next.matchupId);
    }
  }

  private async castVote(turn: Turn): Promise<void> {
    const state = turn.state;
    const matchup =
      state.phase === PHASE.TieBreakerVoting
        ? required(state.tieBreakers[state.tieBreakers.length - 1], "tie-breaker")
        : required(state.matchups[state.activeMatchupIndex], "matchup");
    const answers = [...matchup.answers];
    let waiting = false;
    while (!turn.signal.aborted) {
      const mine = turn.state.mine.get(turn.playerId);
      if (!mine?.canVote) {
        if (!waiting) {
          turn.print(
            mine?.isOwnMatchup
              ? "You are in this one, so you wait while the others vote."
              : "You cannot vote on this one, so you wait.",
          );
        }
        waiting = true;
        await turn.changed();
        continue;
      }
      const answer = await this.askLower(
        turn,
        `Vote for 1-${answers.length}${turn.timeLeft()}, ${turn.quitWord} to quit: `,
      );
      if (answer === turn.quitWord) return turn.quit();
      const chosen = answers[Number(answer) - 1];
      if (chosen) {
        await turn.send(ACTION.CAST_VOTE, { answerId: chosen.id }, `Voted for "${chosen.text}".`);
      } else {
        turn.print(`Enter a number from 1 to ${answers.length}.`);
      }
    }
  }

  private async results(turn: Turn): Promise<void> {
    const final = turn.state.isFinalRound;
    const host = turn.isHost;
    const actions: Record<string, string> = host
      ? final
        ? { a: ACTION.PLAY_AGAIN, e: END_GAME }
        : { n: ACTION.NEXT_ROUND, e: END_GAME }
      : {};
    const menu = host
      ? final
        ? `[a]gain, [e]nd game or ${turn.quitWord} to quit: `
        : `[n]ext round, [e]nd game or ${turn.quitWord} to quit: `
      : `Waiting for the host. ${turn.quitWord} to quit: `;
    while (!turn.signal.aborted) {
      const answer = await this.askLower(turn, menu);
      if (answer === turn.quitWord) return turn.quit();
      const type = actions[answer];
      if (type && (await turn.send(type, {}, "Done."))) return;
    }
  }
}

/** WitClash's terminal screens for `TerminalPlayer`. */
export const witClashTerminal = (): TerminalStrategy<WitClashState> => new WitClashTerminal();
