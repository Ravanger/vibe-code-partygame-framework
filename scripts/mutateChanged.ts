const SOURCE = /^(?:packages|games)\/[^/]+\/src\/.+\.ts$/;

export const mutateTargets = (nameOnly: string): string[] =>
  nameOnly
    .split("\n")
    .map((line) => line.trim())
    .filter((path) => SOURCE.test(path) && !path.endsWith(".d.ts") && !/\.test\.ts$/.test(path));

export const strykerArgs = (targets: string[]): string[] => [
  "run",
  "scripts/stryker.config.json",
  "--mutate",
  targets.join(","),
];
