import type { Room } from "@colyseus/core";
import type { Room as ClientRoom } from "@colyseus/sdk";
import { defineGame } from "@partygame/core";
import { BaseGameState } from "@partygame/shared/schema";
import type { GameServerOptions } from "../src/createGameServer.js";
import {
  bootTestServer,
  collectMessages,
  type TestServer,
  waitUntil,
} from "../src/testing/index.js";
import { BUZZER_PUBLIC_FIELDS, BuzzerGame, BuzzerState } from "./fixtures/buzzer.js";
import { LockedGame } from "./fixtures/locked.js";
import { POLL_PUBLIC_FIELDS, PollGame, PollState } from "./fixtures/poll.js";

/** Waits a fixed time; only for timing windows with no observable condition — prefer `waitUntil`. */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** A buzzer variant that never migrates the host (#36). */
const BuzzerNoMigrateGame = defineGame({ ...BuzzerGame, hostMigration: "none" });

export const GAMES = [
  {
    roomName: "buzzer",
    definition: BuzzerGame,
    stateClass: BuzzerState,
    publicFields: BUZZER_PUBLIC_FIELDS,
  },
  {
    roomName: "buzzer-none",
    definition: BuzzerNoMigrateGame,
    stateClass: BuzzerState,
    publicFields: BUZZER_PUBLIC_FIELDS,
  },
  {
    roomName: "locked",
    definition: LockedGame,
    stateClass: BaseGameState,
  },
];

export const bootBuzzer = (options: Partial<GameServerOptions> = {}): Promise<TestServer> =>
  bootTestServer({ games: GAMES, ...options });

const POLL_GAMES = [
  {
    roomName: "poll",
    definition: PollGame,
    stateClass: PollState,
    publicFields: POLL_PUBLIC_FIELDS,
  },
];

export const bootPoll = (options: Partial<GameServerOptions> = {}): Promise<TestServer> =>
  bootTestServer({ games: POLL_GAMES, ...options });

export const stateOf = (room: Room): BuzzerState => room.state as BuzzerState;
export const lockedStateOf = (room: Room): BaseGameState => room.state as BaseGameState;
export const pollStateOf = (room: Room): PollState => room.state as PollState;
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

export async function startedRoom(
  t: TestServer,
  options: Record<string, unknown> = {},
  roomName = "buzzer",
) {
  const room = await t.createRoom(roomName, options);
  const p1 = await seat(t, room, 1);
  const p2 = await seat(t, room, 2);
  await waitUntil(() => stateOf(room).phase === "Buzz", "game started");
  return { room, p1, p2 };
}

/** Create a poll room, seat the single player (auto-start) and wait for `Play`. */
export async function startedPoll(t: TestServer) {
  const room = await t.createRoom("poll");
  const p1 = await seat(t, room, 1);
  await waitUntil(() => pollStateOf(room).phase === "Play", "game started");
  return { room, p1 };
}
