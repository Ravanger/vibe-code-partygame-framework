import {
  type ConnectedClient,
  connectedClient as connectedClientOf,
  type FetchStub,
  fakeFetch,
  type SeatConfig,
} from "@partygame/game-client/testing";

export { addSeat, type FetchStub, type SeatConfig } from "@partygame/game-client/testing";

import { vi } from "vitest";
import { ROOM_NAME } from "../../src/roomName.js";
import { __PascalName__State } from "../../src/state.js";

/** A manager attached to an in-memory room with this client seated (name "Me" by default). */
export const connectedClient = (
  seat: SeatConfig = {},
  phase = "Lobby",
): ConnectedClient<__PascalName__State> =>
  connectedClientOf({
    stateClass: __PascalName__State,
    roomName: ROOM_NAME,
    seat,
    phase,
    setup: (state) => {
      state.minPlayers = 2;
      state.maxPlayers = 8;
      state.options = JSON.stringify({ waveGoal: 10 });
    },
  });

/** A fetch that records each URL and answers `reply` as JSON. */
export function stubFetch(reply: unknown): FetchStub {
  const stub = fakeFetch(reply);
  vi.stubGlobal("fetch", stub.fetch);
  return stub;
}
