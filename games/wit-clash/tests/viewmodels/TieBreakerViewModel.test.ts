import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TieBreakerViewModel } from "../../ui/viewmodels/TieBreakerViewModel.svelte.js";
import {
  addMine,
  addSeat,
  answer,
  connectedClient,
  matchup,
  prompt,
  withoutTyping,
} from "../helpers/client.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

function tieBreaker(phase: string) {
  const c = connectedClient({ name: "Me" }, phase);
  addSeat(c.state, "zed-12345", { name: "Zed" });
  c.state.tieBreakers.push(matchup("old", "Earlier prompt", []));
  c.state.tieBreakers.push(matchup("tb1", "Name a bird", []));
  c.state.tieBreakerContenders.push(c.manager.playerId, "zed-12345");
  c.state.serverNow = 1_000_000;
  c.state.phaseEndsAt = 1_000_000 + 30_000;
  return { c, vm: new TieBreakerViewModel(c.manager) };
}

describe("TieBreakerViewModel answering", () => {
  it("describes the current tie-breaker and who is in it", () => {
    const { c, vm } = tieBreaker("TieBreakerPrompting");
    expect(vm.promptText).toBe("Name a bird");
    expect(vm.contenderNames).toEqual(["Me", "Zed"]);
    expect(vm.isContender).toBe(true);
    expect(vm.secondsLeft).toBe(30);
    expect(vm.isUrgent).toBe(false);
    c.state.tieBreakerContenders.push("ghost");
    expect(vm.contenderNames).toEqual(["Me", "Zed", ""]);
    vm.destroy();
  });

  it("knows a bystander", () => {
    const { c, vm } = tieBreaker("TieBreakerPrompting");
    c.state.tieBreakerContenders.clear();
    expect(vm.isContender).toBe(false);
    vm.destroy();
  });

  it("keeps a draft and counts characters", () => {
    const { vm } = tieBreaker("TieBreakerPrompting");
    expect(vm.canSubmit).toBe(false);
    vm.setDraft("hello");
    expect(vm.draft).toBe("hello");
    expect(vm.charsRemaining).toBe(195);
    expect(vm.canSubmit).toBe(true);
    vm.setDraft("   ");
    expect(vm.canSubmit).toBe(false);
    vm.setDraft("x".repeat(201));
    expect(vm.canSubmit).toBe(false);
    vm.destroy();
  });

  it("submits the trimmed answer for the tie-breaker", async () => {
    const { c, vm } = tieBreaker("TieBreakerPrompting");
    vm.setDraft("  Pigeon  ");
    await vm.submit();
    expect(withoutTyping(c)).toEqual([
      { type: "ACTION", payload: { matchupId: "tb1", answer: "Pigeon", type: "SUBMIT_ANSWER" } },
    ]);
    vm.destroy();
  });

  it("does not submit an empty draft or without a tie-breaker", async () => {
    const { c, vm } = tieBreaker("TieBreakerPrompting");
    await vm.submit();
    c.state.tieBreakers.clear();
    vm.setDraft("orphan");
    await vm.submit();
    expect(withoutTyping(c)).toEqual([]);
    vm.destroy();
  });

  it("shows what the server accepted", () => {
    const { c, vm } = tieBreaker("TieBreakerPrompting");
    expect(vm.hasSubmitted).toBe(false);
    const mine = addMine(c.state, c.manager.playerId);
    expect(vm.hasSubmitted).toBe(false);
    mine.prompts.push(prompt("tb1", "Name a bird", true));
    c.patch();
    expect(vm.hasSubmitted).toBe(true);
    vm.destroy();
  });
});

describe("TieBreakerViewModel voting", () => {
  function voting(mine: { canVote: boolean; matchupVote?: string }) {
    const t = tieBreaker("TieBreakerVoting");
    const current = t.c.state.tieBreakers[1];
    current?.answers.push(answer("a1", "Pigeon"), answer("a2", "Heron"));
    t.c.state.votesCast = 1;
    t.c.state.votesExpected = 3;
    addMine(t.c.state, t.c.manager.playerId, mine);
    return t;
  }

  it("lists the answers with my vote marked", () => {
    const { vm } = voting({ canVote: true, matchupVote: "a2" });
    expect(vm.choices).toEqual([
      { id: "a1", text: "Pigeon", isMine: false },
      { id: "a2", text: "Heron", isMine: true },
    ]);
    expect(vm.canVote).toBe(true);
    expect(vm.votesCast).toBe(1);
    expect(vm.votesExpected).toBe(3);
    vm.destroy();
  });

  it("casts a vote when allowed", async () => {
    const { c, vm } = voting({ canVote: true });
    await vm.vote("a2");
    expect(c.room.requests).toEqual([
      { type: "ACTION", payload: { answerId: "a2", type: "CAST_VOTE" } },
    ]);
    vm.destroy();
  });

  it("does not vote when not allowed", async () => {
    const { c, vm } = voting({ canVote: false });
    await vm.vote("a2");
    expect(c.room.requests).toEqual([]);
    expect(vm.canVote).toBe(false);
    vm.destroy();
  });

  it("copes with no tie-breaker, no private entry and no room", () => {
    const c = connectedClient({}, "TieBreakerVoting");
    const vm = new TieBreakerViewModel(c.manager);
    expect(vm.choices).toEqual([]);
    expect(vm.canVote).toBe(false);
    expect(vm.promptText).toBe("");
    expect(vm.revealed).toBeUndefined();
    c.manager.dispose();
    expect([vm.votesCast, vm.votesExpected, vm.contenderNames, vm.isContender]).toEqual([
      0,
      0,
      [],
      false,
    ]);
    expect(vm.promptText).toBe("");
    vm.destroy();
  });
});

describe("TieBreakerViewModel reveal", () => {
  it("is empty until the tie-breaker is revealed, then lists authors and votes", () => {
    const { c, vm } = tieBreaker("TieBreakerReveal");
    const current = c.state.tieBreakers[1];
    current?.answers.push(
      answer("a1", "Pigeon", {
        votes: 2,
        authorId: c.manager.playerId,
        authorName: "Me",
        isWinner: true,
      }),
      answer("a2", "Heron", { votes: 1, authorId: "zed-12345", authorName: "Zed" }),
    );
    expect(vm.revealed).toBeUndefined();
    if (current) current.isRevealed = true;
    c.patch();
    expect(vm.revealed).toEqual({
      promptText: "Name a bird",
      isForfeit: false,
      isClash: false,
      answers: [
        { id: "a1", text: "Pigeon", votes: 2, authorName: "Me", isWinner: true, isMine: true },
        { id: "a2", text: "Heron", votes: 1, authorName: "Zed", isWinner: false, isMine: false },
      ],
    });
    vm.destroy();
  });
});
