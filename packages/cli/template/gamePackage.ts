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

/**
 * The wave game declared once: the server, launch and terminal entries are stubs over this.
 * `botKit` is optional: a game without bots drops it (and its `bots/` folder) and keeps serving
 * and launching; the bot entries then refuse with "This game declares no bots."
 */
export const gamePackage = defineGamePackage({
  meta: META,
  displayName: __DisplayNameJson__,
  definition: () => create__PascalName__Game(),
  stateClass: __PascalName__State,
  publicFields: ["waves", "winnerName", "winnerWaves"],
  isFinished: isGameOver,
  botKit: __camelName__Kit(),
  terminal: __camelName__Terminal,
  demo: {
    roomOptions: { waveGoal: 5 },
    bot: { thinkMs: [300, 900], reactMs: [200, 700] },
    commentator: () => {
      let announcedResults = false;
      return {
        narrate: (state) => {
          if (state.phase !== PHASE.Results) {
            // leaving Results starts a new game (or the lobby), so the last announcement is stale
            announcedResults = false;
            return state.phase === PHASE.Waving ? [`Waves — ${board(state)}`] : [];
          }
          if (announcedResults) return [];
          announcedResults = true;
          const winner = state.winnerName;
          return [
            winner === "" ? "Nobody waved." : `${winner} wins with ${state.winnerWaves} waves!`,
          ];
        },
        problems: (state) => {
          if (state.winnerName === "") return ["no winner was crowned"];
          const winner = [...state.players.values()].find(
            (player) => player.name === state.winnerName,
          );
          if (winner === undefined || state.waves.get(winner.id) !== state.winnerWaves) {
            return ["the winner's wave count does not match the board"];
          }
          return [];
        },
      };
    },
    passMessage: "PASS: a winner was crowned and no action was rejected",
  },
});
