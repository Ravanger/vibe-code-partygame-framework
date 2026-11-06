import ts from "typescript";
import { z } from "zod";

export interface TextFile {
  path: string;
  text: string;
}

export interface ConventionViolation {
  rule: "vocabulary" | "provenance" | "decorators" | "root-files";
  path: string;
  line: number;
  message: string;
}

const VOCABULARY = /wit-?clash|matchup|categor(?:y|ies)/i;
const PROMPT = /\bprompts?\b/i;
const ROOT_FILES = new Set([
  "README.md",
  "AGENTS.md",
  "LICENSE",
  "package.json",
  "bun.lock",
  "bunfig.toml",
  "biome.json",
  "knip.json",
  "turbo.json",
  "tsconfig.base.json",
  "vitest.config.mts",
  ".gitignore",
  ".gitattributes",
  "lefthook.yml",
]);
// #14: the template-versions test pins the template's dependency ranges to the reference game's
// manifest, so it must name that game.
const VOCABULARY_EXCEPTIONS = new Set(["packages/cli/tests/templateVersions.test.ts"]);
const DECORATOR_OPTIONS = ["experimentalDecorators", "emitDecoratorMetadata"];
const TSCONFIG = /(?:^|\/)tsconfig[^/]*\.json$/;

const inside = (path: string, dir: string): boolean => path.startsWith(`${dir}/`);

const lineViolations = (
  file: TextFile,
  rule: ConventionViolation["rule"],
  pattern: RegExp,
  message: string,
): ConventionViolation[] =>
  file.text
    .split("\n")
    .flatMap((text, index) =>
      pattern.test(text) ? [{ rule, path: file.path, line: index + 1, message }] : [],
    );

const decoratorViolations = (file: TextFile): ConventionViolation[] => {
  const options = ts.parseConfigFileTextToJson(file.path, file.text).config?.compilerOptions;
  if (typeof options !== "object" || options === null) return [];
  return DECORATOR_OPTIONS.filter((name) => options[name] === true).map((name) => ({
    rule: "decorators" as const,
    path: file.path,
    line: 1,
    message: `${name} is true: decorators are forbidden`,
  }));
};

const fileViolations = (file: TextFile): ConventionViolation[] => {
  const { path } = file;
  const found: ConventionViolation[] = [];
  if (!path.includes("/") && !ROOT_FILES.has(path)) {
    found.push({
      rule: "root-files",
      path,
      line: 1,
      message: "file is not on the repo root allowlist",
    });
  }
  if (
    inside(path, "packages") &&
    !inside(path, "packages/cli/template") &&
    !VOCABULARY_EXCEPTIONS.has(path)
  ) {
    found.push(...lineViolations(file, "vocabulary", VOCABULARY, "game vocabulary in packages/"));
    if (!inside(path, "packages/terminal")) {
      found.push(...lineViolations(file, "vocabulary", PROMPT, "game vocabulary in packages/"));
    }
  }
  if (TSCONFIG.test(path)) found.push(...decoratorViolations(file));
  return found;
};

const CONTENT_FILE = /^(games\/[^/]+\/content)\/(.+)$/;
const MANIFEST = "provenance.json";

const ProvenanceManifest = z.record(
  z.string(),
  z.union([
    z.literal("original"),
    z.strictObject({ source: z.string().min(1), license: z.string().min(1) }),
  ]),
);

const provenanceViolations = (files: TextFile[]): ConventionViolation[] => {
  const trees = new Map<string, TextFile[]>();
  for (const file of files) {
    const match = CONTENT_FILE.exec(file.path);
    if (match?.[1] !== undefined) trees.set(match[1], [...(trees.get(match[1]) ?? []), file]);
  }
  return [...trees].flatMap(([tree, treeFiles]) => {
    const violation = (path: string, message: string): ConventionViolation => ({
      rule: "provenance",
      path,
      line: 1,
      message,
    });
    const manifestPath = `${tree}/${MANIFEST}`;
    const manifestFile = treeFiles.find((file) => file.path === manifestPath);
    const others = treeFiles.filter((file) => file !== manifestFile);
    if (manifestFile === undefined) {
      return others.slice(0, 1).map((file) => violation(file.path, `${tree} has no ${MANIFEST}`));
    }
    let json: unknown;
    try {
      json = JSON.parse(manifestFile.text);
    } catch {
      return [violation(manifestPath, `${MANIFEST} is not valid JSON`)];
    }
    const parsed = ProvenanceManifest.safeParse(json);
    if (!parsed.success) {
      return [violation(manifestPath, `invalid manifest: ${parsed.error.issues[0]?.message}`)];
    }
    const listed = new Set(Object.keys(parsed.data));
    const present = new Set(others.map((file) => file.path.slice(tree.length + 1)));
    return [
      ...[...listed]
        .filter((name) => !present.has(name))
        .map((name) => violation(manifestPath, `${name} has no file`)),
      ...[...present]
        .filter((name) => !listed.has(name))
        .map((name) => violation(`${tree}/${name}`, `not listed in ${MANIFEST}`)),
    ];
  });
};

export const checkConventions = (files: TextFile[]): ConventionViolation[] => [
  ...files.flatMap(fileViolations),
  ...provenanceViolations(files),
];
