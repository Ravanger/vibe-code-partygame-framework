import ts from "typescript";

export interface TextFile {
  path: string;
  text: string;
}

export interface ConventionViolation {
  rule: "brand" | "vocabulary" | "decorators" | "root-files";
  path: string;
  line: number;
  message: string;
}

const BRAND = new RegExp(["jack", "box"].join(""), "i");
const VOCABULARY = /wit-?clash|matchup|quiplash|categor(?:y|ies)/i;
const PROMPT = /\bprompts?\b/i;
const ROOT_FILES = new Set([
  "README.md",
  "AGENTS.md",
  "LICENSE",
  "package.json",
  "bun.lock",
  "biome.json",
  "knip.json",
  "turbo.json",
  "tsconfig.base.json",
  "vitest.config.mts",
  ".gitignore",
  ".gitattributes",
  "lefthook.yml",
]);
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
  found.push(...lineViolations(file, "brand", BRAND, "names a commercial brand"));
  if (inside(path, "packages") && !inside(path, "packages/cli/template")) {
    found.push(...lineViolations(file, "vocabulary", VOCABULARY, "game vocabulary in packages/"));
    if (!inside(path, "packages/terminal")) {
      found.push(...lineViolations(file, "vocabulary", PROMPT, "game vocabulary in packages/"));
    }
  }
  if (TSCONFIG.test(path)) found.push(...decoratorViolations(file));
  return found;
};

export const checkConventions = (files: TextFile[]): ConventionViolation[] =>
  files.flatMap(fileViolations);
