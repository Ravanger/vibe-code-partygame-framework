import type { Room } from "@colyseus/core";
import { actionLogMiddleware, required } from "@partygame/core";
import { parseBundle, replayLog, verifyBundle } from "@partygame/core/replay";
import {
  CLIENT_MESSAGES,
  ClientMessage,
  type ExportReplayResponse,
  FRAMEWORK_VERSION,
} from "@partygame/shared";
import { BaseGameState } from "@partygame/shared/schema";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { TestServer } from "../src/testing/index.js";
import { bootTestServer, waitUntil } from "../src/testing/index.js";
import { BuzzerGame, type BuzzerOptions, BuzzerState, PlainGame } from "./fixtures/buzzer.js";
import { pid, type Seated, seat, stateOf } from "./support.js";

const LOGGED_BUZZER: typeof BuzzerGame = { ...BuzzerGame, middleware: [actionLogMiddleware()] };

/** A middleware that drops `transition` events before the action log sees them. */
const DROPPING_BUZZER: typeof BuzzerGame = {
  ...BuzzerGame,
  middleware: [
    (ctx, next) => {
      if (ctx.event.kind !== "transition") next();
    },
    actionLogMiddleware(),
  ],
};

const BOOM_HASH_BUZZER = {
  ...LOGGED_BUZZER,
  contentHash: () => {
    throw new Error("hash boom");
  },
};

const GAMES = [
  { roomName: "buzzer", definition: LOGGED_BUZZER, stateClass: BuzzerState },
  { roomName: "plain", definition: PlainGame, stateClass: BaseGameState },
  { roomName: "dropping", definition: DROPPING_BUZZER, stateClass: BuzzerState },
  { roomName: "boomhash", definition: BOOM_HASH_BUZZER, stateClass: BuzzerState },
];

let t: TestServer;
beforeAll(async () => {
  t = await bootTestServer({ games: GAMES });
});
afterEach(() => t.cleanup());
afterAll(() => t.shutdown());

async function startBuzzing(room: Room) {
  const p1 = await seat(t, room, 1);
  const p2 = await seat(t, room, 2);
  await waitUntil(() => stateOf(room).phase === "Buzz", "started");
  return { p1, p2 };
}

async function playToDone(room: Room, p1: Seated, p2: Seated): Promise<void> {
  p2.client.send("ACTION", { type: "BUZZ" });
  p1.client.send("ACTION", { type: "BUZZ" });
  await waitUntil(() => stateOf(room).phase === "Done", "done");
}

const UNAUTHORIZED = {
  ok: false,
  error: { code: "UNAUTHORIZED", message: CLIENT_MESSAGES.UNAUTHORIZED },
} as const;
const NOT_ALLOWED = {
  ok: false,
  error: { code: "NOT_ALLOWED", message: CLIENT_MESSAGES.NOT_ALLOWED },
} as const;

describe("GameRoom replay export", () => {
  it("answers the host with a bundle: one synced snapshot per transition, no private data", async () => {
    const room = await t.createRoom("buzzer");
    const { p1, p2 } = await startBuzzing(room);
    await playToDone(room, p1, p2);

    const bundle = await p1.client.request<unknown, ExportReplayResponse>(
      ClientMessage.EXPORT_REPLAY,
    );
    const parsed = parseBundle(bundle);
    expect(parsed.name).toBe("Buzzer");
    expect(parsed.gameVersion).toBe("1");
    expect(parsed.frameworkVersion).toBe(FRAMEWORK_VERSION);
    expect(parsed.contentHash).toBe("");
    expect(verifyBundle(parsed)).toEqual({ ok: true });

    const transitions = parsed.log.entries.filter((entry) => entry.kind === "transition");
    expect(transitions.map((entry) => `${entry.from}->${entry.to}`)).toEqual([
      "Lobby->Buzz",
      "Buzz->Done",
    ]);
    expect(parsed.snapshots).toHaveLength(transitions.length);
    expect(parsed.snapshots.map((snap) => snap.seq)).toEqual(transitions.map((entry) => entry.seq));

    for (const snap of parsed.snapshots) {
      const json = JSON.stringify(snap.state);
      expect(json).not.toContain("secrets"); // the .view() field
      expect(json).not.toContain("secret-"); // its contents
      expect(json).not.toContain("buzzed"); // a ctx.priv key
    }

    const first = required(parsed.snapshots[0], "first snapshot");
    expect(first.phase).toBe("Lobby");
    const firstState = JSON.parse(JSON.stringify(first.state)) as {
      phase: string;
      players: Record<string, unknown>;
    };
    expect(firstState.phase).toBe("Lobby");
    expect(Object.keys(firstState.players)).toHaveLength(2);
    const last = required(parsed.snapshots[1], "last snapshot");
    expect(last.phase).toBe("Buzz");
    const lastState = JSON.parse(JSON.stringify(last.state));
    expect(lastState).toMatchObject({ phase: "Buzz", winner: pid(2), buzzCount: 2 });
  });

  it("replays the bundle log to the live final state", async () => {
    const room = await t.createRoom("buzzer");
    const { p1, p2 } = await startBuzzing(room);
    await playToDone(room, p1, p2);

    const bundle = await p1.client.request<unknown, ExportReplayResponse>(
      ClientMessage.EXPORT_REPLAY,
    );
    const parsed = parseBundle(bundle);
    const { states } = replayLog(LOGGED_BUZZER, parsed.log, {
      state: new BuzzerState(),
      options: JSON.parse(stateOf(room).options) as BuzzerOptions,
      players: 2,
    });
    const final = required(states[states.length - 1], "final replay state");
    const live = stateOf(room);
    expect(final.phase).toBe(live.phase);
    expect(final.buzzCount).toBe(live.buzzCount);
    expect(final.lucky).toBe(live.lucky);
    // Seat ids are remapped positionally to p1..pN in the replay, so compare the winner by seat.
    const roster = required(parsed.log.roster, "recorded roster");
    const liveWinnerSeat = required(
      roster.find((seat) => seat.id === live.winner),
      "winner seat",
    );
    expect(final.winner).toBe(`p${roster.indexOf(liveWinnerSeat) + 1}`);
  });

  it("refuses non-hosts with UNAUTHORIZED, including spectators", async () => {
    const room = await t.createRoom("buzzer");
    const { p2 } = await startBuzzing(room);
    const denied = await p2.client.request<unknown, ExportReplayResponse>(
      ClientMessage.EXPORT_REPLAY,
    );
    expect(denied).toEqual(UNAUTHORIZED);

    const watcher = await t.join(room, { playerId: pid(9), spectator: true });
    const watched = await watcher.request<unknown, ExportReplayResponse>(
      ClientMessage.EXPORT_REPLAY,
    );
    expect(watched).toEqual(UNAUTHORIZED);
  });

  it("refuses with NOT_ALLOWED when the game records no action log", async () => {
    const room = await t.createRoom("plain");
    const p1 = await seat(t, room, 1);
    const denied = await p1.client.request<unknown, ExportReplayResponse>(
      ClientMessage.EXPORT_REPLAY,
    );
    expect(denied).toEqual(NOT_ALLOWED);
  });

  it("refuses with NOT_ALLOWED when a middleware dropped a transition from the log", async () => {
    const room = await t.createRoom("dropping");
    const { p1, p2 } = await startBuzzing(room);
    await playToDone(room, p1, p2);
    const denied = await p1.client.request<unknown, ExportReplayResponse>(
      ClientMessage.EXPORT_REPLAY,
    );
    expect(denied).toEqual(NOT_ALLOWED);
  });

  it("answers INTERNAL when the game's contentHash throws, never the exception text", async () => {
    const room = await t.createRoom("boomhash");
    const { p1, p2 } = await startBuzzing(room);
    await playToDone(room, p1, p2);
    const failed = await p1.client.request<unknown, ExportReplayResponse>(
      ClientMessage.EXPORT_REPLAY,
    );
    expect(failed).toEqual({
      ok: false,
      error: { code: "INTERNAL", message: CLIENT_MESSAGES.INTERNAL },
    });
  });
});
