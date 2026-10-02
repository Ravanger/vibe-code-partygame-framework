const ENTRIES = {
  launch: "launch.ts",
  play: "terminal/play.ts",
  bots: "bots/cli.ts",
} as const;

export type GameCommand = keyof typeof ENTRIES;

export interface FolderRecord {
  folder: string;
  /** Parsed package.json; undefined when the folder has none. */
  packageJson: unknown;
}

export interface Game {
  folder: string;
  label: string;
}

export type PickedGame =
  | { kind: "picked"; game: string; rest: string[] }
  | { kind: "ask"; games: Game[]; rest: string[] }
  | { kind: "error"; error: string };

const SCOPE = "@partygame/";

export const commandNames = (): GameCommand[] => Object.keys(ENTRIES).filter(isGameCommand);

export function isGameCommand(value: string | undefined): value is GameCommand {
  return Object.keys(ENTRIES).some((command) => command === value);
}

export const entryPath = (command: GameCommand, game: string): string =>
  `games/${game}/${ENTRIES[command]}`;

const packageName = (packageJson: unknown): string | undefined => {
  if (typeof packageJson !== "object" || packageJson === null || !("name" in packageJson)) {
    return undefined;
  }
  return typeof packageJson.name === "string" ? packageJson.name : undefined;
};

const RESERVED = ["list", ...Object.keys(ENTRIES), "dev", "host", "prod"];

/** Games are the folders that have a package.json, sorted by folder name; folders named like a command or launch mode are ignored and reported. */
export const discoverGames = (records: FolderRecord[]): { games: Game[]; ignored: string[] } => {
  const candidates = records.filter((record) => record.packageJson !== undefined);
  const games = candidates
    .filter((record) => !RESERVED.includes(record.folder))
    .map((record) => ({
      folder: record.folder,
      label: (packageName(record.packageJson) ?? record.folder).replace(SCOPE, ""),
    }))
    .sort((a, b) => a.folder.localeCompare(b.folder));
  const ignored = candidates
    .map((record) => record.folder)
    .filter((folder) => RESERVED.includes(folder));
  return { games, ignored };
};

const nameOf = (game: Game): string =>
  game.label === game.folder ? game.label : `${game.label} (${game.folder})`;

export const formatChoices = (games: Game[]): string =>
  games.map((game, index) => `  ${index + 1}. ${nameOf(game)}`).join("\n");

export const formatGameList = (
  games: Game[],
  supports: (folder: string, command: GameCommand) => boolean,
): string =>
  games
    .map((game) => {
      const commands = commandNames().filter((command) => supports(game.folder, command));
      return `${nameOf(game)}: ${commands.length > 0 ? commands.join(", ") : "no commands"}`;
    })
    .join("\n");

/** The zero-based index for an answer of 1..count, otherwise undefined. */
export const parseChoice = (input: string, count: number): number | undefined => {
  const text = input.trim();
  if (!/^\d+$/.test(text)) return undefined;
  const choice = Number(text);
  return choice >= 1 && choice <= count ? choice - 1 : undefined;
};

/** The game is the first argument when it names a folder; otherwise the only game, otherwise a prompt. */
export const pickGame = (args: string[], games: Game[], interactive: boolean): PickedGame => {
  const [first, ...tail] = args;
  if (first !== undefined && games.some((game) => game.folder === first)) {
    return { kind: "picked", game: first, rest: tail };
  }
  const [only] = games;
  if (only === undefined) return { kind: "error", error: "No games found under games/" };
  if (games.length === 1) return { kind: "picked", game: only.folder, rest: args };
  if (interactive) return { kind: "ask", games, rest: args };
  return { kind: "error", error: `Name a game:\n${formatChoices(games)}` };
};
