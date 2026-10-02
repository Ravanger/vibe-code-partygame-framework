import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import {
  discoverGames,
  entryPath,
  type FolderRecord,
  formatChoices,
  formatGameList,
  type Game,
  isGameCommand,
  parseChoice,
  pickGame,
} from "./gameEntry.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const [command, ...args] = process.argv.slice(2);

const readPackageJson = (folder: string): unknown => {
  try {
    return JSON.parse(readFileSync(join(root, "games", folder, "package.json"), "utf8"));
  } catch {
    return undefined;
  }
};

const records: FolderRecord[] = readdirSync(join(root, "games"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({ folder: entry.name, packageJson: readPackageJson(entry.name) }));
const { games, ignored } = discoverGames(records);
for (const folder of ignored) console.error(`games/${folder} ignored: reserved name`);

const ask = async (choices: Game[]): Promise<string | undefined> => {
  const lines = createInterface({ input: process.stdin, output: process.stdout });
  const closed = new Promise<undefined>((done) => lines.once("close", () => done(undefined)));
  console.log(formatChoices(choices));
  try {
    for (;;) {
      const prompt = `Pick a game [1-${choices.length}]: `;
      const answer = await Promise.race([lines.question(prompt), closed]);
      if (answer === undefined || answer.trim() === "") return undefined;
      const index = parseChoice(answer, choices.length);
      if (index !== undefined) return choices[index]?.folder;
    }
  } finally {
    lines.close();
  }
};

if (command === "list") {
  console.log(
    formatGameList(games, (folder, entryCommand) =>
      existsSync(join(root, entryPath(entryCommand, folder))),
    ),
  );
  process.exit(0);
}

if (!isGameCommand(command)) {
  console.error("Usage: bun run scripts/game.ts <list|launch|play|bots> [game] [...args]");
  process.exit(2);
}

const picked = pickGame(args, games, process.stdin.isTTY === true);
if (picked.kind === "error") {
  console.error(picked.error);
  process.exit(2);
}
const game = picked.kind === "ask" ? await ask(picked.games) : picked.game;
if (game === undefined) process.exit(2);
const rest = picked.rest;

const entry = entryPath(command, game);
if (!existsSync(join(root, entry))) {
  console.error(`${game} has no ${command} entry (${entry})`);
  process.exit(2);
}

const child = spawn(process.execPath, [entry, ...rest], { cwd: root, stdio: "inherit" });
if (process.platform === "win32") {
  process.on("SIGINT", () => undefined);
  process.on("SIGTERM", () => undefined);
} else {
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}
child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
