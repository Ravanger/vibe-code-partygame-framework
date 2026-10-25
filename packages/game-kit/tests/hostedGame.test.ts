import { describe, expect, it, vi } from "vitest";
import { hostedGame } from "../src/index.js";
import { TAP_ROOM, TapGame, TapState, tapKit } from "./fixtures/tapGame.js";

describe("hostedGame", () => {
  it("builds the HostedGame from the meta and the loaded content", () => {
    const definition = vi.fn((_content: string) => TapGame);
    const hosted = hostedGame(
      {
        meta: { roomName: TAP_ROOM, minPlayers: 2, maxPlayers: 6 },
        definition,
        stateClass: TapState,
        isFinished: () => true,
        botKit: tapKit(),
      },
      "content",
    );
    expect(hosted.roomName).toBe(TAP_ROOM);
    expect(hosted.stateClass).toBe(TapState);
    expect(hosted.definition).toBe(TapGame);
    expect(definition).toHaveBeenCalledWith("content");
    expect(hosted.publicFields).toBeUndefined();
  });

  it("passes the declaration's publicFields through to the hosted game", () => {
    const definition = vi.fn(() => TapGame);
    const hosted = hostedGame(
      {
        meta: { roomName: TAP_ROOM, minPlayers: 2, maxPlayers: 6 },
        definition,
        stateClass: TapState,
        publicFields: ["taps", "done"],
        isFinished: () => true,
        botKit: tapKit(),
      },
      undefined,
    );
    expect(hosted.publicFields).toEqual(["taps", "done"]);
  });
});
