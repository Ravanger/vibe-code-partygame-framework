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
