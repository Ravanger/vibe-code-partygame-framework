export interface TextFile {
  path: string;
  text: string;
}

export interface ConventionViolation {
  rule: "brand" | "vocabulary" | "sessionId" | "vi.mock" | "decorators" | "root-files";
  path: string;
  line: number;
  message: string;
}

const BRAND = new RegExp(["jack", "box"].join(""), "i");
const VOCABULARY = /wit-?clash|matchup|quiplash|categor(?:y|ies)/i;
const PROMPT = /\bprompts?\b/i;
const SESSION_ID = /\bsessionId\b/;
const MOCK = /\bvi\.(?:mock|doMock)\(\s*["'`]([^"'`]*)["'`]/g;
const DECORATORS = /experimentalDecorators|emitDecoratorMetadata/;
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
]);
const SELF = new Set(["scripts/checkConventions.ts", "scripts/checkConventions.test.ts"]);

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

const mockViolations = (file: TextFile): ConventionViolation[] =>
  file.text.split("\n").flatMap((text, index) =>
    Array.from(text.matchAll(MOCK))
      .filter((match) => !(match[1] as string).startsWith("node:"))
      .map((match) => ({
        rule: "vi.mock" as const,
        path: file.path,
        line: index + 1,
        message: `vi.mock of "${match[1]}" is not a node: builtin`,
      })),
  );

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
  if (path !== "AGENTS.md") {
    found.push(...lineViolations(file, "brand", BRAND, "names a commercial brand"));
  }
  if (inside(path, "packages") && !inside(path, "packages/cli/template")) {
    found.push(...lineViolations(file, "vocabulary", VOCABULARY, "game vocabulary in packages/"));
    if (!inside(path, "packages/terminal")) {
      found.push(...lineViolations(file, "vocabulary", PROMPT, "game vocabulary in packages/"));
    }
  }
  if (SELF.has(path)) return found;
  if (/\.(?:ts|svelte)$/.test(path) && !inside(path, "packages/server")) {
    found.push(
      ...lineViolations(file, "sessionId", SESSION_ID, "sessionId outside packages/server"),
    );
  }
  if (/\.(?:ts|svelte)$/.test(path)) found.push(...mockViolations(file));
  if (/\.(?:json|ts|mts)$/.test(path)) {
    found.push(...lineViolations(file, "decorators", DECORATORS, "decorators are forbidden"));
  }
  return found;
};

export const checkConventions = (files: TextFile[]): ConventionViolation[] =>
  files.flatMap(fileViolations);
