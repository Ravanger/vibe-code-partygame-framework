import { END_GAME } from "@partygame/shared";
import type { TerminalStrategy, TerminalTurn } from "@partygame/terminal";
import { ACTION } from "../src/actionNames.js";
import { PHASE } from "../src/phaseNames.js";
import type { BluffState } from "../src/state.js";

type Turn = TerminalTurn<BluffState>;

class BluffTerminal implements TerminalStrategy<BluffState> {
  play(turn: Turn): Promise<void> {
    switch (turn.state.phase) {
      case PHASE.Writing:
        return this.writeFake(turn);
      case PHASE.Voting:
        return this.castVote(turn);
      case PHASE.Reveal:
        return this.reveal(turn);
      case PHASE.Results:
        return this.results(turn);
      default:
        return Promise.resolve();
    }
  }

  private async askLower(turn: Turn, question: string): Promise<string> {
    return (await turn.ask(question)).toLowerCase();
  }

  private async writeFake(turn: Turn): Promise<void> {
    let submitted = false;
    let waiting = false;
    while (!turn.signal.aborted) {
      if (submitted) {
        if (!waiting) turn.print("Waiting for the others...");
        waiting = true;
        await turn.changed();
        continue;
      }
      const text = await turn.ask(
        `Write a fake answer for: ${turn.state.promptText}${turn.timeLeft()} (/${turn.quitWord} quits): `,
      );
      if (text === `/${turn.quitWord}`) return turn.quit();
      if (text === "") continue;
      const sent = await turn.send(ACTION.SUBMIT_FAKE, { text }, "Fake sent.");
      if (sent) submitted = true;
    }
  }

  private async castVote(turn: Turn): Promise<void> {
    const choices = [...turn.state.choices];
    if (choices.length === 0) {
      turn.print("Nothing to vote on.");
      await turn.changed();
      return;
    }
    let i = 0;
    for (const choice of choices) {
      ++i;
      turn.print(`  ${i}) ${choice.text}`);
    }
    let waiting = false;
    while (!turn.signal.aborted) {
      if (turn.state.mine.get(turn.playerId)?.myVote) {
        if (!waiting) turn.print("Waiting for the others...");
        waiting = true;
        await turn.changed();
        continue;
      }
      const answer = await this.askLower(
        turn,
        `Vote for the real one, 1-${choices.length}${turn.timeLeft()}, ${turn.quitWord} to quit: `,
      );
      if (answer === turn.quitWord) return turn.quit();
      const chosen = choices[Number(answer) - 1];
      if (!chosen) {
        turn.print(`Enter a number from 1 to ${choices.length}.`);
        continue;
      }
      if (chosen.id === turn.state.mine.get(turn.playerId)?.myOptionId) {
        turn.print("You cannot vote for your own answer.");
        continue;
      }
      const sent = await turn.send(
        ACTION.CAST_VOTE,
        { optionId: chosen.id },
        `Voted for "${chosen.text}".`,
      );
      if (!sent) continue;
      turn.print("Waiting for the others...");
      waiting = true;
      await turn.changed();
    }
  }

  private async reveal(turn: Turn): Promise<void> {
    while (!turn.state.truthRevealedId && !turn.signal.aborted) await turn.changed();
    if (turn.signal.aborted) return;
    const truth = [...turn.state.choices].find((c) => c.id === turn.state.truthRevealedId);
    turn.print(`The truth was: ${truth?.text ?? "?"}`);
    for (const entry of [...turn.state.results]) {
      turn.print(
        `  ${entry.name}: ${entry.roundPoints} point${entry.roundPoints === 1 ? "" : "s"}`,
      );
    }
  }

  private async results(turn: Turn): Promise<void> {
    const actions: Record<string, string> = turn.isHost
      ? { a: ACTION.PLAY_AGAIN, e: END_GAME }
      : {};
    const menu = turn.isHost
      ? `[a]gain, [e]nd game or ${turn.quitWord} to quit: `
      : `Waiting for the host. ${turn.quitWord} to quit: `;
    while (!turn.signal.aborted) {
      const answer = await this.askLower(turn, menu);
      if (answer === turn.quitWord) return turn.quit();
      const type = actions[answer];
      if (type && (await turn.send(type, {}, "Done."))) return;
    }
  }
}

/** Bluff's terminal screens for `TerminalPlayer`. */
export const bluffTerminal = (): TerminalStrategy<BluffState> => new BluffTerminal();
