import { posix } from "node:path";

export interface SourceFile {
  path: string;
  imports: string[];
}

export interface Workspace {
  dir: string;
  name: string;
  dependencies: string[];
  devDependencies: string[];
  exports: string[];
  files: SourceFile[];
}

export interface Violation {
  path: string;
  rule: "manifest" | "declared" | "public-entry" | "no-escape" | "layer-purity" | "game-ui";
  detail: string;
}

const SCOPE = "@partygame/";
const CONFIG = `${SCOPE}config`;
const CLI = `${SCOPE}cli`;
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;

const LAYERS: Record<string, { runtime: string[]; dev: string[] }> = {
  shared: { runtime: [], dev: [] },
  "client-utils": { runtime: ["shared"], dev: [] },
  core: { runtime: ["shared"], dev: [] },
  server: { runtime: ["core", "shared"], dev: [] },
  "game-client": { runtime: ["client-utils", "shared"], dev: ["core", "server"] },
  "game-ui": { runtime: ["client-utils", "game-client", "shared"], dev: [] },
  bots: { runtime: ["shared"], dev: ["core", "server"] },
  terminal: { runtime: ["bots", "server", "shared"], dev: ["core"] },
  launcher: { runtime: ["bots", "server", "shared"], dev: ["core"] },
  cli: { runtime: [], dev: [] },
  config: { runtime: [], dev: [] },
};

const COLYSEUS_SERVER = ["@colyseus/core", "@colyseus/bun-websockets", "@colyseus/ws-transport"];
const PURITY: Record<string, string[]> = {
  shared: [...COLYSEUS_SERVER, "@colyseus/sdk", "svelte", "node:*"],
  core: ["@colyseus/*", "svelte", "node:*"],
  "game-client": [...COLYSEUS_SERVER, "node:*"],
  "game-ui": [...COLYSEUS_SERVER, "node:*"],
};

const GAME_UI_PACKAGES = ["game-ui", "game-client", "shared"].map((name) => SCOPE + name);
const GAME_UI_SRC = [
  "state",
  "options",
  "actions",
  "actionNames",
  "phaseNames",
  "roomName",
  "isGameOver",
];

export const importsOf = (source: string): string[] =>
  Array.from(source.matchAll(IMPORT), (match) => match[1] as string);

const packageOf = (specifier: string): string | undefined =>
  specifier.startsWith(SCOPE) ? specifier.split("/").slice(0, 2).join("/") : undefined;

const inside = (path: string, dir: string): boolean => path === dir || path.startsWith(`${dir}/`);

const forbidden = (specifier: string, patterns: string[]): boolean =>
  patterns.some((pattern) =>
    pattern.endsWith("*")
      ? specifier.startsWith(pattern.slice(0, -1))
      : specifier === pattern || specifier.startsWith(`${pattern}/`),
  );

const isGame = (workspace: Workspace): boolean => workspace.dir.startsWith("games/");

const shortName = (workspace: Workspace): string => workspace.name.replace(SCOPE, "");

const manifestViolations = (workspace: Workspace): Violation[] => {
  const path = `${workspace.dir}/package.json`;
  const violation = (detail: string): Violation => ({ path, rule: "manifest", detail });
  const layer = LAYERS[shortName(workspace)];
  if (!isGame(workspace) && layer === undefined) {
    return [violation(`${workspace.name} has no entry in LAYERS`)];
  }
  const runtime = (layer?.runtime ?? []).map((name) => SCOPE + name);
  const dev = [...runtime, ...(layer?.dev ?? []).map((name) => SCOPE + name), CONFIG];
  const allowed = (name: string, list: string[]): boolean =>
    isGame(workspace) ? name !== CLI : list.includes(name);
  const partygame = (names: string[]): string[] => names.filter((name) => name.startsWith(SCOPE));
  return [
    ...partygame(workspace.dependencies)
      .filter((name) => !allowed(name, runtime))
      .map((name) => violation(`${name} is not allowed in dependencies`)),
    ...partygame(workspace.devDependencies)
      .filter((name) => !allowed(name, dev))
      .map((name) => violation(`${name} is not allowed in devDependencies`)),
  ];
};

const fileViolations = (
  workspace: Workspace,
  file: SourceFile,
  exportsOf: Map<string, string[]>,
): Violation[] => {
  const found: Violation[] = [];
  const add = (rule: Violation["rule"], detail: string): number =>
    found.push({ path: file.path, rule, detail });
  const area = file.path.slice(workspace.dir.length + 1).split("/")[0];
  for (const specifier of file.imports) {
    const resolved = specifier.startsWith(".")
      ? posix.join(posix.dirname(file.path), specifier)
      : undefined;
    if (resolved !== undefined && !inside(resolved, workspace.dir)) {
      add("no-escape", `${specifier} leaves ${workspace.dir}`);
    }
    if (
      !isGame(workspace) &&
      (inside(resolved ?? specifier, "games") || inside(specifier, "games"))
    ) {
      add("no-escape", `${specifier} references games/`);
    }

    const target = packageOf(specifier);
    if (target !== undefined) {
      const tests = area === "tests";
      const declared = [
        ...workspace.dependencies,
        ...(tests ? [...workspace.devDependencies, CONFIG] : []),
      ];
      if (target !== workspace.name && !declared.includes(target)) {
        add(
          "declared",
          `${target} is not in ${tests ? "dependencies or devDependencies" : "dependencies"}`,
        );
      }
      const exported = exportsOf.get(target);
      const subpath = specifier.slice(target.length);
      if (subpath !== "" && exported !== undefined && !exported.includes(`.${subpath}`)) {
        add("public-entry", `${specifier} is not an export of ${target}`);
      }
    }

    if (area === "src" && forbidden(specifier, PURITY[shortName(workspace)] ?? [])) {
      add("layer-purity", `${specifier} is not allowed in ${workspace.name}`);
    }

    if (isGame(workspace) && area === "ui") {
      if (target !== undefined && !GAME_UI_PACKAGES.includes(target)) {
        add("game-ui", `${target} is not allowed in game ui`);
      }
      const src = `${workspace.dir}/src`;
      if (
        resolved !== undefined &&
        inside(resolved, src) &&
        !GAME_UI_SRC.includes(posix.relative(src, resolved).replace(/\.[jt]s$/, ""))
      ) {
        add("game-ui", `${specifier} is not an allowed src module`);
      }
    }
  }
  return found;
};

export const checkBoundaries = (workspaces: Workspace[]): Violation[] => {
  const exportsOf = new Map(workspaces.map((workspace) => [workspace.name, workspace.exports]));
  return workspaces.flatMap((workspace) => [
    ...manifestViolations(workspace),
    ...workspace.files.flatMap((file) => fileViolations(workspace, file, exportsOf)),
  ]);
};
