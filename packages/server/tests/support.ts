import type { Room } from "@colyseus/core";
import type { Room as ClientRoom } from "@colyseus/sdk";
import type { GameServerOptions } from "../src/createGameServer.js";
import {
  bootTestServer,
  collectMessages,
  type TestServer,
  waitUntil,
} from "../src/testing/index.js";
import { BuzzerGame, BuzzerState } from "./fixtures/buzzer.js";

export const GAMES = [{ roomName: "buzzer", definition: BuzzerGame, stateClass: BuzzerState }];

export const bootBuzzer = (options: Partial<GameServerOptions> = {}): Promise<TestServer> =>
  bootTestServer({ games: GAMES, ...options });

export const stateOf = (room: Room): BuzzerState => room.state as BuzzerState;
export const clientState = (client: ClientRoom): BuzzerState =>
  client.state as unknown as BuzzerState;
export const pid = (n: number): string => `player-000${n}`;

export interface Seated {
  client: ClientRoom;
  errors: unknown[];
}

/** Join, start listening for ERROR, and send SET_NAME. */
export async function seat(t: TestServer, room: Room, n: number): Promise<Seated> {
  const client = await t.join(room, { playerId: pid(n) });
  const errors = collectMessages(client, "ERROR");
  client.send("SET_NAME", `P${n}`);
  return { client, errors };
}

export async function startedRoom(t: TestServer, options: Record<string, unknown> = {}) {
  const room = await t.createRoom("buzzer", options);
  const p1 = await seat(t, room, 1);
  const p2 = await seat(t, room, 2);
  await waitUntil(() => stateOf(room).phase === "Buzz", "game started");
  return { room, p1, p2 };
}
