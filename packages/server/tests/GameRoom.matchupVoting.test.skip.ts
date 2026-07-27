import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PhaseDurations } from "../../src/rooms/GameRoom.js";
import { bootTestServer, seatPlayers, sleep } from "./helpers/harness.js";

const DURATIONS: PhaseDurations = {
  categoryVoteMs: 80,
  promptMs: 80,
  matchupVoteMs: 60,
  matchupRevealMs: 30,
  emptyRoomGraceMs: 200,
};

function setupRoomWithMatchups(colyseus: ColyseusTestServer, room: any, clients: any[]) {
  const categoryId = room.state.categoryOptions[0]!.id;
  for (const client of clients) {
    client.send("ACTION", { type: "VOTE_CATEGORY", categoryId });
  }
}

function submitAllAnswers(room: any, clients: any[]) {
  for (const matchup of room.state.matchups) {
    for (const client of clients) {
      client.send("ACTION", {
        type: "SUBMIT_ANSWER",
        matchupId: matchup.id,
        answer: "test answer",
      });
    }
  }
}

function answerById(room: any, answerId: string) {
  for (const m of room.state.matchups) {
    for (const a of m.answers) {
      if (a.id === answerId) return a;
    }
  }
  return undefined;
}

describe("GameRoom — matchup voting: entering Voting", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await bootTestServer(DURATIONS);
  });

  afterEach(async () => {
    await colyseus?.cleanup();
  });

  afterAll(async () => {
    await colyseus?.shutdown();
  });

  it("starts on matchup 0", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("Voting");
    expect(room.state.activeMatchupIndex).toBe(0);
  });

  it("sets a vote deadline", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    expect(room.state.phaseEndsAt).toBeGreaterThan(Date.now());
  });

  it("keeps every authorId hidden", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    for (const m of room.state.matchups) {
      for (const a of m.answers) {
        expect(a.authorId).toBe("");
      }
    }
  });

  it("clears votes from the previous matchup", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    expect(room.state.answerVotes.size).toBe(0);
  });
});

describe("GameRoom — matchup voting: CAST_VOTE", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await bootTestServer(DURATIONS);
  });

  afterEach(async () => {
    await colyseus?.cleanup();
  });

  afterAll(async () => {
    await colyseus?.shutdown();
  });

  it("records a vote from a non-author", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    const a1 = room.state.matchups[0]!.answers[0]!.id;
    clients[2]!.send("ACTION", { type: "CAST_VOTE", answerId: a1 });
    await room.waitForNextPatch();
    expect(answerById(room, a1).votes).toBe(1);
  });

  it("REJECTS a vote from an author of THIS matchup", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    const a1 = room.state.matchups[0]!.answers[0]!.id;
    clients[0]!.send("ACTION", { type: "CAST_VOTE", answerId: a1 });
    await room.waitForNextPatch();
    expect(answerById(room, a1).votes).toBe(0);
  });

  it("REJECTS a vote for the opponent's answer by the other author", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    const a1 = room.state.matchups[0]!.answers[0]!.id;
    clients[1]!.send("ACTION", { type: "CAST_VOTE", answerId: a1 });
    await room.waitForNextPatch();
    expect(answerById(room, a1).votes).toBe(0);
  });

  it("REJECTS a vote for an answer in a different matchup", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    const answerInMatchup2 = room.state.matchups[1]?.answers[0]?.id;
    if (answerInMatchup2) {
      clients[2]!.send("ACTION", { type: "CAST_VOTE", answerId: answerInMatchup2 });
      await room.waitForNextPatch();
      expect(answerById(room, answerInMatchup2).votes).toBe(0);
    }
  });

  it("lets a voter change their mind without double-counting", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    const a1 = room.state.matchups[0]!.answers[0]!.id;
    const a2 = room.state.matchups[0]!.answers[1]!.id;
    clients[2]!.send("ACTION", { type: "CAST_VOTE", answerId: a1 });
    await room.waitForNextPatch();
    clients[2]!.send("ACTION", { type: "CAST_VOTE", answerId: a2 });
    await room.waitForNextPatch();
    expect(answerById(room, a1).votes).toBe(0);
    expect(answerById(room, a2).votes).toBe(1);
    expect(room.state.answerVotes.size).toBe(1);
  });

  it("ignores an unknown answerId", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    clients[2]!.send("ACTION", { type: "CAST_VOTE", answerId: "unknown-id" });
    await room.waitForNextPatch();
    expect(room.state.answerVotes.size).toBe(0);
  });

  it("ignores a vote during the reveal window", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    await sleep(DURATIONS.matchupVoteMs + 40);
    const a1 = room.state.matchups[0]!.answers[0]!.id;
    clients[2]!.send("ACTION", { type: "CAST_VOTE", answerId: a1 });
    await room.waitForNextPatch();
    expect(room.state.answerVotes.size).toBe(0);
  });

  it("ignores a vote from a player not in the room", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    const notInRoom = await colyseus.connectTo(room, { playerId: "uuid-outside" });
    notInRoom.send("SET_NAME", "Outside");
    await room.waitForNextPatch();
    const a1 = room.state.matchups[0]!.answers[0]!.id;
    notInRoom.send("ACTION", { type: "CAST_VOTE", answerId: a1 });
    await room.waitForNextPatch();
    expect(answerById(room, a1).votes).toBe(0);
  });
});

describe("GameRoom — matchup voting: advancing through matchups", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await bootTestServer(DURATIONS);
  });

  afterEach(async () => {
    await colyseus?.cleanup();
  });

  afterAll(async () => {
    await colyseus?.shutdown();
  });

  it("reveals as soon as every eligible voter has voted", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 4);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    const a1 = room.state.matchups[0]!.answers[0]!.id;
    for (const client of clients) {
      client.send("ACTION", { type: "CAST_VOTE", answerId: a1 });
    }
    await room.waitForNextPatch();
    expect(room.state.isRevealing).toBe(true);
    expect(room.state.matchups[0].isRevealed).toBe(true);
  });

  it("reveals when the vote timer expires", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    await sleep(DURATIONS.matchupVoteMs + 40);
    expect(room.state.isRevealing).toBe(true);
  });

  it("fills authorId for the revealed matchup ONLY", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    await sleep(DURATIONS.matchupVoteMs + 40);
    for (const a of room.state.matchups[0].answers) {
      expect(a.authorId).not.toBe("");
    }
    for (const a of room.state.matchups[1].answers) {
      expect(a.authorId).toBe("");
    }
  });

  it("moves to the next matchup after the reveal window", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    await sleep(DURATIONS.matchupVoteMs + DURATIONS.matchupRevealMs + 60);
    expect(room.state.activeMatchupIndex).toBe(1);
    expect(room.state.isRevealing).toBe(false);
  });

  it("goes to Results after the last matchup", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    const matchupCount = room.state.matchups.length;
    const totalMs = matchupCount * (DURATIONS.matchupVoteMs + DURATIONS.matchupRevealMs) + 100;
    await sleep(totalMs);
    expect(room.state.phase).toBe("Results");
  });

  it("skips a matchup with zero eligible voters", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 2);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    expect(room.state.isRevealing).toBe(true);
    expect(room.state.matchups[0].isRevealed).toBe(true);
  });

  it("excludes disconnected players from the eligible set", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 4);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    clients[2]!.leave();
    await room.waitForNextPatch();
    const a1 = room.state.matchups[0]!.answers[0]!.id;
    clients[0]!.send("ACTION", { type: "CAST_VOTE", answerId: a1 });
    clients[1]!.send("ACTION", { type: "CAST_VOTE", answerId: a1 });
    clients[3]!.send("ACTION", { type: "CAST_VOTE", answerId: a1 });
    await room.waitForNextPatch();
    expect(room.state.isRevealing).toBe(true);
  });

  it("does not advance twice when the last vote races the timer", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 4);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    const a1 = room.state.matchups[0]!.answers[0]!.id;
    for (const client of clients) {
      client.send("ACTION", { type: "CAST_VOTE", answerId: a1 });
    }
    await sleep(DURATIONS.matchupVoteMs + 40);
    expect(room.state.matchups[0].isRevealed).toBe(true);
    expect(room.state.activeMatchupIndex).toBeLessThanOrEqual(1);
  });

  it("advances even if every eligible voter disconnects mid-matchup", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 4);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    clients[2]!.leave();
    clients[3]!.leave();
    await sleep(DURATIONS.matchupVoteMs + 40);
    expect(room.state.matchups[0].isRevealed).toBe(true);
  });
});

describe("GameRoom — matchup voting: scoring hand-off", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await bootTestServer(DURATIONS);
  });

  afterEach(async () => {
    await colyseus?.cleanup();
  });

  afterAll(async () => {
    await colyseus?.shutdown();
  });

  it("awards points once per matchup, at its reveal", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 4);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    const a1 = room.state.matchups[0]!.answers[0]!.id;
    for (const client of clients) {
      client.send("ACTION", { type: "CAST_VOTE", answerId: a1 });
    }
    await room.waitForNextPatch();
    const initialScore = room.state.scores.get(clients[0]!.sessionId) ?? 0;
    expect(initialScore).toBeGreaterThan(0);
  });

  it("does not re-award when the same matchup is revealed again", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 4);
    setupRoomWithMatchups(colyseus, room, clients);
    await room.waitForNextPatch();
    submitAllAnswers(room, clients);
    await room.waitForNextPatch();
    const a1 = room.state.matchups[0]!.answers[0]!.id;
    for (const client of clients) {
      client.send("ACTION", { type: "CAST_VOTE", answerId: a1 });
    }
    await room.waitForNextPatch();
    const scoreAfterReveal = room.state.scores.get(clients[0]!.sessionId) ?? 0;
    await sleep(100);
    const scoreAfterWait = room.state.scores.get(clients[0]!.sessionId) ?? 0;
    expect(scoreAfterWait).toBe(scoreAfterReveal);
  });
});
