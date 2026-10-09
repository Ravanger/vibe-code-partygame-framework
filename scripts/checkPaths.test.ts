import { describe, expect, it } from "vitest";
import { checkPaths, parseNameStatus } from "./checkPaths.js";

describe("checkPaths", () => {
  describe("dist/ protected files", () => {
    it("refuses changes to dist/ anywhere", () => {
      const violations = checkPaths([{ path: "packages/core/dist/index.js", status: "M" }]);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.message).toContain("dist");
    });

    it("allows changes to non-dist files", () => {
      const violations = checkPaths([{ path: "packages/core/src/index.ts", status: "M" }]);
      expect(violations).toHaveLength(0);
    });
  });

  describe("coverage/ protected files", () => {
    it("refuses changes to coverage/ anywhere", () => {
      const violations = checkPaths([{ path: "coverage/index.html", status: "M" }]);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.message).toContain("coverage");
    });

    it("allows changes to other files", () => {
      const violations = checkPaths([{ path: "README.md", status: "M" }]);
      expect(violations).toHaveLength(0);
    });
  });

  describe("node_modules/ protected files", () => {
    it("refuses changes to node_modules/ anywhere", () => {
      const violations = checkPaths([{ path: "node_modules/zod/lib/index.d.ts", status: "M" }]);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.message).toContain("node_modules");
    });

    it("allows changes to other files", () => {
      const violations = checkPaths([{ path: "packages/shared/src/index.ts", status: "M" }]);
      expect(violations).toHaveLength(0);
    });
  });

  describe(".turbo/ protected files", () => {
    it("refuses changes to .turbo/ anywhere", () => {
      const violations = checkPaths([{ path: ".turbo/turbo-lock.json", status: "M" }]);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.message).toContain(".turbo");
    });

    it("allows changes to other files", () => {
      const violations = checkPaths([{ path: "scripts/checkPaths.ts", status: "M" }]);
      expect(violations).toHaveLength(0);
    });
  });

  describe("bun.lock changes", () => {
    it("refuses bun.lock without a package.json", () => {
      const violations = checkPaths([{ path: "bun.lock", status: "M" }]);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.message).toContain("bun.lock");
    });

    it("allows bun.lock when a package.json is in the same change set", () => {
      const violations = checkPaths([
        { path: "bun.lock", status: "M" },
        { path: "package.json", status: "M" },
      ]);
      expect(violations).toHaveLength(0);
    });

    it("allows bun.lock when package.json is added", () => {
      const violations = checkPaths([
        { path: "bun.lock", status: "M" },
        { path: "package.json", status: "A" },
      ]);
      expect(violations).toHaveLength(0);
    });

    it("allows bun.lock with a workspace package.json", () => {
      const violations = checkPaths([
        { path: "bun.lock", status: "M" },
        { path: "packages/core/package.json", status: "M" },
      ]);
      expect(violations).toHaveLength(0);
    });

    it("allows package.json changes alone", () => {
      const violations = checkPaths([{ path: "package.json", status: "M" }]);
      expect(violations).toHaveLength(0);
    });
  });

  describe("multiple changes", () => {
    it("catches all violations", () => {
      const violations = checkPaths([
        { path: "packages/core/dist/index.js", status: "M" },
        { path: "packages/core/src/game.ts", status: "M" },
        { path: "bun.lock", status: "M" },
      ]);
      expect(violations).toHaveLength(2);
      expect(violations.map((v) => v.path)).toEqual(["packages/core/dist/index.js", "bun.lock"]);
    });

    it("ignores non-violations when mixed with violations", () => {
      const violations = checkPaths([
        { path: "packages/core/src/game.ts", status: "M" },
        { path: "bun.lock", status: "M" },
        { path: "package.json", status: "M" },
      ]);
      expect(violations).toHaveLength(0);
    });
  });

  it("does not treat a file named like a generated dir as one", () => {
    expect(checkPaths([{ path: "docs/dist.md", status: "M" }])).toEqual([]);
  });
});

describe("parseNameStatus", () => {
  it("reads status and path, taking the new path of a rename", () => {
    expect(parseNameStatus("M\tbun.lock\nR100\told/a.ts\tpackages/core/dist/a.ts\n\n")).toEqual([
      { status: "M", path: "bun.lock" },
      { status: "R", path: "packages/core/dist/a.ts" },
    ]);
  });

  it("returns nothing for empty output", () => {
    expect(parseNameStatus("")).toEqual([]);
  });
});
