import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { deriveNames, RESERVED_SLUGS } from "../packages/cli/src/slug.js";
import { renderTemplate } from "../packages/cli/src/template.js";
import {
  buildArgs,
  discoverGames,
  entryPath,
  formatChoices,
  formatGameList,
  GameManifestSchema,
  isGameCommand,
  parseChoice,
  pickGame,
} from "./gameEntry.js";

const alpha = { folder: "alpha", label: "alpha", name: "alpha" };
const beta = { folder: "beta", label: "Beta Game", name: "@partygame/beta-game" };
const manifested = {
  folder: "wit-clash",
  label: "WitClash",
  name: "@partygame/wit-clash",
  description: "A word-prompt party game",
  icon: "🧠",
};

const SHIPPED_TEMPLATE = fileURLToPath(new URL("../packages/cli/template", import.meta.url));

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

  // Driven by the CLI's list: the dispatcher and the scaffolder must see the same reserved names.
  it.each(RESERVED_SLUGS)("ignores a folder named %s and reports it", (folder) => {
    expect(
      discoverGames([
        { folder, packageJson: {} },
        { folder: "alpha", packageJson: { name: "alpha" } },
      ]),
    ).toEqual({
      games: [{ folder: "alpha", label: "alpha", name: "alpha" }],
      ignored: [folder],
      manifestErrors: [],
    });
  });

  it.each([[{}], [{ name: 7 }], ["text"], [null], [[]]])(
    "falls back to the folder name for package.json %j",
    (packageJson) => {
      expect(discoverGames([{ folder: "alpha", packageJson }]).games).toEqual([
        { folder: "alpha", label: "alpha", name: "alpha" },
      ]);
    },
  );
});

describe("discoverGames manifests", () => {
  it("reads name, description and icon from the partygame key", () => {
    const result = discoverGames([
      {
        folder: "wit-clash",
        packageJson: {
          name: "@partygame/wit-clash",
          partygame: { name: "WitClash", description: "A word-prompt party game", icon: "🧠" },
        },
      },
    ]);
    expect(result.games).toEqual([manifested]);
    expect(result.manifestErrors).toEqual([]);
  });

  it("accepts a multi-code-point emoji that is one grapheme", () => {
    const result = discoverGames([
      {
        folder: "wit-clash",
        packageJson: {
          name: "@partygame/wit-clash",
          partygame: { name: "N", description: "d", icon: "👨‍👩‍👧" },
        },
      },
    ]);
    expect(result.manifestErrors).toEqual([]);
    expect(result.games[0]?.icon).toBe("👨‍👩‍👧");
  });

  it.each([
    ["a non-object manifest", "text"],
    ["an array manifest", [1]],
    ["a missing name", { description: "d", icon: "🧠" }],
    ["an empty name", { name: "", description: "d", icon: "🧠" }],
    ["a non-string description", { name: "N", description: 7, icon: "🧠" }],
    ["an empty description", { name: "N", description: "", icon: "🧠" }],
    ["a missing icon", { name: "N", description: "d" }],
    ["a non-string icon", { name: "N", description: "d", icon: 7 }],
    ["an icon of two graphemes", { name: "N", description: "d", icon: "🧠🧠" }],
    ["an icon that is not an emoji", { name: "N", description: "d", icon: "a" }],
  ])("reports %s and keeps the package-name label", (_case, partygame) => {
    const result = discoverGames([
      { folder: "wit-clash", packageJson: { name: "@partygame/wit-clash", partygame } },
    ]);
    expect(result.games).toEqual([
      { folder: "wit-clash", label: "wit-clash", name: "@partygame/wit-clash" },
    ]);
    expect(result.manifestErrors).toHaveLength(1);
    expect(result.manifestErrors[0]?.folder).toBe("wit-clash");
    expect(result.manifestErrors[0]?.problem).toMatch(/partygame/);
  });

  it("falls back to the package name and drops the rest when one manifest field is invalid", () => {
    const result = discoverGames([
      {
        folder: "wit-clash",
        packageJson: {
          name: "@partygame/wit-clash",
          partygame: { name: "WitClash", description: "d", icon: "nope" },
        },
      },
    ]);
    expect(result.games[0]?.label).toBe("wit-clash");
    expect(result.games[0]?.description).toBeUndefined();
    expect(result.games[0]?.icon).toBeUndefined();
  });

  it("lists a game with no manifest as before", () => {
    const result = discoverGames([{ folder: "alpha", packageJson: { name: "alpha" } }]);
    expect(result.games).toEqual([{ folder: "alpha", label: "alpha", name: "alpha" }]);
    expect(result.manifestErrors).toEqual([]);
  });
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

  it("shows icon and description in the choices", () => {
    expect(formatChoices([manifested])).toBe(
      "  1. 🧠 WitClash (wit-clash) — A word-prompt party game",
    );
  });

  it("shows icon and description in the list", () => {
    expect(formatGameList([manifested], () => true)).toBe(
      "🧠 WitClash (wit-clash) — A word-prompt party game: launch, play, bots",
    );
  });
});

describe("shipped template manifest", () => {
  it("scaffolds a package.json with a valid partygame manifest named after the display name", async () => {
    const names = deriveNames("word-war");
    const dest = await mkdtemp(join(tmpdir(), "manifest-"));
    try {
      await renderTemplate({ templateDir: SHIPPED_TEMPLATE, outDir: dest, names });
      const parsed = JSON.parse(await readFile(join(dest, "package.json"), "utf8")) as {
        partygame?: unknown;
      };
      expect(GameManifestSchema.parse(parsed.partygame)).toEqual({
        name: names.displayName,
        description: "A party game",
        icon: "🎮",
      });
    } finally {
      await rm(dest, { recursive: true, force: true });
    }
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
