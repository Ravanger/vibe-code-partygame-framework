import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryVoteViewModel } from "../../ui/viewmodels/CategoryVoteViewModel.js";
import { MatchupRevealViewModel } from "../../ui/viewmodels/MatchupRevealViewModel.js";
import { MatchupVoteViewModel } from "../../ui/viewmodels/MatchupVoteViewModel.js";
import { PromptingViewModel } from "../../ui/viewmodels/PromptingViewModel.svelte.js";
import { ResultsViewModel } from "../../ui/viewmodels/ResultsViewModel.js";
import {
  addMine,
  answer,
  type Client,
  connectedClient,
  matchup,
  option,
  prompt,
  scoreRow,
  withoutTyping,
} from "../helpers/client.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

const countdownTo = (c: Client, seconds: number) => {
  c.state.serverNow = 1_000_000;
  c.state.phaseEndsAt = 1_000_000 + seconds * 1000;
};

describe("CategoryVoteViewModel", () => {
  function voting() {
    const c = connectedClient({}, "CategorySelection");
    c.state.categoryOptions.push(option("a", 2), option("b", 1));
    c.state.roundNumber = 2;
    c.state.totalRounds = 3;
    c.state.votesCast = 3;
    c.state.votesExpected = 4;
    countdownTo(c, 30);
    addMine(c.state, c.manager.playerId, { categoryVote: "b" });
    return { c, vm: new CategoryVoteViewModel(c.manager) };
  }

  it("shows the options with their public tallies and my own vote", () => {
    const { c, vm } = voting();
    expect(vm.options).toEqual([
      { id: "a", name: "Name a", emoji: "E", votes: 2 },
      { id: "b", name: "Name b", emoji: "E", votes: 1 },
    ]);
    expect(vm.myVote).toBe("b");
    expect(vm.votesCast).toBe(3);
    expect(vm.votesExpected).toBe(4);
    expect(vm.roundLabel).toBe("Round 2 of 3");
    expect(c.manager.me()).toBeDefined();
    vm.destroy();
  });

  it("counts down and announces only at 30, 10 and 5 seconds", () => {
    const { c, vm } = voting();
    expect(vm.secondsLeft).toBe(30);
    expect(vm.announcement).toBe("30 seconds remaining");
    expect(vm.isUrgent).toBe(false);
    c.state.phaseEndsAt = 1_000_000 + 7000;
    c.patch();
    expect(vm.announcement).toBe("");
    expect(vm.isUrgent).toBe(true);
    vm.destroy();
  });

  it("votes through the action protocol", async () => {
    const { c, vm } = voting();
    await vm.vote("a");
    expect(c.room.requests).toEqual([
      { type: "ACTION", payload: { categoryId: "a", type: "VOTE_CATEGORY" } },
    ]);
    vm.destroy();
  });

  it("is empty without a room", () => {
    const { c, vm } = voting();
    c.manager.dispose();
    expect([vm.options, vm.myVote, vm.votesCast, vm.votesExpected, vm.roundLabel]).toEqual([
      [],
      "",
      0,
      0,
      "Round 0 of 0",
    ]);
    vm.destroy();
  });
});

describe("PromptingViewModel", () => {
  function writing() {
    const c = connectedClient({}, "Prompting");
    const mine = addMine(c.state, c.manager.playerId);
    mine.prompts.push(prompt("m1", "First prompt"), prompt("m2", "Second prompt"));
    c.state.progress.set(c.manager.playerId, 0);
    c.state.progress.set("other-1234", 1);
    c.state.answersPerPlayer = 2;
    c.state.roundNumber = 1;
    c.state.totalRounds = 3;
    countdownTo(c, 90);
    return { c, mine, vm: new PromptingViewModel(c.manager) };
  }

  it("shows my prompts from my private entry", () => {
    const { vm } = writing();
    expect(vm.prompts.map((p) => p.promptText)).toEqual(["First prompt", "Second prompt"]);
    expect(vm.current?.matchupId).toBe("m1");
    expect(vm.roundLabel).toBe("Round 1 of 3");
    expect(vm.secondsLeft).toBe(90);
    expect(vm.isUrgent).toBe(false);
    expect(vm.answersIn).toBe(1);
    expect(vm.answersExpected).toBe(4);
    vm.destroy();
  });

  it("keeps a draft per prompt and counts characters", () => {
    const { vm } = writing();
    vm.setDraft("hello");
    expect(vm.draft).toBe("hello");
    expect(vm.charsRemaining).toBe(195);
    expect(vm.canSubmit).toBe(true);
    vm.goTo(1);
    expect(vm.draft).toBe("");
    expect(vm.canSubmit).toBe(false);
    vm.setDraft("   ");
    expect(vm.canSubmit).toBe(false);
    vm.setDraft("x".repeat(201));
    expect(vm.canSubmit).toBe(false);
    vm.goTo(0);
    expect(vm.draft).toBe("hello");
    vm.destroy();
  });

  it("clamps navigation", () => {
    const { vm } = writing();
    vm.goTo(-3);
    expect(vm.currentIndex).toBe(0);
    vm.goTo(9);
    expect(vm.currentIndex).toBe(1);
    vm.destroy();
  });

  it("submits the trimmed answer and moves on to the next prompt", async () => {
    const { c, vm } = writing();
    vm.setDraft("  a witty line  ");
    await vm.submit();
    expect(withoutTyping(c)).toEqual([
      {
        type: "ACTION",
        payload: { matchupId: "m1", answer: "a witty line", type: "SUBMIT_ANSWER" },
      },
    ]);
    expect(vm.currentIndex).toBe(1);
    vm.setDraft("last one");
    await vm.submit();
    expect(vm.currentIndex).toBe(1);
    vm.destroy();
  });

  it("stays on the prompt when the server rejects the answer", async () => {
    const { c, vm } = writing();
    c.room.reply = { ok: false, error: { code: "WRONG_PHASE", message: "Too late" } };
    vm.setDraft("late");
    await vm.submit();
    expect(vm.currentIndex).toBe(0);
    expect(c.manager.lastServerError?.message).toBe("Too late");
    vm.destroy();
  });

  it("does not submit an empty draft or without prompts", async () => {
    const { c, vm } = writing();
    await vm.submit();
    c.state.mine.get(c.manager.playerId)?.prompts.clear();
    vm.setDraft("orphan");
    await vm.submit();
    expect(c.room.requests).toEqual([]);
    expect(vm.draft).toBe("");
    vm.destroy();
  });

  it("knows when everything was accepted, from the server", () => {
    const { c, mine, vm } = writing();
    expect(vm.allSubmitted).toBe(false);
    for (const p of mine.prompts) p.submitted = true;
    c.patch();
    expect(vm.allSubmitted).toBe(true);
    expect(vm.current?.submitted).toBe(true);
    vm.destroy();
  });

  it("copes with no prompts yet and no room", () => {
    const c = connectedClient({}, "Prompting");
    const vm = new PromptingViewModel(c.manager);
    expect(vm.prompts).toEqual([]);
    expect(vm.allSubmitted).toBe(false);
    expect(vm.isSittingOut).toBe(true);
    expect(vm.categoryLabel).toBe("");
    c.manager.dispose();
    expect([vm.answersIn, vm.answersExpected, vm.roundLabel]).toEqual([0, 0, "Round 0 of 0"]);
    expect(vm.categoryLabel).toBe("");
    vm.destroy();
  });
});

describe("MatchupVoteViewModel", () => {
  function voting(mine: { canVote: boolean; isOwnMatchup: boolean; matchupVote?: string }) {
    const c = connectedClient({}, "MatchupVoting");
    c.state.matchups.push(
      matchup("m1", "Done", [answer("x", "old")], { isRevealed: true }),
      matchup("m2", "Name a fruit", [answer("a1", "Mango"), answer("a2", "Kiwi")]),
    );
    c.state.activeMatchupIndex = 1;
    c.state.votesCast = 1;
    c.state.votesExpected = 3;
    countdownTo(c, 20);
    addMine(c.state, c.manager.playerId, mine);
    return { c, vm: new MatchupVoteViewModel(c.manager) };
  }

  it("shows the prompt and answers with no authors or counts", () => {
    const { vm } = voting({ canVote: true, isOwnMatchup: false });
    expect(vm.promptText).toBe("Name a fruit");
    expect(vm.matchupNumber).toBe(2);
    expect(vm.totalMatchups).toBe(2);
    expect(vm.choices).toEqual([
      { id: "a1", text: "Mango", isMine: false },
      { id: "a2", text: "Kiwi", isMine: false },
    ]);
    expect(vm.votesCast).toBe(1);
    expect(vm.votesExpected).toBe(3);
    expect(vm.secondsLeft).toBe(20);
    expect(vm.isUrgent).toBe(false);
    vm.destroy();
  });

  it("highlights only my own vote", () => {
    const { vm } = voting({ canVote: true, isOwnMatchup: false, matchupVote: "a2" });
    expect(vm.choices.map((c) => c.isMine)).toEqual([false, true]);
    vm.destroy();
  });

  it("casts a vote when allowed", async () => {
    const { c, vm } = voting({ canVote: true, isOwnMatchup: false });
    await vm.vote("a1");
    expect(c.room.requests).toEqual([
      { type: "ACTION", payload: { answerId: "a1", type: "CAST_VOTE" } },
    ]);
    vm.destroy();
  });

  it("does not offer a vote to the author of the matchup", async () => {
    const { c, vm } = voting({ canVote: false, isOwnMatchup: true });
    expect(vm.isOwnMatchup).toBe(true);
    expect(vm.canVote).toBe(false);
    await vm.vote("a1");
    expect(c.room.requests).toEqual([]);
    vm.destroy();
  });

  it("does not offer a vote on a forfeit", () => {
    const { c, vm } = voting({ canVote: true, isOwnMatchup: false });
    const active = c.state.matchups[1];
    if (active) active.isForfeit = true;
    expect(vm.isForfeit).toBe(true);
    expect(vm.canVote).toBe(false);
    vm.destroy();
  });

  it("is empty before a matchup and without my private entry", () => {
    const c = connectedClient({}, "MatchupVoting");
    const vm = new MatchupVoteViewModel(c.manager);
    expect([vm.promptText, vm.choices, vm.canVote, vm.isOwnMatchup, vm.isForfeit]).toEqual([
      "",
      [],
      false,
      false,
      false,
    ]);
    c.manager.dispose();
    expect([vm.matchupNumber, vm.totalMatchups, vm.votesCast, vm.votesExpected]).toEqual([
      0, 0, 0, 0,
    ]);
    vm.destroy();
  });
});

describe("MatchupRevealViewModel and Results recap", () => {
  function revealed() {
    const c = connectedClient({}, "MatchupReveal");
    c.state.matchups.push(
      matchup(
        "m1",
        "Name a fruit",
        [
          answer("a1", "Mango", {
            votes: 3,
            authorId: c.manager.playerId,
            authorName: "Me",
            isWinner: true,
          }),
          answer("a2", "Kiwi", { votes: 0, authorId: "other-1234", authorName: "Zed" }),
        ],
        { isRevealed: true, isClash: true },
      ),
      matchup("m2", "Hidden", [answer("b1", "?")]),
    );
    c.state.activeMatchupIndex = 0;
    countdownTo(c, 5);
    return { c, vm: new MatchupRevealViewModel(c.manager) };
  }

  it("shows who wrote what, the counts and the winner as the server published them", () => {
    const { vm } = revealed();
    expect(vm.matchup).toEqual({
      promptText: "Name a fruit",
      isForfeit: false,
      isClash: true,
      answers: [
        { id: "a1", text: "Mango", votes: 3, authorName: "Me", isWinner: true, isMine: true },
        { id: "a2", text: "Kiwi", votes: 0, authorName: "Zed", isWinner: false, isMine: false },
      ],
    });
    expect(vm.matchupNumber).toBe(1);
    expect(vm.totalMatchups).toBe(2);
    expect(vm.secondsLeft).toBe(5);
    vm.destroy();
  });

  it("shows nothing until the matchup is revealed or when there is none", () => {
    const { c, vm } = revealed();
    c.state.activeMatchupIndex = 1;
    expect(vm.matchup).toBeUndefined();
    c.state.activeMatchupIndex = -1;
    expect(vm.matchup).toBeUndefined();
    c.manager.dispose();
    expect([vm.matchup, vm.matchupNumber, vm.totalMatchups]).toEqual([undefined, 0, 0]);
    vm.destroy();
  });

  it("lists only revealed matchups in the results", () => {
    const { c } = revealed();
    const results = new ResultsViewModel(c.manager);
    expect(results.matchups.map((m) => m.promptText)).toEqual(["Name a fruit"]);
  });
});

describe("ResultsViewModel", () => {
  function results(role: "host" | "player", isFinalRound: boolean) {
    const c = connectedClient({ role }, "Results");
    c.state.isFinalRound = isFinalRound;
    c.state.roundNumber = isFinalRound ? 3 : 1;
    c.state.totalRounds = 3;
    c.state.scoreboard.push(
      scoreRow("ann", 500, { name: "Ann" }),
      scoreRow("bob", 500, { name: "Bob" }),
      scoreRow("cy", 100),
    );
    return { c, vm: new ResultsViewModel(c.manager) };
  }

  it("crowns every top-ranked player after the final round", () => {
    const { vm } = results("player", true);
    expect(vm.champions.map((r) => r.name)).toEqual(["Ann", "Bob"]);
    expect(vm.roundLabel).toBe("Round 3 of 3");
  });

  it("never crowns a player who left, even on the top score", () => {
    const c = connectedClient({}, "Results");
    c.state.isFinalRound = true;
    c.state.scoreboard.push(
      scoreRow("ann", 100, { name: "Ann" }),
      scoreRow("gus", 900, { name: "Gus", hasLeft: true }),
    );
    expect(new ResultsViewModel(c.manager).champions.map((r) => r.name)).toEqual(["Ann"]);
  });

  it("has no champion mid-game", () => {
    expect(results("player", false).vm.champions).toEqual([]);
  });

  it("offers the host the next step and nobody else", async () => {
    const midGame = results("host", false);
    expect([midGame.vm.showNextRound, midGame.vm.showPlayAgain]).toEqual([true, false]);
    await midGame.vm.nextRound();
    const final = results("host", true);
    expect([final.vm.showNextRound, final.vm.showPlayAgain]).toEqual([false, true]);
    await final.vm.playAgain();
    const guest = results("player", true);
    expect([guest.vm.isHost, guest.vm.showNextRound, guest.vm.showPlayAgain]).toEqual([
      false,
      false,
      false,
    ]);
    expect(midGame.c.room.requests).toEqual([{ type: "ACTION", payload: { type: "NEXT_ROUND" } }]);
    expect(final.c.room.requests).toEqual([{ type: "ACTION", payload: { type: "PLAY_AGAIN" } }]);
  });

  it("defaults without a room", () => {
    const { c, vm } = results("host", true);
    c.manager.dispose();
    expect([vm.isFinalRound, vm.roundLabel, vm.champions, vm.matchups]).toEqual([
      false,
      "Round 0 of 0",
      [],
      [],
    ]);
  });
});
