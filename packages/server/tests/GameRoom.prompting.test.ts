import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PhaseDurations } from "../src/rooms/GameRoom.js";
import { bootTestServer, seatPlayers, waitUntil } from "./helpers/harness.js";

describe("GameRoom — Prompting phase", () => {
  let colyseus: ColyseusTestServer;
  // promptMs is short so "advances when the timer expires" stays quick. matchupVoteMs and
  // matchupRevealMs are deliberately LONG: once Prompting ends we land in Voting, and a short
  // vote window would expire and reveal matchup 0 — legitimately filling authorId — while the
  // anonymity assertion below is still running.
  const durations: PhaseDurations = {
    categoryVoteMs: 80,
    promptMs: 200,
    matchupVoteMs: 2000,
    matchupRevealMs: 500,
    emptyRoomGraceMs: 10,
  };
  beforeAll(async () => {
    colyseus = await bootTestServer(durations);
  });
  afterEach(async () => {
    await colyseus.cleanup();
  });
  afterAll(async () => {
    await colyseus.shutdown();
  });

  async function enterPrompting() {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    const opts = room.state.categoryOptions;
    for (const client of clients) {
      client.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]?.id });
    }
    await waitUntil(() => room.state.phase === "Prompting", "phase=Prompting");
    return { room, clients };
  }

  describe("entering Prompting", () => {
    it("builds one matchup per player", async () => {
      const { room } = await enterPrompting();
      expect(room.state.matchups.length).toBe(3);
    });

    it("draws prompts from the winning category", async () => {
      const { room } = await enterPrompting();
      for (const m of room.state.matchups) {
        expect(m.promptText).toBeTruthy();
      }
    });

    it("starts at round 1", async () => {
      const { room } = await enterPrompting();
      expect(room.state.roundNumber).toBe(1);
    });

    it("sets answersExpected to two per player", async () => {
      const { room } = await enterPrompting();
      expect(room.state.answersExpected).toBe(6);
    });

    it("sets phaseEndsAt about promptMs ahead", async () => {
      const { room } = await enterPrompting();
      const diff = room.state.phaseEndsAt - room.state.serverNow;
      expect(diff).toBeGreaterThanOrEqual(durations.promptMs - 50);
      expect(diff).toBeLessThanOrEqual(durations.promptMs + 100);
    });

    it("keeps matchup answers empty until the phase ends", async () => {
      const { room } = await enterPrompting();
      expect(room.state.matchups.every((m) => m.answers.length === 0)).toBe(true);
    });
  });

  describe("YOUR_PROMPTS private message", () => {
    it("sends each player exactly two prompts", async () => {
      const room = await colyseus.createRoom("wit_clash", {});
      const clients = await seatPlayers(colyseus, room, 3);
      // biome-ignore lint/suspicious/noExplicitAny: test message storage requires any type
      const receivedByClient = clients.map(() => [] as any[]);
      for (let i = 0; i < clients.length; i++) {
        clients[i]?.onMessage("YOUR_PROMPTS", (msg) => receivedByClient[i]?.push(msg));
      }
      const opts = room.state.categoryOptions;
      for (const client of clients) {
        client.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]?.id });
      }
      await room.waitForNextPatch();
      for (let i = 0; i < clients.length; i++) {
        expect(receivedByClient[i]?.[0]).toHaveLength(2);
      }
    });

    it("never includes authorship of other players", async () => {
      const { room } = await enterPrompting();
      for (const m of room.state.matchups) {
        expect(m.answers.length).toBe(0);
      }
    });
  });

  describe("SUBMIT_ANSWER", () => {
    it("accepts an answer for an assigned matchup", async () => {
      const { room, clients } = await enterPrompting();
      const initialSubmitted = room.state.answersSubmitted;
      // With ring pairing, clients[0] is in exactly 2 of 3 matchups.
      // Submit to all matchups; answersSubmitted should increase by 2.
      for (const m of room.state.matchups) {
        clients[0]?.send("ACTION", {
          type: "SUBMIT_ANSWER",
          matchupId: m.id,
          answer: "test answer",
        });
      }
      await room.waitForNextPatch();
      expect(room.state.answersSubmitted).toBe(initialSubmitted + 2);
    });

    it("REJECTS an answer for a matchup the player was not assigned", async () => {
      const { room, clients } = await enterPrompting();
      const initialSubmitted = room.state.answersSubmitted;
      clients[0]?.send("ACTION", {
        type: "SUBMIT_ANSWER",
        matchupId: "not-a-real-id",
        answer: "sneaky",
      });
      await room.waitForNextPatch();
      expect(room.state.answersSubmitted).toBe(initialSubmitted);
    });

    it("does not expose answer text in synced state during Prompting", async () => {
      const { room, clients } = await enterPrompting();
      for (const m of room.state.matchups) {
        clients[0]?.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: m.id, answer: "test" });
      }
      await room.waitForNextPatch();
      expect(room.state.matchups.every((m) => m.answers.length === 0)).toBe(true);
    });

    it("lets a player edit an answer before the deadline without double-counting", async () => {
      const { room, clients } = await enterPrompting();
      const initialSubmitted = room.state.answersSubmitted;
      // Submit to all matchups twice; answersSubmitted should increase by exactly 2 (not 4)
      for (const m of room.state.matchups) {
        clients[0]?.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: m.id, answer: "first" });
      }
      await room.waitForNextPatch();
      for (const m of room.state.matchups) {
        clients[0]?.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: m.id, answer: "second" });
      }
      await room.waitForNextPatch();
      expect(room.state.answersSubmitted).toBe(initialSubmitted + 2);
    });

    it("ignores a submission outside the Prompting phase", async () => {
      const { room, clients } = await enterPrompting();
      const matchups = [...room.state.matchups];
      for (const m of matchups) {
        for (const client of clients) {
          client.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: m.id, answer: "test" });
        }
      }
      await waitUntil(() => room.state.phase !== "Prompting", "left Prompting");
      const initialSubmitted = room.state.answersSubmitted;
      clients[0]?.send("ACTION", {
        type: "SUBMIT_ANSWER",
        matchupId: matchups[0]?.id,
        answer: "late",
      });
      await room.waitForNextPatch();
      expect(room.state.answersSubmitted).toBe(initialSubmitted);
    });
  });

  describe("advancing", () => {
    it("advances once every player has submitted BOTH answers", async () => {
      const { room, clients } = await enterPrompting();
      const matchups = [...room.state.matchups];
      for (const client of clients) {
        for (const m of matchups) {
          client.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: m.id, answer: "test" });
        }
      }
      await room.waitForNextPatch();
      expect(room.state.phase).toBe("Voting");
    });

    it("does not advance when a player has answered only one prompt", async () => {
      const { room, clients } = await enterPrompting();
      const matchups = [...room.state.matchups];
      clients[0]?.send("ACTION", {
        type: "SUBMIT_ANSWER",
        matchupId: matchups[0]?.id,
        answer: "test",
      });
      await room.waitForNextPatch();
      expect(room.state.phase).toBe("Prompting");
    });

    it("advances when the timer expires", async () => {
      const { room } = await enterPrompting();
      await waitUntil(() => room.state.phase === "Voting", "phase=Voting");
      expect(room.state.phase).toBe("Voting");
    });

    it("fills a placeholder for each missing answer", async () => {
      const { room } = await enterPrompting();
      await waitUntil(() => room.state.phase === "Voting", "phase=Voting");
      expect(room.state.matchups.every((m) => m.answers.length === 2)).toBe(true);
      expect(room.state.matchups.some((m) => m.answers.some((a) => a.text === "(no answer)"))).toBe(
        true,
      );
    });

    it("still hides authorId after the phase ends", async () => {
      const { room } = await enterPrompting();
      // Assert the instant Voting begins: no matchup has been revealed yet, so every authorId
      // must still be empty. Waiting a fixed sleep instead would let matchup 0 reveal first.
      await waitUntil(() => room.state.phase === "Voting", "phase=Voting");
      expect(room.state.isRevealing).toBe(false);
      expect(room.state.matchups.every((m) => m.answers.every((a) => a.authorId === ""))).toBe(
        true,
      );
    });
  });
});
