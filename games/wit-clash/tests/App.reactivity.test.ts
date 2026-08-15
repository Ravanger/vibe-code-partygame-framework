import { GameConnectionManager } from "@partygame/game-client/connection";
import { render, screen } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../ui/App.svelte";
import {
  type FakePlayer,
  type FakeState,
  makeFakeRoom,
  makeFakeState,
  makePlayer,
} from "./helpers/fakes.js";

// Regression test for the "host clicks Host Game but the UI never leaves Welcome" bug.
//
// The real GameConnectionManager is used (no SDK mock: @colyseus/sdk is not resolvable
// from this package, so vi.mock would silently no-op and the real client would dial the
// live server). The manager's constructor is network-safe — the Colyseus Client only
// opens a socket on create/join — so we drive its public fields exactly the way
// create() and the onStateChange handler do:
//   create()          -> connectionStatus = "connected"; room = <room>
//   onStateChange     -> stateVersion += 1
// If those fields are not $state, Svelte never re-renders and these tests fail.

function makeLobbyRoom(players: ReturnType<typeof makePlayer>[]) {
  return makeFakeRoom({
    state: makeFakeState({
      phase: "Lobby",
      roomCode: "PNVW",
      players: new Map(players.map((p) => [p.id, p])),
    }),
    sessionId: "host-id",
  });
}

/**
 * A room state that is a CLASS INSTANCE, mirroring the production Colyseus
 * schema object: Svelte's $state deep-proxies only plain objects/arrays, so a
 * class instance is never wrapped and reading its fields establishes no
 * reactive dependency. The only reactive path to its contents is
 * stateVersion. With a plain-object fake state the proxy would mask the
 * AppViewModel.phase bug and the test below would pass vacuously.
 */
class RawSchemaState {
  phase: string;
  roomCode: string;
  players: Map<string, FakePlayer>;
  categoryOptions: FakeState["categoryOptions"];
  categoryVotes: Map<string, string>;
  phaseEndsAt: number;
  serverNow: number;

  constructor(init: FakeState) {
    this.phase = init.phase;
    this.roomCode = init.roomCode;
    this.players = init.players;
    this.categoryOptions = init.categoryOptions;
    this.categoryVotes = init.categoryVotes;
    this.phaseEndsAt = init.phaseEndsAt;
    this.serverNow = init.serverNow;
  }
}

function connect(manager: GameConnectionManager, room: ReturnType<typeof makeLobbyRoom>) {
  // biome-ignore lint/suspicious/noExplicitAny: assigning a test fake to a typed field
  manager.room = room as any;
  manager.connectionStatus = "connected";
}

describe("App reactivity with the real GameConnectionManager", () => {
  it("moves from Welcome to the Waiting Room when the connection is established", () => {
    const manager = new GameConnectionManager("ws://localhost:2567");
    render(App, { manager });

    // Disconnected -> Welcome screen.
    expect(screen.getByRole("button", { name: /host game/i })).toBeInTheDocument();

    // The host's create() resolves: status flips, room is set.
    connect(manager, makeLobbyRoom([makePlayer({ id: "host-id", name: "Alice", role: "host" })]));
    flushSync();

    // The screen must now be the Waiting Room (host sees the Start Game button).
    // While connectionStatus/room are plain fields the {#if vm.screen} block never
    // re-runs and this fails.
    expect(screen.getByRole("button", { name: /start game/i })).toBeInTheDocument();
  });

  it("updates the connection badge to connected after connecting", () => {
    const manager = new GameConnectionManager("ws://localhost:2567");
    render(App, { manager });

    expect(screen.getByText("disconnected")).toBeInTheDocument();

    connect(manager, makeLobbyRoom([makePlayer({ id: "host-id", name: "Alice", role: "host" })]));
    flushSync();

    expect(screen.getByText("connected")).toBeInTheDocument();
  });

  it("auto-updates the player list when a guest joins (no manual refresh)", () => {
    const manager = new GameConnectionManager("ws://localhost:2567");
    const room = makeLobbyRoom([makePlayer({ id: "host-id", name: "Alice", role: "host" })]);
    connect(manager, room);
    render(App, { manager });

    expect(screen.getByText("Alice")).toBeInTheDocument();

    // Server pushes a new state: Bob joined. The manager's onStateChange handler
    // reacts to exactly this by incrementing stateVersion.
    room.state.players.set("guest-1", makePlayer({ id: "guest-1", name: "Bob", role: "guest" }));
    manager.stateVersion += 1;
    flushSync();

    // The list must reflect the join automatically. stateVersion is the tick that
    // re-derives the player list from room.state; if it is not $state this fails.
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("auto-updates the player list when an existing player renames (in-place mutation)", () => {
    const manager = new GameConnectionManager("ws://localhost:2567");
    const room = makeLobbyRoom([makePlayer({ id: "host-id", name: "Alice", role: "host" })]);
    connect(manager, room);
    render(App, { manager });

    expect(screen.getByText("Alice")).toBeInTheDocument();

    // The server renames an existing player: the schema object is mutated in place
    // (same object identity). The viewmodel must emit a fresh snapshot per tick, or
    // the identity-keyed each block never re-renders the row.
    const host = room.state.players.get("host-id");
    if (!host) throw new Error("host player missing from fake state");
    host.name = "Alicia";
    manager.stateVersion += 1;
    flushSync();

    expect(screen.getByText("Alicia")).toBeInTheDocument();
  });

  it("auto-updates category vote counts when a vote arrives (in-place mutation)", () => {
    const manager = new GameConnectionManager("ws://localhost:2567");
    const room = makeFakeRoom({
      state: makeFakeState({
        phase: "CategorySelection",
        roomCode: "PNVW",
        players: new Map([["host-id", makePlayer({ id: "host-id", name: "Alice", role: "host" })]]),
        categoryOptions: [
          { id: "cat-1", name: "Food", emoji: "F", votes: 0 },
          { id: "cat-2", name: "Sci-Fi", emoji: "S", votes: 2 },
        ],
        categoryVotes: new Map(),
        phaseEndsAt: Date.now() + 60_000,
        serverNow: Date.now(),
      }),
      sessionId: "host-id",
    });
    connect(manager, room);
    render(App, { manager });

    expect(screen.getByText("0 votes")).toBeInTheDocument();

    // The server tallies a vote on an existing option: in-place mutation, same identity.
    // Mutate through manager.room — the reference the viewmodel reads. (In the real app
    // that is the live schema object; in tests it is the $state proxy, whose sources only
    // update via its set trap, so writes to the original fake would be invisible.)
    const proxiedState = manager.room?.state as
      | { categoryOptions: Array<{ votes: number }> }
      | undefined;
    if (!proxiedState) throw new Error("room state missing from manager");
    const firstOption = proxiedState.categoryOptions[0];
    if (!firstOption) throw new Error("first category option missing from fake state");
    firstOption.votes = 1;
    manager.stateVersion += 1;
    flushSync();

    expect(screen.getByText("1 vote")).toBeInTheDocument();
  });

  it("changes screen when the server phase changes (non-proxy state, stateVersion tick)", () => {
    const manager = new GameConnectionManager("ws://localhost:2567");
    const state = new RawSchemaState(
      makeFakeState({
        phase: "Lobby",
        roomCode: "PNVW",
        players: new Map([["host-id", makePlayer({ id: "host-id", name: "Alice", role: "host" })]]),
        categoryOptions: [
          { id: "cat-1", name: "Food", emoji: "F", votes: 0 },
          { id: "cat-2", name: "Sci-Fi", emoji: "S", votes: 0 },
        ],
        phaseEndsAt: Date.now() + 60_000,
        serverNow: Date.now(),
      }),
    );
    const room = makeFakeRoom({
      // biome-ignore lint/suspicious/noExplicitAny: class instance stands in for the Colyseus schema
      state: state as any,
      sessionId: "host-id",
    });
    // biome-ignore lint/suspicious/noExplicitAny: assigning a test fake to a typed field
    manager.room = room as any;
    manager.connectionStatus = "connected";
    render(App, { manager });

    // Lobby -> Waiting Room.
    expect(screen.getByRole("button", { name: /start game/i })).toBeInTheDocument();

    // The server advances the phase: in-place mutation of the schema object
    // (same identity, never proxied) plus the onStateChange tick.
    state.phase = "CategorySelection";
    manager.stateVersion += 1;
    flushSync();

    // The screen router must re-derive from stateVersion. While AppViewModel.phase
    // reads room.state.phase without touching stateVersion, this fails.
    expect(screen.getByRole("heading", { name: "Pick a category" })).toBeInTheDocument();
  });

  it("renders prompts when YOUR_PROMPTS arrives before the Prompting screen mounts", () => {
    const manager = new GameConnectionManager("ws://localhost:2567");
    const room = makeFakeRoom({
      state: makeFakeState({
        phase: "Prompting",
        roomCode: "PNVW",
        players: new Map([["host-id", makePlayer({ id: "host-id", name: "Alice", role: "host" })]]),
        phaseEndsAt: Date.now() + 90_000,
        serverNow: Date.now(),
      }),
      sessionId: "host-id",
    });
    // biome-ignore lint/suspicious/noExplicitAny: assigning a test fake to a typed field
    manager.room = room as any;
    manager.connectionStatus = "connected";
    // Register the manager's always-on room handlers (what create()/join() do).
    // biome-ignore lint/suspicious/noExplicitAny: attachRoomHandlers is private
    (manager as any).attachRoomHandlers();

    // The server sends the one-shot YOUR_PROMPTS the instant the phase starts,
    // which lands BEFORE the phase state patch (messages are sent immediately,
    // schema patches on the next tick). So the Prompting screen is not mounted yet.
    room.__emit?.("YOUR_PROMPTS", [
      { matchupId: "m1", promptText: "Prompt One" },
      { matchupId: "m2", promptText: "Prompt Two" },
    ]);

    // Now the phase patch arrives and the screen mounts.
    manager.stateVersion += 1;
    render(App, { manager });
    flushSync();

    // If prompts are only captured by the screen-scoped viewmodel (registered on
    // mount), the pre-mount message is lost and this fails with "Waiting for prompts...".
    // The screen shows one prompt at a time, so navigate to the second.
    expect(screen.getByText("Prompt One")).toBeInTheDocument();
    screen.getByRole("button", { name: "2" }).click();
    flushSync();
    expect(screen.getByText("Prompt Two")).toBeInTheDocument();
  });
});
