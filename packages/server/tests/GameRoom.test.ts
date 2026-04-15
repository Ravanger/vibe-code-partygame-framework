import { createAction, createPhase, defineGame } from "@partygame/core";
import { describe, expect, it, vi } from "vitest";
import { GameRoom } from "../src/rooms/GameRoom.js";
import { PlayerSchema } from "../src/schema/PlayerSchema.js";

describe("GameRoom Action Routing", () => {
  it("prevents players from performing host-only actions", async () => {
    const game = defineGame({
      name: "role-test",
      minPlayers: 1,
      maxPlayers: 2,
      initialState: () => ({}),
      phases: {
        lobby: createPhase({
          actions: {
            hostAction: createAction({
              from: "host",
              handler: () => {},
            }),
          },
        }),
      },
    });

    const room = new GameRoom();
    room.setDefinition(game);
    room.onCreate();

    const player = new PlayerSchema();
    player.role = "player";
    room.state.players.set("player-id", player);

    // Mock the machine send
    // @ts-ignore
    room.machine = { send: () => {} };
    const sendSpy = vi.spyOn(room.machine, "send");

    const client = { sessionId: "player-id" };
    // @ts-ignore
    room.onMessage("ACTION", client, { name: "hostAction", data: {} });

    expect(sendSpy).not.toHaveBeenCalled();
  });
});
