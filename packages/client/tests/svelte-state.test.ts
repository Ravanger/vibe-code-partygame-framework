import { expect, it } from "vitest";

it("should import state", async () => {
  const state = await import("../src/state.svelte.js");
  expect(state).toBeDefined();
});
