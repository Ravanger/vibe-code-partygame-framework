import {
  type ConnectedClient,
  connectedClient as connectedClientOf,
  type FetchStub,
  fakeFetch,
  type SeatConfig,
} from "@partygame/game-client/testing";

export { addSeat, type FetchStub, type SeatConfig } from "@partygame/game-client/testing";

import { vi } from "vitest";
import { META } from "../../src/meta.js";
import { BluffState } from "../../src/state.js";

/** A manager attached to an in-memory room with this client seated (name "Me" by default). */
export const connectedClient = (
  seat: SeatConfig = {},
  phase = "Lobby",
): ConnectedClient<BluffState> =>
  connectedClientOf({
    stateClass: BluffState,
    roomName: META.roomName,
    seat,
    phase,
    setup: (state) => {
      state.minPlayers = META.minPlayers;
      state.maxPlayers = META.maxPlayers;
      state.options = JSON.stringify({ rounds: 3 });
    },
  });

/** A fetch that records each URL and answers `reply` as JSON. */
export function stubFetch(reply: unknown): FetchStub {
  const stub = fakeFetch(reply);
  vi.stubGlobal("fetch", stub.fetch);
  return stub;
}
