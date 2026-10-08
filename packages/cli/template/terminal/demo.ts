import { DemoRun } from "@partygame/terminal";
import { __camelName__Kit } from "../bots/__camelName__Bot.js";
import { __camelName__Game } from "../src/hostedGame.js";
import { PHASE } from "../src/phaseNames.js";
import { MAX_PLAYERS, MIN_PLAYERS } from "../src/playerLimits.js";
import type { __PascalName__State } from "../src/state.js";

const USAGE = `Usage: bun run demo [--bots=${MIN_PLAYERS - 1}..${MAX_PLAYERS - 1}]`;

const flag = process.argv.slice(2).find((arg) => arg.startsWith("--bots="));
const bots = flag === undefined ? 3 : Number(flag.split("=")[1]);
if (!Number.isInteger(bots) || bots < MIN_PLAYERS - 1 || bots > MAX_PLAYERS - 1) {
  console.error(USAGE);
  process.exit(2);
}

const board = (state: __PascalName__State): string =>
  [...state.players.values()]
    .map((player) => `${player.name}: ${state.waves.get(player.id) ?? 0}`)
    .join(", ");

let announcedResults = false;

const passed = await new DemoRun<__PascalName__State>({
  games: [__camelName__Game()],
  kit: __camelName__Kit(),
  bots,
  roomOptions: { waveGoal: 5 },
  bot: { thinkMs: [300, 900], reactMs: [200, 700], log: console.log },
  finished: (state) => state.phase === PHASE.Results,
  narrate: (state) => {
    if (state.phase === PHASE.Waving) return [`Waves — ${board(state)}`];
    if (state.phase === PHASE.Results && !announcedResults) {
      announcedResults = true;
      const winner = state.winnerName;
      return [winner === "" ? "Nobody waved." : `${winner} wins with ${state.winnerWaves} waves!`];
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
  out: console.log,
}).run();

process.exit(passed ? 0 : 1);
