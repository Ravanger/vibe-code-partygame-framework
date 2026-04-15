import type { GameAction } from "@partygame/shared";
import { expect, it } from "vitest";
import type { PhaseHandler } from "../src/phases/types.js";

it("should be implemented by a class", () => {
  class MockPhase implements PhaseHandler {
    handleAction(_player: string, _action: GameAction) {}
    computeVisibility() {
      return {};
    }
  }
  const handler: PhaseHandler = new MockPhase();
  expect(handler).toBeDefined();
});
