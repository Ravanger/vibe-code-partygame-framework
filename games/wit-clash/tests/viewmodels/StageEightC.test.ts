import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BestAnswer } from "../../src/state.js";
import { AnswerProgress } from "../../ui/viewmodels/AnswerProgress.js";
import { Podium } from "../../ui/viewmodels/Podium.js";
import { PromptingViewModel } from "../../ui/viewmodels/PromptingViewModel.svelte.js";
import { ResultsViewModel } from "../../ui/viewmodels/ResultsViewModel.js";
import { Scoreboard } from "../../ui/viewmodels/Scoreboard.js";
import { TieBreakerViewModel } from "../../ui/viewmodels/TieBreakerViewModel.svelte.js";
import {
  addMine,
  addSeat,
  type Client,
  connectedClient,
  matchup,
  prompt,
  scoreRow,
} from "../helpers/client.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Podium", () => {
  function podium(...scores: number[]) {
    const c = connectedClient({}, "Results");
    scores.forEach((score, index) => {
      c.state.scoreboard.push(scoreRow(`p${index}`, score, { name: `P${index}` }));
    });
    return new Podium(new Scoreboard(c.manager)).steps;
  }

  it("is empty without a scoreboard", () => {
    expect(podium()).toEqual([]);
  });

  it("puts the winner in the middle, the runner-up on the left and third on the right", () => {
    const steps = podium(300, 200, 100, 50);
    expect(steps.map((s) => [s.rank, s.tier, s.label, s.players.map((p) => p.name)])).toEqual([
      [2, 2, "2nd", ["P1"]],
      [1, 1, "1st", ["P0"]],
      [3, 3, "3rd", ["P2"]],
    ]);
  });

  it("keeps leavers off the podium and ranks them below seated players", () => {
    const c = connectedClient({}, "Results");
    c.state.scoreboard.push(
      scoreRow("a", 10, { name: "A" }),
      scoreRow("g", 10, { name: "G", hasLeft: true }),
    );
    const board = new Scoreboard(c.manager);
    expect(board.rows.map((r) => [r.name, r.rank])).toEqual([
      ["A", 1],
      ["G", 2],
    ]);
    expect(new Podium(board).steps.map((s) => s.players.map((p) => p.name))).toEqual([["A"]]);
  });

  it("shows a single player alone", () => {
    expect(podium(10).map((s) => s.label)).toEqual(["1st"]);
  });

  it("shows two players", () => {
    expect(podium(10, 5).map((s) => s.label)).toEqual(["2nd", "1st"]);
  });

  it("lets tied players share a step and gives the next tier the next step", () => {
    const steps = podium(300, 300, 100, 100);
    expect(steps.map((s) => [s.rank, s.tier, s.label, s.players.map((p) => p.name)])).toEqual([
      [3, 2, "2nd", ["P2", "P3"]],
      [1, 1, "1st", ["P0", "P1"]],
    ]);
  });

  it("fills three steps by tier and labels steps by tier, not competition rank", () => {
    const steps = podium(300, 300, 100, 50, 20);
    expect(steps.map((s) => [s.tier, s.label, s.players.length])).toEqual([
      [2, "2nd", 1],
      [1, "1st", 2],
      [3, "3rd", 1],
    ]);
  });
});

describe("ResultsViewModel copy", () => {
  it("words the champion line and the wait by the end of the game", () => {
    const c = connectedClient({}, "Results");
    const vm = new ResultsViewModel(c.manager);
    expect(vm.championLine).toBe("");
    expect(vm.waitingText).toBe("Waiting for host to continue...");
    c.state.isFinalRound = true;
    c.state.scoreboard.push(scoreRow("a", 5, { name: "Ann" }), scoreRow("b", 5, { name: "Bo" }));
    expect(vm.championLine).toBe("Ann & Bo win with 5 points!");
    expect(vm.waitingText).toBe("Waiting for host to start a new game...");
  });
});

describe("AnswerProgress", () => {
  it("lists every answering player with progress, completion and typing", () => {
    const c = connectedClient({ name: "Me" }, "Prompting");
    addSeat(c.state, "zed-12345", { name: "Zed" });
    addSeat(c.state, "amy-12345", { name: "Amy" });
    c.state.answersPerPlayer = 2;
    c.state.progress.set(c.manager.playerId, 1);
    c.state.progress.set("zed-12345", 2);
    c.state.progress.set("amy-12345", 0);
    c.state.typing.set(c.manager.playerId, true);
    c.state.typing.set("zed-12345", true);
    const { rows } = new AnswerProgress(c.manager);
    expect(rows).toEqual([
      {
        playerId: c.manager.playerId,
        name: "Me",
        answered: 1,
        expected: 2,
        done: false,
        typing: true,
        isMe: true,
      },
      {
        playerId: "zed-12345",
        name: "Zed",
        answered: 2,
        expected: 2,
        done: true,
        typing: false,
        isMe: false,
      },
      {
        playerId: "amy-12345",
        name: "Amy",
        answered: 0,
        expected: 2,
        done: false,
        typing: false,
        isMe: false,
      },
    ]);
  });

  it("never calls anyone done before answers are expected, and copes with unknown players", () => {
    const c = connectedClient({}, "Prompting");
    c.state.progress.set("ghost", 0);
    const [row] = new AnswerProgress(c.manager).rows;
    expect(row).toMatchObject({ name: "", done: false });
  });

  it("is empty when disconnected", () => {
    const c = connectedClient({}, "Prompting");
    const progress = new AnswerProgress(c.manager);
    c.manager.dispose();
    expect(progress.rows).toEqual([]);
  });
});

describe("ResultsViewModel awards", () => {
  function best(text: string, authorId: string, votes: number) {
    return Object.assign(new BestAnswer(), {
      text,
      authorId,
      authorName: authorId,
      promptText: "Q",
      votes,
    });
  }

  it("lists a single best answer and flags my own", () => {
    const c = connectedClient({}, "Results");
    c.state.bestAnswers.push(best("Mango", c.manager.playerId, 3));
    const vm = new ResultsViewModel(c.manager);
    expect(vm.bestAnswerTitle).toBe("Best answer");
    expect(vm.bestAnswers).toEqual([
      { text: "Mango", promptText: "Q", authorName: c.manager.playerId, votes: 3, isMine: true },
    ]);
  });

  it("calls several a shared award", () => {
    const c = connectedClient({}, "Results");
    c.state.bestAnswers.push(best("A", "x", 3), best("B", "y", 3));
    expect(new ResultsViewModel(c.manager).bestAnswerTitle).toBe("Shared best answer");
  });

  it("exposes the podium and copes with no state", () => {
    const c = connectedClient({}, "Results");
    const vm = new ResultsViewModel(c.manager);
    c.state.scoreboard.push(scoreRow("a", 1, { wonTieBreaker: true }));
    expect(vm.podiumSteps[0]?.players[0]?.wonTieBreaker).toBe(true);
    c.manager.dispose();
    expect(vm.bestAnswers).toEqual([]);
    expect(vm.podiumSteps).toEqual([]);
  });
});

function typingMessages(c: Client): boolean[] {
  return c.room.requests.flatMap((r) => {
    const payload = r.payload;
    if (typeof payload !== "object" || payload === null) return [];
    if (!("type" in payload) || payload.type !== "SET_TYPING") return [];
    return "typing" in payload ? [payload.typing === true] : [];
  });
}

describe("typing reports from the Prompting viewmodel", () => {
  function writing() {
    const c = connectedClient({}, "Prompting");
    addMine(c.state, c.manager.playerId).prompts.push(prompt("m1", "Q1"), prompt("m2", "Q2"));
    return { c, vm: new PromptingViewModel(c.manager) };
  }

  it("says true once on the first keystroke and false after 2.5 s of quiet", () => {
    const { c, vm } = writing();
    vm.setDraft("a");
    vm.setDraft("ab");
    vm.setDraft("abc");
    expect(typingMessages(c)).toEqual([true]);
    vi.advanceTimersByTime(2400);
    vm.setDraft("abcd");
    vi.advanceTimersByTime(2400);
    expect(typingMessages(c)).toEqual([true]);
    vi.advanceTimersByTime(100);
    expect(typingMessages(c)).toEqual([true, false]);
    vi.advanceTimersByTime(10_000);
    expect(typingMessages(c)).toEqual([true, false]);
    vm.setDraft("x");
    expect(typingMessages(c)).toEqual([true, false, true]);
    vm.destroy();
  });

  it("says false when the answer is submitted, and stays quiet when nothing was typed", async () => {
    const { c, vm } = writing();
    await vm.submit();
    expect(typingMessages(c)).toEqual([]);
    vm.setDraft("Mango");
    await vm.submit();
    expect(typingMessages(c)).toEqual([true, false]);
    vi.advanceTimersByTime(5000);
    expect(typingMessages(c)).toEqual([true, false]);
    vm.destroy();
  });

  it("says false when leaving the screen mid-sentence", () => {
    const { c, vm } = writing();
    vm.setDraft("x");
    vm.destroy();
    expect(typingMessages(c)).toEqual([true, false]);
  });

  it("reports nothing without a prompt to answer", () => {
    const c = connectedClient({}, "Prompting");
    const vm = new PromptingViewModel(c.manager);
    vm.setDraft("x");
    expect(typingMessages(c)).toEqual([]);
    vm.destroy();
  });

  it("exposes the progress of everyone", () => {
    const { c, vm } = writing();
    c.state.answersPerPlayer = 2;
    c.state.progress.set(c.manager.playerId, 1);
    expect(vm.progress.rows).toHaveLength(1);
    vm.destroy();
  });
});

describe("typing reports from the TieBreakerViewModel", () => {
  function contender() {
    const c = connectedClient({}, "TieBreakerPrompting");
    c.state.tieBreakers.push(matchup("tb1", "Name a bird", []));
    c.state.tieBreakerContenders.push(c.manager.playerId);
    return { c, vm: new TieBreakerViewModel(c.manager) };
  }

  it("reports one change per burst of typing", () => {
    const { c, vm } = contender();
    vm.setDraft("P");
    vm.setDraft("Pi");
    expect(typingMessages(c)).toEqual([true]);
    vi.advanceTimersByTime(2500);
    expect(typingMessages(c)).toEqual([true, false]);
    vm.destroy();
  });

  it("says false on submit", async () => {
    const { c, vm } = contender();
    vm.setDraft("Pigeon");
    await vm.submit();
    expect(typingMessages(c)).toEqual([true, false]);
    vm.destroy();
  });

  it("exposes the progress of the contenders", () => {
    const { c, vm } = contender();
    c.state.answersPerPlayer = 1;
    c.state.progress.set(c.manager.playerId, 0);
    expect(vm.progress.rows[0]?.expected).toBe(1);
    vm.destroy();
  });
});
