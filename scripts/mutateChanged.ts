import ts from "typescript";

const SOURCE =
  /^(?:(?:packages|games)\/[^/]+\/src\/.+|games\/[^/]+\/(?:(?:ui|bots|terminal)\/.+|gamePackage))\.ts$/;
const ENTRY_STUB = /^games\/[^/]+\/(?:ui\/main|bots\/cli|terminal\/(?:play|demo))\.ts$/;

export const mutateTargets = (nameOnly: string): string[] =>
  nameOnly
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (path) =>
        SOURCE.test(path) &&
        !ENTRY_STUB.test(path) &&
        !path.endsWith(".d.ts") &&
        !/\.test\.ts$/.test(path),
    );

export const strykerArgs = (targets: string[]): string[] => [
  "run",
  "scripts/stryker.config.json",
  "--mutate",
  targets.join(","),
];

const tokens = (source: string): string[] => {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    source,
  );
  const out: string[] = [];
  const templateDepths: number[] = [];
  let depth = 0;
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
    if (kind === ts.SyntaxKind.OpenBraceToken) ++depth;
    if (kind === ts.SyntaxKind.CloseBraceToken) {
      if (templateDepths.at(-1) === depth) {
        templateDepths.pop();
        kind = scanner.reScanTemplateToken(false);
        if (kind === ts.SyntaxKind.TemplateMiddle) templateDepths.push(depth);
      } else {
        --depth;
      }
    }
    if (kind === ts.SyntaxKind.TemplateHead) templateDepths.push(depth);
    out.push(`${kind}:${scanner.getTokenText()}`);
  }
  return out;
};

export const codeChanged = (before: string | undefined, after: string): boolean => {
  if (before === undefined) return true;
  const a = tokens(before);
  const b = tokens(after);
  return a.length !== b.length || a.some((token, i) => token !== b[i]);
};
