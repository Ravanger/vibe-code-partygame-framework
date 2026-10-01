import { GameConnectionManager } from "@partygame/game-client";
import { StubRoom } from "@partygame/game-client/testing";
import { PlayerSchema } from "@partygame/shared/schema";
import { vi } from "vitest";
import { ROOM_NAME } from "../../src/roomName.js";
import {
  Answer,
  CategoryOption,
  Matchup,
  PlayerPrivate,
  PromptAssignment,
  ScoreEntry,
  WitClashState,
} from "../../src/state.js";

let clients = 0;

export interface SeatConfig {
  name?: string;
  role?: "host" | "player";
  isActive?: boolean;
  isReady?: boolean;
  isConnected?: boolean;
}

export function addSeat(state: WitClashState, id: string, config: SeatConfig = {}): PlayerSchema {
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

export function addMine(
  state: WitClashState,
  id: string,
  over: Partial<PlayerPrivate> = {},
): PlayerPrivate {
  const mine = Object.assign(new PlayerPrivate(), over);
  state.mine.set(id, mine);
  return mine;
}

export function prompt(matchupId: string, promptText: string, submitted = false): PromptAssignment {
  return Object.assign(new PromptAssignment(), { matchupId, promptText, submitted });
}

export function option(id: string, votes = 0): CategoryOption {
  return Object.assign(new CategoryOption(), { id, name: `Name ${id}`, emoji: "E", votes });
}

export function answer(id: string, text: string, over: Partial<Answer> = {}): Answer {
  return Object.assign(new Answer(), { id, text, ...over });
}

export function matchup(
  id: string,
  promptText: string,
  answers: Answer[],
  over: Partial<Matchup> = {},
): Matchup {
  const made = Object.assign(new Matchup(), { id, promptText, ...over });
  for (const a of answers) made.answers.push(a);
  return made;
}

export function scoreRow(
  playerId: string,
  score: number,
  over: Partial<ScoreEntry> = {},
): ScoreEntry {
  return Object.assign(new ScoreEntry(), { playerId, name: playerId, score, ...over });
}

export interface Client {
  manager: GameConnectionManager<WitClashState>;
  state: WitClashState;
  room: StubRoom<WitClashState>;
  me: PlayerSchema;
  /** Tells the manager the state changed, as Colyseus does after applying a patch. */
  patch(): void;
}

/** A manager attached to an in-memory room whose state is a real WitClashState with this client seated. */
export function connectedClient(seat: SeatConfig = {}, phase = "Lobby"): Client {
  const manager = new GameConnectionManager<WitClashState>({
    endpoint: "ws://localhost:2567",
    roomName: ROOM_NAME,
    storagePrefix: `ui${++clients}`,
    rootSchema: WitClashState,
  });
  const state = new WitClashState();
  state.roomCode = "ABCD";
  state.minPlayers = 3;
  state.maxPlayers = 8;
  state.phase = phase;
  state.options = JSON.stringify({ totalRounds: 3 });
  const me = addSeat(state, manager.playerId, { name: "Me", ...seat });
  const room = new StubRoom(state);
  manager.attach(room);
  return { manager, state, room, me, patch: () => room.patch() };
}

/** The requests a client sent, leaving out the typing indicator that rides along with every answer. */
export function withoutTyping(c: Client): Client["room"]["requests"] {
  return c.room.requests.filter(
    (r) => !(typeof r.payload === "object" && r.payload !== null && "typing" in r.payload),
  );
}

export interface FetchStub {
  urls: string[];
}

/** Stands in for the network: records every requested URL and answers with `reply` (an Error or a string rejects). */
export function stubFetch(reply: unknown): FetchStub {
  const stub: FetchStub = { urls: [] };
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    stub.urls.push(String(input instanceof Request ? input.url : input));
    if (reply instanceof Error || typeof reply === "string") throw reply;
    return new Response(JSON.stringify(reply), { headers: { "content-type": "application/json" } });
  });
  return stub;
}
