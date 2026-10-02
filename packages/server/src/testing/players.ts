import type { Room } from "@colyseus/core";
import type { Room as ClientRoom } from "@colyseus/sdk";
import { ClientMessage, isServerError, type ServerError, ServerMessage } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";
import { type TestServer, waitUntil } from "./index.js";

/** `player-0001` style ids that pass `PlayerIdSchema`. */
export function testPlayerId(n: number): string {
  return `player-${String(n).padStart(4, "0")}`;
}

/** The server-side room's state, checked against `stateClass`; throws when it is something else. */
export function stateOf<TState extends BaseGameState>(
  room: Room,
  stateClass: new () => TState,
): TState {
  const { state } = room;
  if (!(state instanceof stateClass)) throw new Error(`Room state is not a ${stateClass.name}`);
  return state;
}

/** Records every well-formed `ERROR` the client receives. */
export function collectErrors(client: ClientRoom): ServerError[] {
  const errors: ServerError[] = [];
  client.onMessage(ServerMessage.ERROR, (payload: unknown) => {
    if (isServerError(payload)) errors.push(payload);
  });
  return errors;
}

/** One test client seated in a room. */
export class TestPlayer<TState extends BaseGameState> {
  readonly errors: ServerError[];

  constructor(
    readonly n: number,
    readonly playerId: string,
    readonly client: ClientRoom<unknown, TState>,
  ) {
    this.errors = collectErrors(client);
  }

  /** Sends `SET_NAME`, which makes the player ready. */
  setName(name = `P${this.n}`): void {
    this.client.send(ClientMessage.SET_NAME, name);
  }

  /** Sends `ACTION { type, ...fields }`. */
  act(type: string, fields: Record<string, unknown> = {}): void {
    this.client.send(ClientMessage.ACTION, { type, ...fields });
  }
}

export interface SeatPlayersOptions<TState extends BaseGameState> {
  stateClass: new () => TState;
  count: number;
  /** Number of the first player; default 1. */
  from?: number;
  /** The first seated player (the host when the room was empty) sends START_GAME once everyone is ready. Default false. */
  start?: boolean;
}

/** Joins player `n` without a name (not ready yet). */
export async function joinPlayer<TState extends BaseGameState>(
  t: TestServer,
  room: Room,
  n: number,
  stateClass: new () => TState,
): Promise<TestPlayer<TState>> {
  const playerId = testPlayerId(n);
  const client = await t.joinAs(room, { playerId }, stateClass);
  return new TestPlayer(n, playerId, client);
}

/** Joins `count` players, names them all and waits until the server sees each one ready. */
export async function seatPlayers<TState extends BaseGameState>(
  t: TestServer,
  room: Room,
  options: SeatPlayersOptions<TState>,
): Promise<TestPlayer<TState>[]> {
  const first = options.from ?? 1;
  const players: TestPlayer<TState>[] = [];
  for (let n = first; n < first + options.count; ++n) {
    players.push(await joinPlayer(t, room, n, options.stateClass));
  }
  for (const player of players) player.setName();
  const state = stateOf(room, options.stateClass);
  await waitUntil(
    () => players.every((p) => state.players.get(p.playerId)?.isReady === true),
    "everyone named",
  );
  if (options.start) players[0]?.act("START_GAME");
  return players;
}
