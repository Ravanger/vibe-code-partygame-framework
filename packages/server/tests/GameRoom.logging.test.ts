import { actionFactory, defineGame } from "@partygame/core";
import { ClientMessage } from "@partygame/shared";
import { BaseGameState } from "@partygame/shared/schema";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { jsonLineLogger } from "../src/logger.js";
import { bootTestServer, type TestServer, testPlayerId, waitUntil } from "../src/testing/index.js";
import { BuzzerState } from "./fixtures/buzzer.js";
import { bootBuzzer, bootPoll, startedPoll } from "./support.js";

/** One parsed JSON line the server's logger wrote. */
interface LogObject {
  [key: string]: unknown;
}

const capturing = (lines: LogObject[]) =>
  jsonLineLogger((line) => {
    lines.push(JSON.parse(line));
  });

const count = (lines: LogObject[], event: string): number =>
  lines.filter((line) => line.event === event).length;

const logAction = actionFactory<BaseGameState, Record<string, never>, Record<string, unknown>>();

/** A one-phase game whose only action writes one line at each level through `ctx.log`. */
const LogGame = defineGame<BaseGameState, Record<string, never>, Record<string, unknown>>({
  name: "Log",
  version: "1",
  minPlayers: 1,
  maxPlayers: 2,
  startPhase: "Play",
  autoStart: true,
  createPrivateState: () => ({}),
  phases: {
    Play: {
      actions: {
        LOG: logAction({
          from: "player",
          payload: z.object({}),
          handler: (ctx) => {
            ctx.log("custom.info");
            ctx.log.warn("custom.warn");
            ctx.log.error("custom.error");
            ctx.log("custom.forged", { roomId: "forged-room" });
          },
        }),
        THROW: logAction({
          from: "player",
          payload: z.object({}),
          handler: () => {
            throw new Error("boom");
          },
        }),
      },
    },
  },
});

describe("GameRoom lifecycle logging", () => {
  let t: TestServer | undefined;
  afterEach(async () => {
    await t?.shutdown();
    t = undefined;
  });

  it("emits one line per lifecycle event with ts, level, event and roomId, never names or payloads", async () => {
    const lines: LogObject[] = [];
    t = await bootBuzzer({ logger: capturing(lines) });
    const room = await t.createRoom("buzzer");
    await waitUntil(() => count(lines, "room.created") === 1, "room.created");

    const pid = testPlayerId(1);
    await t.joinAs(room, { playerId: pid, name: "Zxq9-Name" }, BuzzerState);
    await waitUntil(() => count(lines, "player.joined") === 1, "player.joined");

    const back = await t.joinAs(room, { playerId: pid, name: "Zxq9-Name" }, BuzzerState);
    await waitUntil(() => count(lines, "player.reconnected") === 1, "player.reconnected");

    back.send(ClientMessage.ACTION, { type: "NOPE", note: "Zxq9-Payload" });
    await waitUntil(() => count(lines, "action.rejected") === 1, "action.rejected");

    await back.leave();
    await waitUntil(() => count(lines, "player.left") === 1, "player.left");

    await t.cleanup();
    await waitUntil(() => count(lines, "room.disposed") === 1, "room.disposed");

    expect(lines.map((line) => line.event)).toEqual([
      "room.created",
      "player.joined",
      "player.reconnected",
      "action.rejected",
      "player.left",
      "room.disposed",
    ]);
    for (const line of lines) {
      expect(typeof line.ts).toBe("number");
      expect(["info", "warn", "error"]).toContain(line.level);
      expect(line.roomId).toBe(room.roomId);
      const serialized = JSON.stringify(line);
      expect(serialized).not.toContain("Zxq9-Name");
      expect(serialized).not.toContain("Zxq9-Payload");
    }
    for (const event of ["player.joined", "player.reconnected", "player.left"]) {
      expect(lines.find((line) => line.event === event)?.playerId).toBe(pid);
    }
    const rejected = lines.find((line) => line.event === "action.rejected");
    expect(rejected?.level).toBe("warn");
    expect(rejected?.code).toBe("UNKNOWN_ACTION");
    expect(rejected?.action).toBe("NOPE");
  });

  it("exposes ctx.log to game code with the room id bound", async () => {
    const lines: LogObject[] = [];
    t = await bootTestServer({
      games: [{ roomName: "log", definition: LogGame, stateClass: BaseGameState }],
      logger: capturing(lines),
    });
    const room = await t.createRoom("log");
    const client = await t.joinAs(room, { playerId: testPlayerId(1) }, BaseGameState);
    client.send(ClientMessage.SET_NAME, "P1");
    client.send(ClientMessage.ACTION, { type: "LOG" });

    await waitUntil(() => count(lines, "custom.info") === 1, "ctx.log info");
    expect(count(lines, "custom.warn")).toBe(1);
    expect(count(lines, "custom.error")).toBe(1);
    for (const line of lines.filter(
      (l) => typeof l.event === "string" && l.event.startsWith("custom."),
    )) {
      // the room id is bound by the room and wins over a caller-supplied field of the same name
      expect(line.roomId).toBe(room.roomId);
    }
    expect(lines.find((line) => line.event === "custom.info")?.level).toBe("info");
    expect(lines.find((line) => line.event === "custom.warn")?.level).toBe("warn");
    expect(lines.find((line) => line.event === "custom.error")?.level).toBe("error");
  });

  it("emits an action.rejected line with INTERNAL when a dispatch throws", async () => {
    const lines: LogObject[] = [];
    t = await bootTestServer({
      games: [{ roomName: "log", definition: LogGame, stateClass: BaseGameState }],
      logger: capturing(lines),
    });
    const room = await t.createRoom("log");
    const client = await t.joinAs(room, { playerId: testPlayerId(1) }, BaseGameState);
    client.send(ClientMessage.SET_NAME, "P1");
    client.send(ClientMessage.ACTION, { type: "THROW" });

    await waitUntil(() => count(lines, "action.rejected") === 1, "action.rejected");
    const rejected = lines.find((line) => line.event === "action.rejected");
    expect(rejected?.level).toBe("warn");
    expect(rejected?.code).toBe("INTERNAL");
    expect(rejected?.action).toBe("THROW");
    expect(rejected?.roomId).toBe(room.roomId);
  });

  it("emits an action.rejected line with INTERNAL when an audience dispatch throws", async () => {
    const lines: LogObject[] = [];
    t = await bootPoll({ logger: capturing(lines) });
    const { room } = await startedPoll(t);
    const spec = await t.join(room, { playerId: "aud-0001", spectator: true });
    spec.send(ClientMessage.ACTION, { type: "BOOM" });

    await waitUntil(() => count(lines, "action.rejected") === 1, "action.rejected");
    const rejected = lines.find((line) => line.event === "action.rejected");
    expect(rejected?.level).toBe("warn");
    expect(rejected?.code).toBe("INTERNAL");
    expect(rejected?.action).toBe("BOOM");
    expect(rejected?.roomId).toBe(room.roomId);
  });
});
