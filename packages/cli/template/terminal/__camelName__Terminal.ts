import { END_GAME } from "@partygame/shared";
import type { TerminalStrategy, TerminalTurn } from "@partygame/terminal";
import { ACTION } from "../src/actionNames.js";
import { PHASE } from "../src/phaseNames.js";
import type { __PascalName__State } from "../src/state.js";

type Turn = TerminalTurn<__PascalName__State>;

class __PascalName__Terminal implements TerminalStrategy<__PascalName__State> {
  play(turn: Turn): Promise<void> {
    switch (turn.state.phase) {
      case PHASE.Waving:
        return this.wave(turn);
      case PHASE.Results:
        return this.results(turn);
      default:
        return Promise.resolve();
    }
  }

  private async wave(turn: Turn): Promise<void> {
    while (!turn.signal.aborted) {
      const mine = turn.state.waves.get(turn.playerId) ?? 0;
      const answer = (
        await turn.ask(`You have waved ${mine} times. Enter to wave, ${turn.quitWord} quits: `)
      ).toLowerCase();
      if (answer === turn.quitWord) return turn.quit();
      if (await turn.send(ACTION.WAVE, {}, "Waved!")) await turn.changed();
    }
  }

  private async results(turn: Turn): Promise<void> {
    const winner = turn.state.winnerName;
    turn.print(
      winner === "" ? "Nobody waved." : `${winner} wins with ${turn.state.winnerWaves} waves!`,
    );
    const menu = turn.isHost
      ? `[a]gain, [e]nd game or ${turn.quitWord} to quit: `
      : `Waiting for the host. ${turn.quitWord} to quit: `;
    while (!turn.signal.aborted) {
      const answer = (await turn.ask(menu)).toLowerCase();
      if (answer === turn.quitWord) return turn.quit();
      const type = turn.isHost
        ? answer === "a"
          ? ACTION.PLAY_AGAIN
          : answer === "e"
            ? END_GAME
            : undefined
        : undefined;
      if (type && (await turn.send(type, {}, "Done."))) return;
    }
  }
}

/** The wave game's terminal screens for `TerminalPlayer`. */
export const __camelName__Terminal = (): TerminalStrategy<__PascalName__State> =>
  new __PascalName__Terminal();
