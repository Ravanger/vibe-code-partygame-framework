import { describe, expect, it } from "vitest";
import {
  buildArgs,
  discoverGames,
  entryPath,
  formatChoices,
  formatGameList,
  isGameCommand,
  parseChoice,
  pickGame,
} from "./gameEntry.js";

const alpha = { folder: "alpha", label: "alpha", name: "alpha" };
const beta = { folder: "beta", label: "Beta Game", name: "@partygame/beta-game" };

describe("buildArgs", () => {
  it("returns turbo arguments for building package dependencies", () => {
    expect(buildArgs("@partygame/wit-clash")).toEqual([
      "turbo",
      "run",
      "build",
      "--filter=@partygame/wit-clash^...",
    ]);
  });

  it("works with simple package names", () => {
    expect(buildArgs("alpha")).toEqual(["turbo", "run", "build", "--filter=alpha^..."]);
  });
});

describe("discoverGames", () => {
  it("keeps folders with a package.json, sorted, labelled by package name without the scope", () => {
    const { games } = discoverGames([
      { folder: "zed", packageJson: { name: "@partygame/zed-game" } },
      { folder: "notes", packageJson: undefined },
      { folder: "alpha", packageJson: { name: "alpha" } },
    ]);
    expect(games).toEqual([
      { folder: "alpha", label: "alpha", name: "alpha" },
      { folder: "zed", label: "zed-game", name: "@partygame/zed-game" },
    ]);
  });

  it.each(["list", "launch", "play", "bots", "dev", "host", "prod"])(
    "ignores a folder named %s and reports it",
    (folder) => {
      expect(
        discoverGames([
          { folder, packageJson: {} },
          { folder: "alpha", packageJson: { name: "alpha" } },
        ]),
      ).toEqual({
        games: [{ folder: "alpha", label: "alpha", name: "alpha" }],
        ignored: [folder],
      });
    },
  );

  it.each([[{}], [{ name: 7 }], ["text"], [null], [[]]])(
    "falls back to the folder name for package.json %j",
    (packageJson) => {
      expect(discoverGames([{ folder: "alpha", packageJson }]).games).toEqual([
        { folder: "alpha", label: "alpha", name: "alpha" },
      ]);
    },
  );
});

describe("pickGame", () => {
  it("takes the first argument when it names a game", () => {
    expect(pickGame(["beta", "dev", "--demo"], [alpha, beta], false)).toEqual({
      kind: "picked",
      game: "beta",
      rest: ["dev", "--demo"],
    });
  });

  it("uses the only game otherwise", () => {
    expect(pickGame(["dev"], [alpha], false)).toEqual({
      kind: "picked",
      game: "alpha",
      rest: ["dev"],
    });
    expect(pickGame([], [alpha], true)).toEqual({ kind: "picked", game: "alpha", rest: [] });
  });

  it("asks when several games exist and a person is at the terminal", () => {
    expect(pickGame(["dev"], [alpha, beta], true)).toEqual({
      kind: "ask",
      games: [alpha, beta],
      rest: ["dev"],
    });
  });

  it("fails with the choices when several games exist and nobody can answer", () => {
    expect(pickGame(["dev"], [alpha, beta], false)).toEqual({
      kind: "error",
      error: `Name a game:\n${formatChoices([alpha, beta])}`,
    });
  });

  it("fails when there are no games", () => {
    expect(pickGame([], [], true)).toEqual({ kind: "error", error: "No games found under games/" });
  });
});

describe("parseChoice", () => {
  it.each([
    ["1", 2, 0],
    [" 2 ", 2, 1],
  ])("accepts %j of %i as index %i", (input, count, index) => {
    expect(parseChoice(input, count)).toBe(index);
  });

  it.each([["0"], ["3"], ["x"], [""], ["1.5"], ["-1"]])("rejects %j", (input) => {
    expect(parseChoice(input, 2)).toBeUndefined();
  });
});

describe("formatting", () => {
  it("numbers the choices and shows the folder when the label differs", () => {
    expect(formatChoices([alpha, beta])).toBe("  1. alpha\n  2. Beta Game (beta)");
  });

  it("lists each game with the commands it supports", () => {
    const list = formatGameList([alpha, beta], (folder, command) =>
      folder === "alpha" ? command !== "bots" : false,
    );
    expect(list).toBe("alpha: launch, play\nBeta Game (beta): no commands");
  });
});

describe("entryPath", () => {
  it("maps each command to its entry file", () => {
    expect(entryPath("launch", "alpha")).toBe("games/alpha/launch.ts");
    expect(entryPath("play", "alpha")).toBe("games/alpha/terminal/play.ts");
    expect(entryPath("bots", "alpha")).toBe("games/alpha/bots/cli.ts");
  });
});

describe("isGameCommand", () => {
  it("accepts the known commands only", () => {
    expect(isGameCommand("launch")).toBe(true);
    expect(isGameCommand("play")).toBe(true);
    expect(isGameCommand("bots")).toBe(true);
    expect(isGameCommand("demo")).toBe(false);
    expect(isGameCommand(undefined)).toBe(false);
  });
});
