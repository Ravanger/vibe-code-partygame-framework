import { z } from "zod";
import { RESERVED_SLUGS } from "../packages/cli/src/slug.js";

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

/** A single emoji grapheme: exactly one `Intl.Segmenter` segment containing a pictographic code point. */
const isSingleEmoji = (value: string): boolean =>
  [...new Intl.Segmenter().segment(value)].length === 1 && /\p{Extended_Pictographic}/u.test(value);

/** The `partygame` key of a game's package.json: how the catalog shows the game (#60). */
export const GameManifestSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().refine(isSingleEmoji, "icon must be exactly one emoji"),
});

type GameManifest = z.infer<typeof GameManifestSchema>;

export interface Game {
  folder: string;
  label: string;
  name: string;
  /** From the manifest when it is valid. */
  description?: string;
  icon?: string;
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

export const buildArgs = (packageName: string): string[] => [
  "turbo",
  "run",
  "build",
  `--filter=${packageName}^...`,
];

const packageName = (packageJson: unknown): string | undefined => {
  if (typeof packageJson !== "object" || packageJson === null || !("name" in packageJson)) {
    return undefined;
  }
  return typeof packageJson.name === "string" ? packageJson.name : undefined;
};

/** One reported problem with a game's manifest. */
interface ManifestError {
  folder: string;
  problem: string;
}

/** The valid `partygame` manifest of a package.json, or its problem when one is present but invalid. */
const manifestOf = (packageJson: unknown): { manifest?: GameManifest; problem?: string } => {
  if (typeof packageJson !== "object" || packageJson === null) return {};
  const raw = (packageJson as Record<string, unknown>).partygame;
  if (raw === undefined) return {};
  const result = GameManifestSchema.safeParse(raw);
  if (result.success) return { manifest: result.data };
  return { problem: manifestProblem(result.error) };
};

const manifestProblem = (error: z.ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `partygame.${issue.path.join(".")}` : "partygame";
      return `${path}: ${issue.message}`;
    })
    .join("; ");

/** Games are the folders that have a package.json, sorted by folder name; folders named like a command or launch mode are ignored and reported. A malformed `partygame` manifest is reported in `manifestErrors` and the game falls back to its package name (#60). */
export const discoverGames = (
  records: FolderRecord[],
): {
  games: Game[];
  ignored: string[];
  manifestErrors: ManifestError[];
} => {
  const candidates = records.filter((record) => record.packageJson !== undefined);
  const manifestErrors: ManifestError[] = [];
  const games = candidates
    .filter((record) => !RESERVED_SLUGS.includes(record.folder))
    .map((record) => {
      const pkgName = packageName(record.packageJson) ?? record.folder;
      const { manifest, problem } = manifestOf(record.packageJson);
      if (problem !== undefined) manifestErrors.push({ folder: record.folder, problem });
      return {
        folder: record.folder,
        label: manifest?.name ?? pkgName.replace(SCOPE, ""),
        name: pkgName,
        ...(manifest === undefined
          ? {}
          : { description: manifest.description, icon: manifest.icon }),
      };
    })
    .sort((a, b) => a.folder.localeCompare(b.folder));
  const ignored = candidates
    .map((record) => record.folder)
    .filter((folder) => RESERVED_SLUGS.includes(folder));
  return { games, ignored, manifestErrors };
};

const nameOf = (game: Game): string => {
  const base = game.label === game.folder ? game.label : `${game.label} (${game.folder})`;
  return game.icon !== undefined ? `${game.icon} ${base}` : base;
};

/** The catalog line for a game: icon and name, plus the description when the manifest provides one. */
const titleOf = (game: Game): string =>
  game.description !== undefined ? `${nameOf(game)} — ${game.description}` : nameOf(game);

export const formatChoices = (games: Game[]): string =>
  games.map((game, index) => `  ${index + 1}. ${titleOf(game)}`).join("\n");

export const formatGameList = (
  games: Game[],
  supports: (folder: string, command: GameCommand) => boolean,
): string =>
  games
    .map((game) => {
      const commands = commandNames().filter((command) => supports(game.folder, command));
      return `${titleOf(game)}: ${commands.length > 0 ? commands.join(", ") : "no commands"}`;
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
