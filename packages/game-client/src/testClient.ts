import { LOBBY_PHASE } from "@partygame/shared";
import { type BaseGameState, PlayerSchema } from "@partygame/shared/schema";
import { GameConnectionManager } from "./GameConnectionManager.svelte.js";
import { StubRoom } from "./testing.js";

export interface SeatConfig {
  name?: string;
  role?: PlayerSchema["role"];
  isActive?: boolean;
  isReady?: boolean;
  isConnected?: boolean;
}

/** Seats `id` in `state.players`: defaults are a ready, active, connected player named `id`. */
export function addSeat(state: BaseGameState, id: string, config: SeatConfig = {}): PlayerSchema {
  const seat = new PlayerSchema();
  seat.id = id;
  seat.name = config.name ?? id;
  seat.role = config.role ?? "player";
  seat.isActive = config.isActive ?? true;
  seat.isReady = config.isReady ?? true;
  seat.isConnected = config.isConnected ?? true;
  state.players.set(id, seat);
  return seat;
}

export interface ConnectedClientOptions<TState extends BaseGameState> {
  stateClass: new () => TState;
  /** Default "test-room". */
  roomName?: string;
  /** This client's seat; the name defaults to "Me". */
  seat?: SeatConfig;
  /** Default `LOBBY_PHASE`. */
  phase?: string;
  /** Fill game fields before the manager attaches. */
  setup?: (state: TState) => void;
}

export interface ConnectedClient<TState extends BaseGameState> {
  manager: GameConnectionManager<TState>;
  state: TState;
  room: StubRoom<TState>;
  me: PlayerSchema;
  /** Tells the manager the state changed, as Colyseus does after a patch. */
  patch(): void;
}

/** A manager attached to a `StubRoom` around a real `TState` with this client seated; `roomCode` is "ABCD". */
export function connectedClient<TState extends BaseGameState>(
  options: ConnectedClientOptions<TState>,
): ConnectedClient<TState> {
  const manager = new GameConnectionManager<TState>({
    endpoint: "ws://localhost:2567",
    roomName: options.roomName ?? "test-room",
    storagePrefix: `test-${crypto.randomUUID()}`,
    rootSchema: options.stateClass,
  });
  const state = new options.stateClass();
  state.roomCode = "ABCD";
  state.phase = options.phase ?? LOBBY_PHASE;
  options.setup?.(state);
  const me = addSeat(state, manager.playerId, { name: "Me", ...options.seat });
  const room = new StubRoom(state);
  manager.attach(room);
  return { manager, state, room, me, patch: () => room.patch() };
}

export interface FetchStub {
  urls: string[];
  /** Install with `vi.stubGlobal("fetch", stub.fetch)`. */
  fetch: (input: RequestInfo | URL) => Promise<Response>;
}

/** A fetch that records each URL and answers `reply` as JSON; an `Error` or a string rejects. */
export function fakeFetch(reply: unknown): FetchStub {
  const urls: string[] = [];
  return {
    urls,
    fetch: async (input) => {
      urls.push(String(input instanceof Request ? input.url : input));
      if (reply instanceof Error || typeof reply === "string") throw reply;
      return new Response(JSON.stringify(reply), {
        headers: { "content-type": "application/json" },
      });
    },
  };
}
