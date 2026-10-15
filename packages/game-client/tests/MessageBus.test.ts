import { BaseGameState } from "@partygame/shared/schema";
import { describe, expect, it } from "vitest";
import { GameConnectionManager } from "../src/GameConnectionManager.svelte.js";
import { MessageBus } from "../src/MessageBus.js";
import { StubRoom } from "../src/testing.js";

let counter = 0;
const newManager = () =>
  new GameConnectionManager({
    endpoint: "ws://localhost:2567",
    roomName: "stub",
    storagePrefix: `bus${++counter}`,
  });

describe("MessageBus", () => {
  it("on returns an unsubscribe that removes the listener", () => {
    const bus = new MessageBus();
    const room = new StubRoom(new BaseGameState());
    bus.bind(room);
    const off = bus.on("T", () => {});
    expect(room.messageListeners("T")).toBe(1);
    off();
    expect(room.messageListeners("T")).toBe(0);
  });

  it("bind attaches every registered listener to the room", () => {
    const bus = new MessageBus();
    const a: unknown[] = [];
    const b: unknown[] = [];
    bus.on("A", (payload) => a.push(payload));
    bus.on("B", (payload) => b.push(payload));
    const room = new StubRoom(new BaseGameState());
    bus.bind(room);
    room.push("A", 1);
    room.push("B", 2);
    expect(a).toEqual([1]);
    expect(b).toEqual([2]);
  });

  it("bind to another room detaches from the previous one first", () => {
    const bus = new MessageBus();
    const hits: string[] = [];
    bus.on("T", (payload) => hits.push(String(payload)));
    const first = new StubRoom(new BaseGameState());
    bus.bind(first);
    first.push("T", "one");
    const second = new StubRoom(new BaseGameState());
    bus.bind(second);
    first.push("T", "stale");
    second.push("T", "two");
    expect(hits).toEqual(["one", "two"]);
  });

  it("a listener added after bind is attached immediately", () => {
    const bus = new MessageBus();
    const room = new StubRoom(new BaseGameState());
    bus.bind(room);
    const hits: unknown[] = [];
    bus.on("T", (payload) => hits.push(payload));
    room.push("T", "now");
    expect(hits).toEqual(["now"]);
  });

  it("unbind detaches every listener but keeps the registry", () => {
    const bus = new MessageBus();
    const hits: unknown[] = [];
    bus.on("T", (payload) => hits.push(payload));
    const room = new StubRoom(new BaseGameState());
    bus.bind(room);
    bus.unbind();
    room.push("T", "gone");
    expect(hits).toEqual([]);
    bus.bind(room);
    room.push("T", "back");
    expect(hits).toEqual(["back"]);
  });

  it("clear detaches everything and empties the registry", () => {
    const bus = new MessageBus();
    bus.on("T", () => {});
    const room = new StubRoom(new BaseGameState());
    bus.bind(room);
    bus.clear();
    expect(room.messageListeners("T")).toBe(0);
    bus.bind(room);
    expect(room.messageListeners("T")).toBe(0);
  });

  it("bind(undefined) detaches every listener like unbind", () => {
    const bus = new MessageBus();
    const hits: unknown[] = [];
    bus.on("T", (payload) => hits.push(payload));
    const room = new StubRoom(new BaseGameState());
    bus.bind(room);
    bus.bind(undefined);
    room.push("T", "gone");
    expect(hits).toEqual([]);
  });

  it("unsubscribes a listener that was never bound to a room", () => {
    const bus = new MessageBus();
    const off = bus.on("T", () => {});
    off();
    const room = new StubRoom(new BaseGameState());
    bus.bind(room);
    expect(room.messageListeners("T")).toBe(0);
  });
});

describe("GameConnectionManager onMessage through the bus", () => {
  it("delivers a declared event's payload to its typed listener", () => {
    const manager = new GameConnectionManager<BaseGameState, { ping: { n: number } }>({
      endpoint: "ws://localhost:2567",
      roomName: "stub",
      storagePrefix: `bus-typed${++counter}`,
    });
    const got: Array<{ n: number }> = [];
    manager.onMessage("ping", (payload) => got.push(payload));
    const room = new StubRoom(new BaseGameState());
    manager.attach(room);
    room.push("ping", { n: 42 });
    expect(got).toEqual([{ n: 42 }]);
  });

  it("fires a listener registered before attach once the room is attached", () => {
    const manager = newManager();
    let fired = 0;
    manager.onMessage("FIRST", () => ++fired);
    const room = new StubRoom(new BaseGameState());
    manager.attach(room);
    expect(fired).toBe(0);
    room.push("FIRST", {});
    expect(fired).toBe(1);
  });

  it("rejects message names that are not in TEvents at compile time", () => {
    type OnMessageType<TEvents extends Record<string, unknown>> = Parameters<
      GameConnectionManager<BaseGameState, TEvents>["onMessage"]
    >[0];
    const rejectsUndeclared: "NOT_DECLARED" extends OnMessageType<{ ping: { n: number } }>
      ? false
      : true = true;
    expect(rejectsUndeclared).toBe(true);
  });
});
