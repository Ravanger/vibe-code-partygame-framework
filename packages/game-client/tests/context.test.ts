import { getContext, setContext } from "svelte";
import { describe, expect, it, type Mock, vi } from "vitest";
import { provideGameClient, useGameClient } from "../src/context.js";
import { GameClient } from "../src/GameClient.js";

vi.mock("svelte", () => ({
  setContext: vi.fn(),
  getContext: vi.fn(),
}));

describe("Context", () => {
  it("should provide and use game client", () => {
    const client = new GameClient({ roomCode: "TEST" });

    provideGameClient(client);
    expect(setContext).toHaveBeenCalled();

    (getContext as Mock).mockReturnValue(client);

    const retrieved = useGameClient();
    expect(retrieved).toBe(client);
  });
});
