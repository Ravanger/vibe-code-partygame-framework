import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PhaseDurations } from "../src/rooms/GameRoom.js";
import { bootTestServer, seatPlayers, waitUntil } from "./helpers/harness.js";

describe("GameRoom — clash badge with a single eligible voter (Bug 4)", () => {
  let colyseus: ColyseusTestServer;
  const durations: PhaseDurations = {
    categoryVoteMs: 80,
    promptMs: 30000,
    matchupVoteMs: 2000,
    matchupRevealMs: 500,
    emptyRoomGraceMs: 10000,
    reconnectMs: 10000,
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

  it("never awards a clash when each matchup has exactly one eligible voter", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);

    const opts = room.state.categoryOptions;
    for (const client of clients) {
      client.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]?.id });
    }
    await waitUntil(() => room.state.phase === "Prompting", "phase=Prompting");

    for (const m of room.state.matchups) {
      for (const client of clients) {
        client.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: m.id, answer: "ans" });
      }
    }
    await waitUntil(() => room.state.phase === "Voting", "phase=Voting");

    // With 3 players and ring pairing, each matchup has 2 authors and exactly
    // one eligible voter — a clash is impossible by definition.
    const internals = room as unknown as { answerAuthors: Map<string, string> };
    for (let i = 0; i < room.state.matchups.length; i++) {
      await waitUntil(
        () => room.state.activeMatchupIndex === i && !room.state.isRevealing,
        `matchup ${i} active`,
      );
      const matchup = room.state.matchups[i];
      if (!matchup) throw new Error(`missing matchup ${i}`);
      const answer = matchup.answers[0];
      if (!answer) throw new Error(`matchup ${i} has no answers`);

      const authorSessions = new Set(matchup.answers.map((a) => internals.answerAuthors.get(a.id)));
      const voter = clients.find((c) => !authorSessions.has(c.sessionId));
      if (!voter) throw new Error(`no eligible voter found for matchup ${i}`);
      voter.send("ACTION", { type: "CAST_VOTE", answerId: answer.id });
    }

    await waitUntil(() => room.state.phase === "Results", "phase=Results");

    // No clash may be recorded...
    for (const entry of room.state.scoreboard) {
      expect(entry.hadClash).toBe(false);
    }
    // ...and no clash bonus may be paid: each matchup pays 100 (vote) + 50 (winner) only.
    const roundPoints = room.state.scoreboard.reduce((n, e) => n + e.roundPoints, 0);
    expect(roundPoints).toBe(450);
  });
});
