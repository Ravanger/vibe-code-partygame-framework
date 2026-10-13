// @ts-nocheck
import { defineGamePackage } from "@partygame/game-kit";
import { __camelName__Kit } from "./bots/__camelName__Bot.js";
import { create__PascalName__Game } from "./src/game.js";
import { isGameOver } from "./src/isGameOver.js";
import { META } from "./src/meta.js";
import { PHASE } from "./src/phaseNames.js";
import { __PascalName__State } from "./src/state.js";
import { __camelName__Terminal } from "./terminal/__camelName__Terminal.js";

const board = (state: __PascalName__State): string =>
  [...state.players.values()]
    .map((player) => `${player.name}: ${state.waves.get(player.id) ?? 0}`)
    .join(", ");

let announcedResults = false;

/** The wave game declared once: the server, launch and terminal entries are stubs over this. */
export const gamePackage = defineGamePackage({
  meta: META,
  displayName: __DisplayNameJson__,
  definition: () => create__PascalName__Game(),
  stateClass: __PascalName__State,
  isFinished: isGameOver,
  botKit: __camelName__Kit(),
  terminal: __camelName__Terminal,
  demo: {
    roomOptions: { waveGoal: 5 },
    bot: { thinkMs: [300, 900], reactMs: [200, 700] },
    narrate: (state) => {
      if (state.phase === PHASE.Waving) return [`Waves — ${board(state)}`];
      if (state.phase === PHASE.Results && !announcedResults) {
        announcedResults = true;
        const winner = state.winnerName;
        return [
          winner === "" ? "Nobody waved." : `${winner} wins with ${state.winnerWaves} waves!`,
        ];
      }
      return [];
    },
    problems: (state) => {
      if (state.winnerName === "") return ["no winner was crowned"];
      const winner = [...state.players.values()].find((player) => player.name === state.winnerName);
      if (winner === undefined || state.waves.get(winner.id) !== state.winnerWaves) {
        return ["the winner's wave count does not match the board"];
      }
      return [];
    },
    passMessage: "PASS: a winner was crowned and no action was rejected",
  },
});
