export interface PackageDescription {
  dir: string;
  packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  agentsMd: string | undefined;
}

const SCOPE = /@partygame\/[a-z0-9-]+/g;

const scoped = (names: string[]): Set<string> =>
  new Set(names.filter((name) => name.startsWith("@partygame/")));

const mayImportSection = (text: string): string | undefined => {
  const start = text.search(/^## May import\s*$/m);
  if (start < 0) return undefined;
  const rest = text.slice(start).split("\n").slice(1).join("\n");
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
};

export const checkAgentsFiles = (packages: PackageDescription[]): string[] => {
  const violations: string[] = [];
  for (const { dir, packageJson, agentsMd } of packages) {
    if (agentsMd === undefined) {
      violations.push(`${dir}: missing AGENTS.md`);
      continue;
    }
    const section = mayImportSection(agentsMd);
    if (section === undefined) {
      violations.push(`${dir}: AGENTS.md has no May import section`);
      continue;
    }
    const listed = new Set(section.match(SCOPE) ?? []);
    const declared = scoped([
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ]);
    for (const name of declared) {
      if (!listed.has(name)) violations.push(`${dir}: AGENTS.md May import is missing ${name}`);
    }
    for (const name of listed) {
      if (!declared.has(name)) {
        violations.push(
          `${dir}: AGENTS.md May import lists ${name}, which package.json does not depend on`,
        );
      }
    }
  }
  return violations;
};
