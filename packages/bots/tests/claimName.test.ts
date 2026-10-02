import { BaseGameState } from "@partygame/shared/schema";
import { describe, expect, it } from "vitest";
import { claimName, type SeatRoom } from "../src/claimName.js";

describe("claimName with a scripted room", () => {
  it("ignores error payloads it cannot read, then reports the real refusal", async () => {
    const state = new BaseGameState();
    state.roomCode = "ABCD";
    let unsubscribed = false;
    let listener: (payload: unknown) => void = () => undefined;
    const room: SeatRoom = {
      state,
      onMessage: (_type, callback) => {
        listener = callback;
        return () => {
          unsubscribed = true;
        };
      },
      send: () => {
        listener("not an error");
        listener({ code: "NAME_TAKEN", message: "That name is taken" });
      },
    };
    await expect(claimName(room, "p1", "Ann")).rejects.toThrow("That name is taken");
    expect(unsubscribed).toBe(true);
  });

  it("times out when the seat never carries the name", async () => {
    const state = new BaseGameState();
    state.roomCode = "ABCD";
    const room: SeatRoom = { state, onMessage: () => () => undefined, send: () => undefined };
    await expect(claimName(room, "p1", "Ann", 30)).rejects.toThrow(
      "Timed out waiting for your name to be accepted",
    );
  });
});
