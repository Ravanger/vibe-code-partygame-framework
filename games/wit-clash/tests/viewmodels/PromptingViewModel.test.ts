import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PromptingViewModel } from "../../ui/viewmodels/PromptingViewModel.svelte.js";
import {
  type FakeManager,
  type FakeRoom,
  type FakeState,
  fakeManager,
  makeFakeRoom,
  makeFakeState,
} from "../helpers/fakes.js";

interface Prompt {
  matchupId: string;
  promptText: string;
}

// Prompts arrive via the manager (which captures the one-shot YOUR_PROMPTS
// message at connect time), so tests seed manager.myPrompts directly.
function makeVm(
  prompts: Prompt[],
  stateOver: Partial<FakeState> = {},
): { vm: PromptingViewModel; room: FakeRoom; manager: FakeManager } {
  const room = makeFakeRoom({ state: makeFakeState(stateOver) });
  const manager = fakeManager({ room, myPrompts: prompts });
  const vm = new PromptingViewModel(manager as never);
  return { vm, room, manager };
}

describe("PromptingViewModel", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows both assigned prompts", () => {
    const { vm } = makeVm([
      { matchupId: "m1", promptText: "Q1" },
      { matchupId: "m2", promptText: "Q2" },
    ]);
    expect(vm.myPrompts).toHaveLength(2);
  });

  it("starts on the first prompt", () => {
    const { vm } = makeVm([
      { matchupId: "m1", promptText: "Q1" },
      { matchupId: "m2", promptText: "Q2" },
    ]);
    expect(vm.currentIndex).toBe(0);
  });

  it("shows an empty draft per prompt", () => {
    const { vm } = makeVm([{ matchupId: "m1", promptText: "Q1" }]);
    expect(vm.draft).toBe("");
  });

  it("keeps drafts separate per prompt", () => {
    const { vm } = makeVm([
      { matchupId: "m1", promptText: "Q1" },
      { matchupId: "m2", promptText: "Q2" },
    ]);
    vm.setDraft("one");
    vm.goTo(1);
    vm.setDraft("two");
    vm.goTo(0);
    expect(vm.draft).toBe("one");
  });

  it("reports remaining characters", () => {
    const { vm } = makeVm([{ matchupId: "m1", promptText: "Q1" }]);
    vm.setDraft("hi");
    expect(vm.charsRemaining).toBe(198);
  });

  it("blocks submit on a blank or whitespace draft", () => {
    const { vm } = makeVm([{ matchupId: "m1", promptText: "Q1" }]);
    vm.setDraft("   ");
    expect(vm.canSubmit).toBe(false);
  });

  it("blocks submit over 200 characters", () => {
    const { vm } = makeVm([{ matchupId: "m1", promptText: "Q1" }]);
    vm.setDraft("x".repeat(201));
    expect(vm.canSubmit).toBe(false);
  });

  it("sends SUBMIT_ANSWER with the matchupId and trimmed text", () => {
    const { vm, room } = makeVm([{ matchupId: "m0", promptText: "Q1" }]);
    vm.setDraft("  cake  ");
    vm.submit();
    expect(room.send).toHaveBeenCalledWith("ACTION", {
      type: "SUBMIT_ANSWER",
      matchupId: "m0",
      answer: "cake",
    });
  });

  it("advances to the second prompt after submitting the first", () => {
    const { vm } = makeVm([
      { matchupId: "m0", promptText: "Q1" },
      { matchupId: "m1", promptText: "Q2" },
    ]);
    vm.setDraft("answer");
    vm.submit();
    expect(vm.currentIndex).toBe(1);
  });

  it("reports allSubmitted only once both are in", () => {
    const { vm } = makeVm([
      { matchupId: "m0", promptText: "Q1" },
      { matchupId: "m1", promptText: "Q2" },
    ]);
    expect(vm.allSubmitted).toBe(false);
    vm.setDraft("a1");
    vm.submit();
    expect(vm.allSubmitted).toBe(false);
    vm.setDraft("a2");
    vm.submit();
    expect(vm.allSubmitted).toBe(true);
  });

  it("still allows editing a submitted answer before the deadline", () => {
    const { vm, room } = makeVm([{ matchupId: "m0", promptText: "Q1" }]);
    vm.setDraft("first");
    vm.submit();
    vm.setDraft("second");
    vm.submit();
    expect(room.send).toHaveBeenCalledWith("ACTION", {
      type: "SUBMIT_ANSWER",
      matchupId: "m0",
      answer: "first",
    });
    expect(room.send).toHaveBeenCalledWith("ACTION", {
      type: "SUBMIT_ANSWER",
      matchupId: "m0",
      answer: "second",
    });
  });

  it("shows overall progress as '3 of 6 answers in'", () => {
    const { vm } = makeVm([{ matchupId: "m0", promptText: "Q1" }], {
      answersSubmitted: 3,
      answersExpected: 6,
    });
    expect(vm.progress).toBe("3 of 6 answers in");
  });

  it("reflects prompts the manager captures after construction", () => {
    const { vm, manager } = makeVm([]);
    expect(vm.myPrompts).toHaveLength(0);
    manager.myPrompts = [
      { matchupId: "m0", promptText: "Q1" },
      { matchupId: "m1", promptText: "Q2" },
    ];
    expect(vm.myPrompts).toHaveLength(2);
  });

  it("shows a waiting state when the player has no prompts", () => {
    const { vm } = makeVm([]);
    expect(vm.myPrompts).toHaveLength(0);
    expect(vm.current).toBeUndefined();
  });

  it("delegates the countdown to Countdown and clears it on destroy", () => {
    const { vm } = makeVm([{ matchupId: "m0", promptText: "Q1" }], {
      phaseEndsAt: Date.now() + 60000,
      serverNow: Date.now(),
    });
    expect(vm.countdown).toBeDefined();
    const initialTimerCount = vi.getTimerCount();
    vm.destroy();
    expect(vi.getTimerCount()).toBeLessThan(initialTimerCount);
  });
});
