import axe from "axe-core";
import { expect } from "vitest";
import { A11Y_ALLOW_LIST, type A11yAllowEntry } from "./a11yAllowList.js";

/**
 * Run axe over a rendered component and fail on any violation. `color-contrast` is disabled
 * because jsdom cannot compute it; contrast stays a game-level test (#57). Rules in
 * {@link A11Y_ALLOW_LIST} are skipped for the named component only.
 */
export async function expectNoViolations(
  container: HTMLElement,
  component: string,
  allowList: readonly A11yAllowEntry[] = A11Y_ALLOW_LIST,
): Promise<void> {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  const violations = results.violations.filter(
    (violation) =>
      !allowList.some((entry) => entry.rule === violation.id && entry.component === component),
  );
  expect(
    violations.map(
      (violation) =>
        `${violation.id} [${violation.impact ?? "unknown"}]: ${violation.nodes.length} node(s)`,
    ),
  ).toEqual([]);
}
