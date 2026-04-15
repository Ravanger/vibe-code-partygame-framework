import { createAction, createPhase, defineGame } from "@partygame/core";
import { describe, expect, it, vi } from "vitest";
import { PlayerSchema } from "../src/schema/PlayerSchema.js";

const addViewMock = vi.fn();

vi.mock("../src/rooms/RoleBasedStateView.js", () => ({
  RoleBasedStateView: class MockRoleBasedStateView {
    constructor() {
      addViewMock();
    }
  },
}));

import { GameRoom } from "../src/rooms/GameRoom.js";

type ActionMessage = { name: string; data: unknown };
type ActionHandler = (
  client: { sessionId: string; send?: ReturnType<typeof vi.fn> },
  message: ActionMessage,
) => void;

describe("GameRoom Unit Action Routing", () => {
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
            handler: vi.fn(),
          }),
          playerAction: createAction({
            from: "player",
            handler: vi.fn(),
          }),
        },
      }),
    },
  });

  function setupRoom() {
    addViewMock.mockClear();

    const room = new GameRoom();
    room.setDefinition(game);

    let actionHandler: ActionHandler | undefined;
    vi.spyOn(room, "onMessage").mockImplementation(((type: string | number, callback: unknown) => {
      if (type === "ACTION") {
        actionHandler = callback as ActionHandler;
      }
      return room;
    }) as never);

    room.onCreate();
    // @ts-ignore
    room.machine.send = vi.fn();

    return { room, actionHandler: actionHandler as ActionHandler };
  }

  it("enforces role-based action routing", () => {
    const { room, actionHandler } = setupRoom();

    const player = new PlayerSchema();
    player.role = "player";
    room.state.players.set("player-id", player);

    const host = new PlayerSchema();
    host.role = "host";
    room.state.players.set("host-id", host);

    const client = { sessionId: "player-id", send: vi.fn() };
    actionHandler(client, { name: "hostAction", data: {} });

    // @ts-ignore
    expect(room.machine.send).not.toHaveBeenCalled();
    expect(client.send).toHaveBeenCalledWith("ERROR", {
      code: "UNAUTHORIZED",
      message: "Forbidden",
    });
  });

  it("allows players to perform player-only actions", () => {
    const { room, actionHandler } = setupRoom();

    const player = new PlayerSchema();
    player.role = "player";
    room.state.players.set("player-id", player);

    const client = { sessionId: "player-id", send: vi.fn() };
    actionHandler(client, { name: "playerAction", data: { answer: "value" } });

    // @ts-ignore
    expect(room.machine.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ACTION",
        phase: "lobby",
        name: "playerAction",
        clientId: "player-id",
        role: "player",
        data: { answer: "value" },
      }),
    );
  });

  it("ignores actions from unknown players", () => {
    const { room, actionHandler } = setupRoom();

    const client = {
      sessionId: "missing-player",
      send: vi.fn(),
    };

    actionHandler(client, { name: "playerAction", data: {} });

    // @ts-ignore
    expect(room.machine.send).not.toHaveBeenCalled();
    expect(client.send).not.toHaveBeenCalled();
  });

  it("ignores actions when the current phase is not defined", () => {
    const { room, actionHandler } = setupRoom();

    const player = new PlayerSchema();
    player.role = "player";
    room.state.players.set("player-id", player);
    room.state.phase = "missing-phase";

    const client = { sessionId: "player-id", send: vi.fn() };

    actionHandler(client, { name: "playerAction", data: {} });

    // @ts-ignore
    expect(room.machine.send).not.toHaveBeenCalled();
  });

  it("ignores actions that are not defined for the phase", () => {
    const { room, actionHandler } = setupRoom();

    const player = new PlayerSchema();
    player.role = "player";
    room.state.players.set("player-id", player);

    const client = { sessionId: "player-id", send: vi.fn() };

    actionHandler(client, { name: "missingAction", data: {} });

    // @ts-ignore
    expect(room.machine.send).not.toHaveBeenCalled();
  });

  it("creates a role-based view for joining players", () => {
    const room = new GameRoom();
    room.setDefinition(game);
    room.onCreate();

    const player = new PlayerSchema();
    player.role = "player";
    room.state.players.set("player-id", player);

    const client = { sessionId: "player-id" };
    room.onJoin(client as never);

    expect(client).toHaveProperty("view");
    expect(addViewMock).toHaveBeenCalledTimes(1);
  });

  it("does not attach a view for unknown joining players", () => {
    const room = new GameRoom();
    room.setDefinition(game);
    room.onCreate();

    const client = { sessionId: "missing-player" };
    room.onJoin(client as never);

    expect(client).not.toHaveProperty("view");
  });
});
