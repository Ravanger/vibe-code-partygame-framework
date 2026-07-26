import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { PromptingViewModel } from "../../ui/viewmodels/PromptingViewModel.svelte.js";
import { fakeManager, makeFakeRoom, makeFakeState } from "../helpers/fakes.js";

describe("PromptingViewModel", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows both assigned prompts", () => {
    const room = makeFakeRoom();
    room.onMessage = vi.fn((type: string, cb: (p: any) => void) => {
      if (type === "YOUR_PROMPTS") {
        cb([
          { matchupId: "m1", promptText: "Q1" },
          { matchupId: "m2", promptText: "Q2" },
        ]);
      }
    });
    const vm = new PromptingViewModel(fakeManager({ room }) as never);
    expect(vm.myPrompts).toHaveLength(2);
  });

  it("starts on the first prompt", () => {
    const room = makeFakeRoom();
    room.onMessage = vi.fn((type: string, cb: (p: any) => void) => {
      if (type === "YOUR_PROMPTS") {
        cb([
          { matchupId: "m1", promptText: "Q1" },
          { matchupId: "m2", promptText: "Q2" },
        ]);
      }
    });
    const vm = new PromptingViewModel(fakeManager({ room }) as never);
    expect(vm.currentIndex).toBe(0);
  });

  it("shows an empty draft per prompt", () => {
    const room = makeFakeRoom();
    room.onMessage = vi.fn((type: string, cb: (p: any) => void) => {
      if (type === "YOUR_PROMPTS") {
        cb([{ matchupId: "m1", promptText: "Q1" }]);
      }
    });
    const vm = new PromptingViewModel(fakeManager({ room }) as never);
    expect(vm.draft).toBe("");
  });

  it("keeps drafts separate per prompt", () => {
    const room = makeFakeRoom();
    room.onMessage = vi.fn((type: string, cb: (p: any) => void) => {
      if (type === "YOUR_PROMPTS") {
        cb([
          { matchupId: "m1", promptText: "Q1" },
          { matchupId: "m2", promptText: "Q2" },
        ]);
      }
    });
    const vm = new PromptingViewModel(fakeManager({ room }) as never);
    vm.setDraft("one");
    vm.goTo(1);
    vm.setDraft("two");
    vm.goTo(0);
    expect(vm.draft).toBe("one");
  });

  it("reports remaining characters", () => {
    const room = makeFakeRoom();
    room.onMessage = vi.fn((type: string, cb: (p: any) => void) => {
      if (type === "YOUR_PROMPTS") {
        cb([{ matchupId: "m1", promptText: "Q1" }]);
      }
    });
    const vm = new PromptingViewModel(fakeManager({ room }) as never);
    vm.setDraft("hi");
    expect(vm.charsRemaining).toBe(198);
  });

  it("blocks submit on a blank or whitespace draft", () => {
    const room = makeFakeRoom();
    room.onMessage = vi.fn((type: string, cb: (p: any) => void) => {
      if (type === "YOUR_PROMPTS") {
        cb([{ matchupId: "m1", promptText: "Q1" }]);
      }
    });
    const vm = new PromptingViewModel(fakeManager({ room }) as never);
    vm.setDraft("   ");
    expect(vm.canSubmit).toBe(false);
  });

  it("blocks submit over 200 characters", () => {
    const room = makeFakeRoom();
    room.onMessage = vi.fn((type: string, cb: (p: any) => void) => {
      if (type === "YOUR_PROMPTS") {
        cb([{ matchupId: "m1", promptText: "Q1" }]);
      }
    });
    const vm = new PromptingViewModel(fakeManager({ room }) as never);
    vm.setDraft("x".repeat(201));
    expect(vm.canSubmit).toBe(false);
  });

  it("sends SUBMIT_ANSWER with the matchupId and trimmed text", () => {
    const room = makeFakeRoom();
    room.onMessage = vi.fn((type: string, cb: (p: any) => void) => {
      if (type === "YOUR_PROMPTS") {
        cb([{ matchupId: "m0", promptText: "Q1" }]);
      }
    });
    const vm = new PromptingViewModel(fakeManager({ room }) as never);
    vm.setDraft("  cake  ");
    vm.submit();
    expect(room.send).toHaveBeenCalledWith("ACTION", {
      type: "SUBMIT_ANSWER",
      matchupId: "m0",
      answer: "cake",
    });
  });

  it("advances to the second prompt after submitting the first", () => {
    const room = makeFakeRoom();
    room.onMessage = vi.fn((type: string, cb: (p: any) => void) => {
      if (type === "YOUR_PROMPTS") {
        cb([
          { matchupId: "m0", promptText: "Q1" },
          { matchupId: "m1", promptText: "Q2" },
        ]);
      }
    });
    const vm = new PromptingViewModel(fakeManager({ room }) as never);
    vm.setDraft("answer");
    vm.submit();
    expect(vm.currentIndex).toBe(1);
  });

  it("reports allSubmitted only once both are in", () => {
    const room = makeFakeRoom();
    room.onMessage = vi.fn((type: string, cb: (p: any) => void) => {
      if (type === "YOUR_PROMPTS") {
        cb([
          { matchupId: "m0", promptText: "Q1" },
          { matchupId: "m1", promptText: "Q2" },
        ]);
      }
    });
    const vm = new PromptingViewModel(fakeManager({ room }) as never);
    expect(vm.allSubmitted).toBe(false);
    vm.setDraft("a1");
    vm.submit();
    expect(vm.allSubmitted).toBe(false);
    vm.setDraft("a2");
    vm.submit();
    expect(vm.allSubmitted).toBe(true);
  });

  it("still allows editing a submitted answer before the deadline", () => {
    const room = makeFakeRoom();
    room.onMessage = vi.fn((type: string, cb: (p: any) => void) => {
      if (type === "YOUR_PROMPTS") {
        cb([{ matchupId: "m0", promptText: "Q1" }]);
      }
    });
    const vm = new PromptingViewModel(fakeManager({ room }) as never);
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
    const state = makeFakeState({ answersSubmitted: 3, answersExpected: 6 });
    const room = makeFakeRoom({ state });
    room.onMessage = vi.fn((type: string, cb: (p: any) => void) => {
      if (type === "YOUR_PROMPTS") {
        cb([{ matchupId: "m0", promptText: "Q1" }]);
      }
    });
    const vm = new PromptingViewModel(fakeManager({ room }) as never);
    expect(vm.progress).toBe("3 of 6 answers in");
  });

  it("handles YOUR_PROMPTS arriving after construction (reconnect)", () => {
    const room = makeFakeRoom();
    let callback: (msg: any) => void = () => {};
    room.onMessage = vi.fn((type: string, cb: (p: any) => void) => {
      if (type === "YOUR_PROMPTS") {
        callback = cb;
      }
    });
    const vm = new PromptingViewModel(fakeManager({ room }) as never);
    expect(vm.myPrompts).toHaveLength(0);
    callback([
      { matchupId: "m0", promptText: "Q1" },
      { matchupId: "m1", promptText: "Q2" },
    ]);
    expect(vm.myPrompts).toHaveLength(2);
  });

  it("shows a waiting state when the player has no prompts", () => {
    const room = makeFakeRoom();
    room.onMessage = vi.fn();
    const vm = new PromptingViewModel(fakeManager({ room }) as never);
    expect(vm.myPrompts).toHaveLength(0);
    expect(vm.current).toBeUndefined();
  });

  it("delegates the countdown to Countdown and clears it on destroy", () => {
    const state = makeFakeState({
      phaseEndsAt: Date.now() + 60000,
      serverNow: Date.now(),
    });
    const room = makeFakeRoom({ state });
    room.onMessage = vi.fn((type: string, cb: (p: any) => void) => {
      if (type === "YOUR_PROMPTS") {
        cb([{ matchupId: "m0", promptText: "Q1" }]);
      }
    });
    const vm = new PromptingViewModel(fakeManager({ room }) as never);
    expect(vm.countdown).toBeDefined();
    const initialTimerCount = vi.getTimerCount();
    vm.destroy();
    expect(vi.getTimerCount()).toBeLessThan(initialTimerCount);
  });
});
