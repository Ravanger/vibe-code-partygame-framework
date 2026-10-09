import { describe, expect, it } from "vitest";
import { checkAgentsFiles, type PackageDescription } from "./checkAgentsFiles.js";

const agents = (mayImport: string) =>
  `# x\n\n## Responsibility\n\nOne.\n\n## May import\n\n${mayImport}\n\n## Tests\n\nHere \`@partygame/other\`.\n`;

const pkg = (over: Partial<PackageDescription>): PackageDescription => ({
  dir: "packages/a",
  packageJson: {
    dependencies: { "@partygame/shared": "workspace:*", zod: "^4" },
    devDependencies: { "@partygame/config": "workspace:*" },
  },
  agentsMd: agents("Runtime: `@partygame/shared`.\nDev: `@partygame/config`."),
  ...over,
});

describe("checkAgentsFiles", () => {
  it("passes when the May import list matches the package.json deps and devDeps", () => {
    expect(checkAgentsFiles([pkg({})])).toEqual([]);
  });

  it("reports a missing AGENTS.md", () => {
    expect(checkAgentsFiles([pkg({ agentsMd: undefined })])).toEqual([
      "packages/a: missing AGENTS.md",
    ]);
  });

  it("reports a dependency that May import does not list", () => {
    const extra = pkg({
      packageJson: {
        dependencies: { "@partygame/shared": "x", "@partygame/core": "x" },
        devDependencies: { "@partygame/config": "x" },
      },
    });
    expect(checkAgentsFiles([extra])).toEqual([
      "packages/a: AGENTS.md May import is missing @partygame/core",
    ]);
  });

  it("reports a listed package that is not a dependency", () => {
    const listed = pkg({
      agentsMd: agents("`@partygame/shared` `@partygame/config` `@partygame/server`"),
    });
    expect(checkAgentsFiles([listed])).toEqual([
      "packages/a: AGENTS.md May import lists @partygame/server, which package.json does not depend on",
    ]);
  });

  it("treats absent dependency maps as empty", () => {
    const none = pkg({ packageJson: {}, agentsMd: agents("None.") });
    expect(checkAgentsFiles([none])).toEqual([]);
  });

  it("reports a missing May import section", () => {
    const noSection = pkg({ agentsMd: "# x\n\n## Responsibility\n\nOne.\n" });
    expect(checkAgentsFiles([noSection])).toContain(
      "packages/a: AGENTS.md has no May import section",
    );
  });

  it("reads May import up to the end of the file when it is the last section", () => {
    const last = pkg({ agentsMd: "## May import\n\n`@partygame/shared` `@partygame/config`" });
    expect(checkAgentsFiles([last])).toEqual([]);
  });

  it("collects violations across packages", () => {
    const result = checkAgentsFiles([
      pkg({ agentsMd: undefined }),
      pkg({ dir: "b", agentsMd: undefined }),
    ]);
    expect(result).toHaveLength(2);
  });
});
