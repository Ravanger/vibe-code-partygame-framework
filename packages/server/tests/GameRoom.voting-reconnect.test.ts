import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PhaseDurations } from "../src/rooms/GameRoom.js";
import { bootTestServer, seatPlayers, waitUntil } from "./helpers/harness.js";

describe("GameRoom — Voting reconnect (Bug 2)", () => {
  let colyseus: ColyseusTestServer;
  // Long vote window so the active matchup cannot auto-reveal mid-test.
  const durations: PhaseDurations = {
    categoryVoteMs: 80,
    promptMs: 30000,
    matchupVoteMs: 30000,
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

  it("rejects a self-vote cast from a reconnected author session", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);

    // Advance to Voting: everyone votes a category, then submits every matchup.
    const opts = room.state.categoryOptions;
    for (const client of clients) {
      client.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]?.id });
    }
    await waitUntil(() => room.state.phase === "Prompting", "phase=Prompting");
    for (const m of room.state.matchups) {
      for (const client of clients) {
        client.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: m.id, answer: "test" });
      }
    }
    await waitUntil(() => room.state.phase === "Voting", "phase=Voting");

    // Authorship is server-private (answerId -> sessionId); pick a player who
    // authored an answer in the active matchup so ring-pairing order doesn't matter.
    const gameRoom = room as unknown as { answerAuthors: Map<string, string> };
    const authorsOfActive = new Set(
      room.state.matchups[0]?.answers.map((a) => gameRoom.answerAuthors.get(a.id)),
    );
    let authorClient: (typeof clients)[number] | undefined;
    for (const c of clients) {
      if (c && authorsOfActive.has(c.sessionId)) {
        authorClient = c;
        break;
      }
    }
    if (!authorClient) throw new Error("no author of the active matchup found");
    const idx = clients.indexOf(authorClient);
    const ownAnswer = room.state.matchups[0]?.answers.find(
      (a) => gameRoom.answerAuthors.get(a.id) === authorClient.sessionId,
    );
    if (!ownAnswer) throw new Error("author has no answer in the active matchup");

    // The author drops the connection and reconnects with a new session id.
    await authorClient.leave(false);
    await waitUntil(
      () =>
        Array.from(room.state.players.values()).some(
          (p) => p.playerId === `uuid-${idx}` && !p.isConnected,
        ),
      "author marked disconnected",
    );
    const reconnected = await colyseus.connectTo(room, { playerId: `uuid-${idx}` });
    await waitUntil(
      () =>
        Array.from(room.state.players.values()).some(
          (p) => p.playerId === `uuid-${idx}` && p.isConnected,
        ),
      "author reconnected",
    );

    // The reconnected author tries to vote on their own answer.
    reconnected.send("ACTION", { type: "CAST_VOTE", answerId: ownAnswer.id });
    await room.waitForNextPatch();

    // Bug: rekeyVotingState rekeys answerVotes but not answerAuthors, so the
    // eligibility check no longer recognizes the author and accepts the self-vote.
    expect(room.state.answerVotes.size).toBe(0);
  });
});
