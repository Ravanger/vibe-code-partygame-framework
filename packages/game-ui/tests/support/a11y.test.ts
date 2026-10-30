import { describe, expect, it } from "vitest";
import { expectNoViolations } from "./a11y.js";
import type { A11yAllowEntry } from "./a11yAllowList.js";

function mount(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

describe("expectNoViolations", () => {
  it("passes for markup without violations", async () => {
    const container = mount('<button type="button">Save</button>');
    await expectNoViolations(container, "SelfTest");
    container.remove();
  });

  it("fails with the rule id and impact when a rule fires", async () => {
    const container = mount("<button type='button'></button>");
    await expect(expectNoViolations(container, "SelfTest")).rejects.toThrow(
      /button-name \[critical\]: 1 node\(s\)/,
    );
    container.remove();
  });

  it("allows a rule for one component only", async () => {
    const entry: A11yAllowEntry = {
      rule: "button-name",
      component: "SelfTest",
      reason: "proves the allow list is scoped per component",
    };
    const container = mount("<button type='button'></button>");
    await expectNoViolations(container, "SelfTest", [entry]);
    await expect(expectNoViolations(container, "OtherComponent")).rejects.toThrow(/button-name/);
    container.remove();
  });
});
