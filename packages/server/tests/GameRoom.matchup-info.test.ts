import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PhaseDurations } from "../src/rooms/GameRoom.js";
import { bootTestServer, seatPlayers, sleep, waitUntil } from "./helpers/harness.js";

interface MatchupInfo {
  matchupId: string;
  isOwnMatchup: boolean;
  eligibleVoterCount: number;
}

interface TestRoomState {
  phase: string;
  categoryOptions: { id: string }[];
  matchups: { id: string; answers: { id: string }[] }[];
  activeMatchupIndex: number;
  answerVotes: Map<string, string>;
  players: Map<string, { playerId: string; isConnected: boolean; isReady: boolean }>;
}

interface TestClient {
  sessionId: string;
  send: (type: string, payload?: unknown) => void;
  onMessage: (type: string, cb: (payload: MatchupInfo) => void) => void;
  leave: (consented?: boolean) => Promise<unknown>;
}

describe("GameRoom — MATCHUP_INFO per-client voting context", () => {
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

  async function advanceToVoting(room: { state: TestRoomState }, clients: TestClient[]) {
    const opts = room.state.categoryOptions;
    for (const client of clients) {
      client.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]?.id });
    }
    await waitUntil(() => room.state.phase === "Prompting", "phase=Prompting");
    for (const m of room.state.matchups) {
      for (const client of clients) {
        client.send("ACTION", {
          type: "SUBMIT_ANSWER",
          matchupId: m.id,
          answer: `answer from ${client.sessionId}`,
        });
      }
    }
    await waitUntil(() => room.state.phase === "Voting", "phase=Voting");
  }

  function authorsOf(room: { state: TestRoomState }): Set<string> {
    const gameRoom = room as unknown as { answerAuthors: Map<string, string> };
    const matchup = room.state.matchups[room.state.activeMatchupIndex];
    return new Set(matchup.answers.map((a) => gameRoom.answerAuthors.get(a.id)));
  }

  it("tells each client whether they authored the active matchup, pre-reveal", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 4);

    const infos = new Map<string, MatchupInfo>();
    for (const c of clients) {
      c.onMessage("MATCHUP_INFO", (info: MatchupInfo) => infos.set(c.sessionId, info));
    }

    await advanceToVoting(room, clients);
    await waitUntil(() => infos.size === 4, "all clients got MATCHUP_INFO");

    const matchup = room.state.matchups[room.state.activeMatchupIndex];
    const authors = authorsOf(room);
    expect(authors.size).toBe(2);

    for (const c of clients) {
      const info = infos.get(c.sessionId);
      if (!info) throw new Error(`no MATCHUP_INFO for ${c.sessionId}`);
      expect(info.matchupId).toBe(matchup.id);
      // Only the client's OWN authorship is revealed — nothing about others.
      expect(info.isOwnMatchup).toBe(authors.has(c.sessionId));
      // 4 players minus 2 authors.
      expect(info.eligibleVoterCount).toBe(2);
    }
  });

  it("lets a non-author vote but rejects an author's self-vote", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 4);
    await advanceToVoting(room, clients);

    const matchup = room.state.matchups[room.state.activeMatchupIndex];
    const authors = authorsOf(room);
    const nonAuthor = clients.find((c) => !authors.has(c.sessionId));
    const author = clients.find((c) => authors.has(c.sessionId));
    if (!nonAuthor || !author) throw new Error("expected an author and a non-author");

    nonAuthor.send("ACTION", { type: "CAST_VOTE", answerId: matchup.answers[0].id });
    await waitUntil(
      () => room.state.answerVotes.has(nonAuthor.sessionId),
      "non-author vote accepted",
    );

    author.send("ACTION", { type: "CAST_VOTE", answerId: matchup.answers[0].id });
    await sleep(200);
    expect(room.state.answerVotes.has(author.sessionId)).toBe(false);
  });

  it("resends MATCHUP_INFO to a client that reconnects mid-voting", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 4);
    await advanceToVoting(room, clients);

    const matchup = room.state.matchups[room.state.activeMatchupIndex];
    const authors = authorsOf(room);
    const authorIndex = clients.findIndex((c) => authors.has(c.sessionId));
    if (authorIndex === -1) throw new Error("no author of the active matchup found");
    const author = clients[authorIndex];
    const playerId = `uuid-${authorIndex}`;

    await author.leave(false);
    await waitUntil(() => {
      const p = Array.from(room.state.players.values()).find((p) => p.playerId === playerId);
      return p && !p.isConnected;
    }, "author disconnected");

    const rejoined = await colyseus.connectTo(room, { playerId });
    let info: MatchupInfo | undefined;
    rejoined.onMessage("MATCHUP_INFO", (m: MatchupInfo) => {
      info = m;
    });
    await waitUntil(() => info !== undefined, "MATCHUP_INFO resent after reconnect");
    if (!info) throw new Error("no MATCHUP_INFO received after reconnect");
    expect(info.matchupId).toBe(matchup.id);
    expect(info.isOwnMatchup).toBe(true);
    expect(info.eligibleVoterCount).toBe(2);
  });
});
