import { BaseGameState } from "@partygame/shared/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameConnectionManager } from "../src/GameConnectionManager.svelte.js";
import { StubRoom } from "../src/testing.js";

let counter = 0;
const managers: GameConnectionManager[] = [];

function setup(matchMedia?: (query: string) => { matches: boolean }) {
  const manager = new GameConnectionManager({
    endpoint: "ws://localhost:2567",
    roomName: "stub",
    storagePrefix: `feedback${++counter}`,
    ...(matchMedia === undefined ? {} : { matchMedia }),
  });
  managers.push(manager);
  const state = new BaseGameState();
  state.roomCode = "ABCD";
  return { manager, state, room: new StubRoom(state) };
}

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose();
  vi.useRealTimers();
});

describe("FeedbackBus", () => {
  it("emits a phase event once when state.phase changes", () => {
    const { manager, state, room } = setup(() => ({ matches: false }));
    const seen: unknown[] = [];
    manager.feedback.on("phase", (event) => seen.push(event));
    manager.attach(room);
    room.patch(); // the first observation after connecting is the silent baseline
    state.phase = "Playing";
    room.patch();
    expect(seen).toEqual([{ type: "phase", from: "Lobby", to: "Playing", reducedMotion: false }]);
    state.phase = "Playing";
    room.patch();
    expect(seen).toHaveLength(1); // an unchanged phase emits nothing
    state.phase = "Results";
    room.patch();
    expect(seen).toEqual([
      { type: "phase", from: "Lobby", to: "Playing", reducedMotion: false },
      { type: "phase", from: "Playing", to: "Results", reducedMotion: false },
    ]);
  });

  it("emits urgent once per phase while the countdown is in its last ten seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const { manager, state, room } = setup(() => ({ matches: false }));
    const seen: unknown[] = [];
    manager.feedback.on("urgent", (event) => seen.push(event));
    manager.attach(room);

    state.serverNow = 1_000_000;
    state.phaseEndsAt = 1_060_000; // a minute left: not urgent yet
    room.patch();
    await vi.advanceTimersByTimeAsync(250);
    expect(seen).toHaveLength(0);

    state.phaseEndsAt = 1_004_750; // inside the ten-second window
    room.patch();
    await vi.advanceTimersByTimeAsync(250);
    expect(seen).toEqual([{ type: "urgent", reducedMotion: false }]);
    await vi.advanceTimersByTimeAsync(1_000); // still urgent: no repeat
    expect(seen).toHaveLength(1);

    state.phase = "Playing"; // a new phase may become urgent again
    room.patch();
    await vi.advanceTimersByTimeAsync(250);
    expect(seen).toHaveLength(2);
  });

  it("does not emit urgent for an expired timer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const { manager, state, room } = setup(() => ({ matches: false }));
    const seen: unknown[] = [];
    manager.feedback.on("urgent", (event) => seen.push(event));
    manager.attach(room);
    state.serverNow = 1_000_000;
    state.phaseEndsAt = 900_000; // already in the past
    room.patch();
    await vi.advanceTimersByTimeAsync(500);
    expect(seen).toHaveLength(0);
  });

  it("relays server broadcasts for registered names and stops when the last listener leaves", () => {
    const { manager, room } = setup(() => ({ matches: false }));
    const seen: unknown[] = [];
    manager.feedback.on("message", (event) => seen.push(event));
    manager.attach(room);

    const offA = manager.onMessage("cheer", () => {});
    const offB = manager.onMessage("cheer", () => {});
    room.push("cheer", { round: 2 });
    expect(seen).toEqual([
      { type: "message", name: "cheer", payload: { round: 2 }, reducedMotion: false },
    ]);

    offA();
    room.push("cheer", { round: 3 });
    expect(seen).toHaveLength(2); // one listener left: still relayed, once per broadcast

    offB();
    offB(); // a second unsubscribe is a no-op
    room.push("cheer", { round: 4 });
    expect(seen).toHaveLength(2); // the last listener went: the relay is removed

    room.push("boo", { x: 1 }); // never registered
    expect(seen).toHaveLength(2);
  });

  it("stamps every event with the current reducedMotion preference", () => {
    let reduce = true;
    const { manager, state, room } = setup(() => ({ matches: reduce }));
    const seen: unknown[] = [];
    manager.feedback.on("phase", (event) => seen.push(event));
    manager.attach(room);
    room.patch();
    state.phase = "Playing";
    room.patch();
    reduce = false;
    state.phase = "Results";
    room.patch();
    expect(seen).toEqual([
      { type: "phase", from: "Lobby", to: "Playing", reducedMotion: true },
      { type: "phase", from: "Playing", to: "Results", reducedMotion: false },
    ]);
  });

  it("off() stops delivery for one listener without affecting the others", () => {
    const { manager, state, room } = setup(() => ({ matches: false }));
    const seen: unknown[] = [];
    const offFirst = manager.feedback.on("phase", (event) => seen.push(event));
    const seenBySecond: unknown[] = [];
    manager.feedback.on("phase", (event) => seenBySecond.push(event));
    manager.attach(room);
    room.patch();
    state.phase = "Playing";
    room.patch();
    expect(seen).toHaveLength(1);
    expect(seenBySecond).toHaveLength(1);
    offFirst();
    state.phase = "Results";
    room.patch();
    expect(seen).toHaveLength(1);
    expect(seenBySecond).toHaveLength(2);
  });

  it("emits nothing before a room is attached, and reacts to no room after dispose", () => {
    const { manager, state, room } = setup(() => ({ matches: false }));
    const seen: unknown[] = [];
    for (const kind of ["phase", "urgent", "message"] as const) {
      manager.feedback.on(kind, (event) => seen.push(event));
    }
    manager.onMessage("cheer", () => {});
    state.phase = "Playing";
    room.patch();
    room.push("cheer", { round: 1 });
    expect(seen).toHaveLength(0);

    manager.attach(room);
    room.patch(); // baseline: the phase observed first after connecting
    state.phase = "Results";
    room.patch();
    room.push("cheer", { round: 2 });
    expect(seen).toEqual([
      { type: "phase", from: "Playing", to: "Results", reducedMotion: false },
      { type: "message", name: "cheer", payload: { round: 2 }, reducedMotion: false },
    ]);

    manager.dispose();
    state.phase = "Lobby";
    room.patch(); // the old room still fires; the manager has left it
    expect(seen).toHaveLength(2);
  });

  it("falls back to window.matchMedia when no matchMedia option is given", () => {
    vi.stubGlobal("matchMedia", (_query: string) => ({ matches: true }));
    const { manager, state, room } = setup();
    const seen: unknown[] = [];
    manager.feedback.on("phase", (event) => seen.push(event));
    manager.attach(room);
    room.patch();
    state.phase = "Playing";
    room.patch();
    expect(seen).toEqual([{ type: "phase", from: "Lobby", to: "Playing", reducedMotion: true }]);
  });
});
