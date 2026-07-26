// TODO: Svelte component rendering tests are skipped due to Bun + @testing-library/svelte + happy-dom incompatibility
// The @testing-library/svelte-core module accesses `document` at module load time,
// before our vitest.setup.ts can configure happy-dom globals.
// This is an upstream library issue, not a bug in our code.
// To test Svelte components, run them in a browser environment or use Node.js.

import { describe, expect, it } from "vitest";

describe.skip("App.svelte routing", () => {
  it("renders the Welcome screen, not an error, when disconnected", () => {
    // Once testing-library works: render(App, { props: { manager: fakeManager() } });
    expect(true).toBe(true);
  });

  it.todo("shows Host Game button on Welcome screen");
});
