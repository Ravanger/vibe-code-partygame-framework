import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  actionFactory,
  defineGame,
  type GameContext,
  type GameDefinition,
  GameRuntime,
  type PhaseState,
} from "../../src/index.js";
import { FakeHost } from "../../src/testing/FakeHost.js";

interface S extends PhaseState {
  log: string[];
}
interface P {
  secret: number;
}
interface O {
  rounds: number;
}

const action = actionFactory<S, P, O>();

const newState = (): S => ({ phase: "", phaseEndsAt: 0, canStart: false, log: [] });

type Spec = GameDefinition<S, P, O>;
type Overrides = Partial<Omit<Spec, "options" | "onReturnToLobby" | "onPlayerSync">> & {
  options?: Spec["options"] | undefined;
  onReturnToLobby?: Spec["onReturnToLobby"] | undefined;
  onPlayerSync?: Spec["onPlayerSync"] | undefined;
};

function makeSpec(overrides: Overrides = {}): GameDefinition<S, P, O> {
  return defineGame<S, P, O>({
    name: "Test",
    minPlayers: 2,
    maxPlayers: 4,
    startPhase: "Play",
    options: z.object({ rounds: z.number().default(3) }),
    createPrivateState: () => ({ secret: 7 }),
    phases: {
      Play: {
        duration: 1000,
        onEnter: (ctx) => ctx.state.log.push("enter:Play"),
        onTimeout: (ctx) => {
          ctx.state.log.push("timeout:Play");
          ctx.transition("Score");
        },
        onRosterChange: (ctx) => ctx.state.log.push("roster:Play"),
        actions: {
          GUESS: action({
            from: "player",
            payload: z.object({ n: z.number() }),
            handler: (ctx) => {
              ctx.state.log.push(`guess:${ctx.playerId}:${ctx.payload.n}`);
              ctx.transition("Score");
              ctx.state.log.push(`after-transition:${ctx.phase}`);
            },
          }),
          BOSS: action({
            from: "host",
            payload: z.object({}),
            handler: (ctx) => ctx.state.log.push("boss"),
          }),
          NOPE: action({
            from: "player",
            payload: z.object({}),
            handler: (ctx) => ctx.reject("NOT_ALLOWED", "no thanks"),
          }),
          TWICE: action({
            from: "player",
            payload: z.object({}),
            handler: (ctx) => {
              ctx.reject("NOT_ALLOWED", "first");
              ctx.reject("INVALID_ACTION", "second");
            },
          }),
          AGAIN: action({
            from: "player",
            payload: z.object({}),
            handler: (ctx) => ctx.transition("Play"),
          }),
          HOME: action({
            from: "host",
            payload: z.object({}),
            handler: (ctx) => ctx.returnToLobby(),
          }),
          BOOM: action({
            from: "player",
            payload: z.object({}),
            handler: (ctx) => {
              ctx.transition("Score");
              throw new Error("boom");
            },
          }),
          BAD_TARGET: action({
            from: "player",
            payload: z.object({}),
            handler: (ctx) => ctx.transition("Missing"),
          }),
          TOOLS: action({
            from: "player",
            payload: z.object({}),
            handler: (ctx) => {
              ctx.state.log.push(
                `tools:${ctx.players().length}:${ctx.activePlayers().length}:${ctx.player("p2")?.name}:${ctx.player("zz")}:${ctx.rng()}:${ctx.now()}:${ctx.options.rounds}:${ctx.priv.secret}`,
              );
              ctx.send("p2", "HELLO", 1);
              ctx.broadcast("ALL", 2);
              ctx.activateWaitingPlayers();
            },
          }),
        },
      },
      Score: {
        duration: (ctx) => 500 * (ctx.state.log.length + 1),
        onTimeout: (ctx) => ctx.state.log.push("timeout:Score"),
        onRosterChange: (ctx) => ctx.state.log.push("roster:Score"),
      },
      Skip: { onEnter: (ctx) => ctx.transition("Score") },
      Chain: { onEnter: (ctx) => ctx.transition("Skip") },
      Loop: { onEnter: (ctx) => ctx.transition("Loop") },
      Bare: {},
    },
    onPlayerSync: (ctx, id) => ctx.state.log.push(`sync:${id}`),
    onReturnToLobby: (ctx) => ctx.state.log.push(`lobby:${ctx.phase}`),
    ...(overrides as Partial<Spec>),
  });
}

function setup2(overrides: Overrides = {}, ready = true) {
  const host = new FakeHost();
  host.seat("p1");
  const p2 = host.seat("p2", { isReady: ready });
  const state = newState();
  const runtime = new GameRuntime({
    definition: makeSpec(overrides),
    state,
    host,
    options: { rounds: 3 },
  });
  return { host, state, runtime, p2 };
}

function inPlay() {
  const ctx = setup2();
  ctx.runtime.dispatch("p1", { type: "START_GAME" });
  ctx.state.log.length = 0;
  return ctx;
}

describe("construction", () => {
  it("starts in Lobby with no timer and parses options", () => {
    const { runtime, state, host } = setup2();
    expect(runtime.phase).toBe("Lobby");
    expect(state.phase).toBe("Lobby");
    expect(state.phaseEndsAt).toBe(0);
    expect(host.pendingTimers).toBe(0);
    expect(runtime.priv.secret).toBe(7);
  });

  it("hands the given options to the hooks unchanged", () => {
    const seen: unknown[] = [];
    const spec = makeSpec({
      options: undefined,
      minPlayers: 1,
      phases: { Play: { onEnter: (ctx) => seen.push(ctx.options) } },
    });
    const host = new FakeHost();
    host.seat("p1");
    const runtime = new GameRuntime({
      definition: spec,
      state: newState(),
      host,
      options: { rounds: 9 },
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(seen).toEqual([{ rounds: 9 }]);
  });
});

describe("ctx.newId", () => {
  const idSpec = makeSpec({
    minPlayers: 1,
    phases: { Play: { onEnter: (ctx) => ctx.state.log.push(ctx.newId()) } },
  });

  const idsFor = (seed: number): string[] => {
    const host = new FakeHost(seed);
    host.seat("p1");
    const state = newState();
    const runtime = new GameRuntime({
      definition: idSpec,
      state,
      host,
      options: { rounds: 3 },
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    return [...state.log];
  };

  it("is deterministic for the room seed", () => {
    expect(idsFor(9)).toEqual(idsFor(9));
    expect(idsFor(9)).not.toEqual(idsFor(10));
  });
});

describe("Lobby", () => {
  it("START_GAME is host only", () => {
    const { runtime, host } = setup2();
    runtime.dispatch("p2", { type: "START_GAME" });
    expect(host.errorsTo("p2")).toEqual([
      { code: "UNAUTHORIZED", message: expect.any(String), action: "START_GAME" },
    ]);
    expect(runtime.phase).toBe("Lobby");
  });

  it("START_GAME needs minPlayers active players", () => {
    const { runtime, host } = setup2({ minPlayers: 3 });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(host.errorsTo("p1")).toEqual([
      { code: "NOT_ENOUGH_PLAYERS", message: expect.any(String), action: "START_GAME" },
    ]);
    expect(runtime.phase).toBe("Lobby");
  });

  it("START_GAME enters the start phase", () => {
    const { runtime, state } = setup2();
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(runtime.phase).toBe("Play");
    expect(state.phase).toBe("Play");
    expect(state.log).toEqual(["enter:Play"]);
  });

  it("START_GAME is WRONG_PHASE outside the Lobby", () => {
    const { runtime, host } = inPlay();
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(host.errorsTo("p1")[0]).toMatchObject({ code: "WRONG_PHASE" });
  });

  it("does not auto-start by default", () => {
    const { runtime } = setup2();
    runtime.rosterChanged();
    expect(runtime.phase).toBe("Lobby");
  });

  it("auto-starts when autoStart is set, every seat is ready and the minimum is met", () => {
    const { runtime, p2 } = setup2({ autoStart: true }, false);
    runtime.rosterChanged();
    expect(runtime.phase).toBe("Lobby");
    p2.isReady = true;
    runtime.rosterChanged();
    expect(runtime.phase).toBe("Play");
  });

  it("does not auto-start below the minimum", () => {
    const { runtime } = setup2({ minPlayers: 3, autoStart: true });
    runtime.rosterChanged();
    expect(runtime.phase).toBe("Lobby");
  });

  it("does not auto-start when ready players are disconnected", () => {
    const { runtime, p2 } = setup2({ autoStart: true });
    p2.isConnected = false;
    runtime.rosterChanged();
    expect(runtime.phase).toBe("Lobby");
  });

  it("does not auto-start on re-entering the Lobby", () => {
    const { runtime } = inPlay();
    runtime.dispatch("p1", { type: "HOME" });
    expect(runtime.phase).toBe("Lobby");
  });
});

describe("canStart", () => {
  it("follows the START_GAME rule in the Lobby and is false elsewhere", () => {
    const { runtime, host, state, p2 } = setup2({ minPlayers: 2 });
    expect(state.canStart).toBe(true);
    p2.isConnected = false;
    runtime.rosterChanged();
    expect(state.canStart).toBe(false);
    p2.isConnected = true;
    runtime.rosterChanged();
    expect(state.canStart).toBe(true);
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(state.canStart).toBe(false);
    runtime.dispatch("p1", { type: "HOME" });
    expect(state.canStart).toBe(true);
    host.seats.length = 0;
    runtime.rosterChanged();
    expect(state.canStart).toBe(false);
  });

  it("is false from the start when the Lobby lacks players", () => {
    const { state } = setup2({ minPlayers: 3 });
    expect(state.canStart).toBe(false);
  });
});

describe("Lobby after a game", () => {
  it("activates waiting joiners when the game returns to the Lobby", () => {
    const { runtime, host } = inPlay();
    const late = host.seat("p3", { isActive: false });
    runtime.dispatch("p1", { type: "HOME" });
    expect(late.isActive).toBe(true);
  });

  it("benches unnamed seats when START_GAME leaves the Lobby", () => {
    const { runtime, host } = setup2();
    const unnamed = host.seat("p3", { isReady: false });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(runtime.phase).toBe("Play");
    expect(unnamed.isActive).toBe(false);
  });

  it("leaves unnamed waiting joiners inactive until they are ready", () => {
    const { runtime, host } = inPlay();
    const unnamed = host.seat("p3", { isActive: false, isReady: false });
    runtime.dispatch("p1", { type: "HOME" });
    expect(unnamed.isActive).toBe(false);
    unnamed.isReady = true;
    host.activateWaitingPlayers();
    expect(unnamed.isActive).toBe(true);
  });

  it("does not auto-start again after returnToLobby, but START_GAME still works", () => {
    const { runtime } = inPlay();
    runtime.dispatch("p1", { type: "HOME" });
    runtime.rosterChanged();
    expect(runtime.phase).toBe("Lobby");
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(runtime.phase).toBe("Play");
  });
});

describe("dispatch rejections", () => {
  it.each([null, "x", 5, {}, { type: "lower" }, { type: 5 }])(
    "envelope %j is INVALID_ACTION",
    (raw) => {
      const { runtime, host } = inPlay();
      runtime.dispatch("p1", raw);
      expect(host.errorsTo("p1")).toEqual([
        { code: "INVALID_ACTION", message: expect.any(String) },
      ]);
    },
  );

  it("unknown action", () => {
    const { runtime, host } = inPlay();
    runtime.dispatch("p1", { type: "NO_SUCH" });
    expect(host.errorsTo("p1")).toEqual([
      { code: "UNKNOWN_ACTION", message: expect.any(String), action: "NO_SUCH" },
    ]);
  });

  it("action from another phase", () => {
    const { runtime, host } = inPlay();
    runtime.dispatch("p1", { type: "GUESS", n: 1 });
    runtime.dispatch("p1", { type: "GUESS", n: 1 });
    expect(host.errorsTo("p1")).toEqual([
      { code: "WRONG_PHASE", message: expect.any(String), action: "GUESS" },
    ]);
  });

  it("host action from a guest, and from an unseated sender", () => {
    const { runtime, host } = inPlay();
    runtime.dispatch("p2", { type: "BOSS" });
    runtime.dispatch("ghost", { type: "GUESS", n: 1 });
    expect(host.errorsTo("p2")[0]).toMatchObject({ code: "UNAUTHORIZED", action: "BOSS" });
    expect(host.errorsTo("ghost")[0]).toMatchObject({ code: "UNAUTHORIZED", action: "GUESS" });
  });

  it("inactive sender", () => {
    const { runtime, host, p2 } = inPlay();
    p2.isActive = false;
    runtime.dispatch("p2", { type: "GUESS", n: 1 });
    expect(host.errorsTo("p2")[0]).toMatchObject({ code: "NOT_ACTIVE", action: "GUESS" });
  });

  it("payload failing its schema", () => {
    const { runtime, host, state } = inPlay();
    runtime.dispatch("p2", { type: "GUESS", n: "one" });
    expect(host.errorsTo("p2")[0]).toMatchObject({ code: "INVALID_ACTION", action: "GUESS" });
    expect(state.log).toEqual([]);
  });

  it("handler reject reaches the actor", () => {
    const { runtime, host } = inPlay();
    runtime.dispatch("p2", { type: "NOPE" });
    expect(host.errorsTo("p2")).toEqual([
      { code: "NOT_ALLOWED", message: "no thanks", action: "NOPE" },
    ]);
  });
});

describe("dispatch result", () => {
  it("is undefined when the action is accepted", () => {
    const { runtime } = inPlay();
    expect(runtime.dispatch("p1", { type: "BOSS" })).toBeUndefined();
  });

  it("fails with NOT_ALLOWED once the runtime has stopped", () => {
    const { runtime } = inPlay();
    runtime.stop();
    expect(runtime.dispatch("p1", { type: "BOSS" })).toMatchObject({ code: "NOT_ALLOWED" });
  });

  it.each([
    ["malformed envelope", "p1", "x", { code: "INVALID_ACTION" }],
    ["unknown action", "p1", { type: "NO_SUCH" }, { code: "UNKNOWN_ACTION", action: "NO_SUCH" }],
    ["unseated sender", "ghost", { type: "BOSS" }, { code: "UNAUTHORIZED", action: "BOSS" }],
    ["bad payload", "p1", { type: "GUESS", n: "x" }, { code: "INVALID_ACTION", action: "GUESS" }],
    ["handler reject", "p1", { type: "NOPE" }, { code: "NOT_ALLOWED", action: "NOPE" }],
  ])("returns the rejection for %s and still sends it", (_label, sender, raw, expected) => {
    const { runtime, host } = inPlay();
    const result = runtime.dispatch(sender, raw);
    expect(result).toMatchObject(expected);
    expect(host.errorsTo(sender)).toEqual([result]);
  });

  it("returns WRONG_PHASE for an action declared by another phase", () => {
    const { runtime } = inPlay();
    runtime.dispatch("p1", { type: "GUESS", n: 1 });
    expect(runtime.dispatch("p1", { type: "GUESS", n: 1 })).toMatchObject({ code: "WRONG_PHASE" });
  });

  it("returns only the first rejection of a handler", () => {
    const { runtime, host } = inPlay();
    expect(runtime.dispatch("p1", { type: "TWICE" })).toMatchObject({ message: "first" });
    expect(host.errorsTo("p1")).toHaveLength(2);
  });

  it("does not carry a rejection over to the next dispatch", () => {
    const { runtime } = inPlay();
    runtime.dispatch("p1", { type: "NOPE" });
    expect(runtime.dispatch("p1", { type: "BOSS" })).toBeUndefined();
  });
});

describe("handlers and transitions", () => {
  it("applies handler transitions after the handler returns", () => {
    const { runtime, state } = inPlay();
    runtime.dispatch("p2", { type: "GUESS", n: 4 });
    expect(state.log.slice(0, 2)).toEqual(["guess:p2:4", "after-transition:Play"]);
    expect(runtime.phase).toBe("Score");
    expect(state.phase).toBe("Score");
  });

  it("host can send host actions", () => {
    const { runtime, state } = inPlay();
    runtime.dispatch("p1", { type: "BOSS" });
    expect(state.log).toEqual(["boss"]);
  });

  it("exposes the context helpers", () => {
    const { runtime, host, state, p2 } = inPlay();
    p2.isActive = false;
    runtime.dispatch("p1", { type: "TOOLS" });
    expect(state.log).toEqual([`tools:2:1:p2:undefined:0.5:${host.now()}:3:7`]);
    expect(host.sent).toContainEqual({ playerId: "p2", type: "HELLO", payload: 1 });
    expect(host.broadcasts).toEqual([{ type: "ALL", payload: 2 }]);
    expect(host.activations).toBe(1);
  });

  it("rejects transitions to undeclared phases at the call site", () => {
    const { runtime } = inPlay();
    expect(() => runtime.dispatch("p2", { type: "BAD_TARGET" })).toThrow('Unknown phase "Missing"');
  });

  it("drops queued transitions when a handler throws", () => {
    const { runtime } = inPlay();
    expect(() => runtime.dispatch("p2", { type: "BOOM" })).toThrow("boom");
    expect(runtime.phase).toBe("Play");
  });

  it("surfaces an onEnter failure to the caller and keeps working", () => {
    let explode = true;
    const { runtime } = setup2({
      phases: {
        Play: {
          onEnter: () => {
            if (explode) throw new Error("enter boom");
          },
          actions: {
            GO_ON: action({
              from: "player",
              payload: z.object({}),
              handler: (ctx) => ctx.transition("Score"),
            }),
          },
        },
        Score: {},
      },
    });
    expect(() => runtime.dispatch("p1", { type: "START_GAME" })).toThrow("enter boom");
    explode = false;
    runtime.dispatch("p1", { type: "GO_ON" });
    expect(runtime.phase).toBe("Score");
  });

  it("surfaces an onTimeout failure to the timer's caller and keeps working", () => {
    let explode = true;
    const { runtime, host } = setup2({
      phases: {
        Play: {
          duration: 100,
          onTimeout: () => {
            if (explode) throw new Error("timeout boom");
          },
          actions: {
            GO_ON: action({
              from: "player",
              payload: z.object({}),
              handler: (ctx) => ctx.transition("Score"),
            }),
          },
        },
        Score: {},
      },
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(() => host.advance(100)).toThrow("timeout boom");
    explode = false;
    runtime.dispatch("p1", { type: "GO_ON" });
    expect(runtime.phase).toBe("Score");
  });

  it("follows a chain Chain -> Skip -> Score", () => {
    const { runtime, host } = setup2({ startPhase: "Chain" });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(runtime.phase).toBe("Score");
    expect(host.pendingTimers).toBe(1);
  });

  it("stops a transition loop", () => {
    const { runtime } = setup2({ startPhase: "Loop" });
    expect(() => runtime.dispatch("p1", { type: "START_GAME" })).toThrow("chained transitions");
  });

  it("returnToLobby runs onReturnToLobby first", () => {
    const { runtime, state } = inPlay();
    runtime.dispatch("p1", { type: "HOME" });
    expect(state.log).toEqual(["lobby:Play"]);
    expect(runtime.phase).toBe("Lobby");
    expect(state.phaseEndsAt).toBe(0);
  });

  it("returnToLobby without onReturnToLobby just enters the Lobby", () => {
    const { runtime } = setup2({ onReturnToLobby: undefined });
    runtime.dispatch("p1", { type: "START_GAME" });
    runtime.dispatch("p1", { type: "HOME" });
    expect(runtime.phase).toBe("Lobby");
  });
});

describe("timers", () => {
  it("sets phaseEndsAt from a numeric duration and fires onTimeout once", () => {
    const { runtime, host, state } = setup2();
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(state.phaseEndsAt).toBe(host.now() + 1000);
    host.advance(999);
    expect(state.log).toEqual(["enter:Play"]);
    host.advance(1);
    expect(state.log).toEqual(["enter:Play", "timeout:Play"]);
    expect(runtime.phase).toBe("Score");
  });

  it("supports a duration function evaluated once per entry", () => {
    const { runtime, host, state } = inPlay();
    runtime.dispatch("p2", { type: "GUESS", n: 1 });
    const expected = 500 * (state.log.length + 1);
    expect(state.phaseEndsAt).toBe(host.now() + expected);
    host.advance(expected - 1);
    expect(state.log).not.toContain("timeout:Score");
    host.advance(1);
    expect(state.log.filter((l) => l === "timeout:Score")).toHaveLength(1);
    host.advance(100000);
    expect(state.log.filter((l) => l === "timeout:Score")).toHaveLength(1);
  });

  it("does not fire onTimeout after leaving the phase", () => {
    const { runtime, host, state } = inPlay();
    runtime.dispatch("p2", { type: "GUESS", n: 1 });
    host.advance(400);
    expect(state.log).not.toContain("timeout:Play");
    expect(host.pendingTimers).toBe(1);
  });

  it("re-entering the same phase restarts the timer", () => {
    const { runtime, host, state } = inPlay();
    host.advance(600);
    runtime.dispatch("p2", { type: "AGAIN" });
    expect(state.log).toEqual(["enter:Play"]);
    expect(state.phaseEndsAt).toBe(host.now() + 1000);
    host.advance(600);
    expect(state.log).toEqual(["enter:Play"]);
    host.advance(400);
    expect(state.log).toContain("timeout:Play");
  });

  it("phases without a duration have no timer", () => {
    const { runtime, host, state } = setup2({ startPhase: "Bare" });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(state.phaseEndsAt).toBe(0);
    expect(host.pendingTimers).toBe(0);
  });

  it("tolerates a spec without onTimeout (not built through defineGame)", () => {
    const spec = makeSpec();
    spec.phases.Broken = { duration: 10 };
    spec.startPhase = "Broken";
    const host = new FakeHost();
    host.seat("p1");
    host.seat("p2");
    const runtime = new GameRuntime({
      definition: spec,
      state: newState(),
      host,
      options: { rounds: 3 },
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(() => host.advance(10)).not.toThrow();
  });

  it("stop clears timers and ignores later calls", () => {
    const { runtime, host, state } = inPlay();
    expect(host.pendingTimers).toBe(1);
    runtime.stop();
    expect(host.pendingTimers).toBe(0);
    host.advance(10000);
    runtime.dispatch("p1", { type: "BOSS" });
    runtime.rosterChanged();
    runtime.syncPlayer("p1");
    expect(state.log).toEqual([]);
  });
});

describe("roster and sync", () => {
  it("routes rosterChanged to the current phase", () => {
    const { runtime, state } = inPlay();
    runtime.rosterChanged();
    expect(state.log).toEqual(["roster:Play"]);
    runtime.dispatch("p2", { type: "GUESS", n: 1 });
    state.log.length = 0;
    runtime.rosterChanged();
    expect(state.log).toEqual(["roster:Score"]);
  });

  it("ignores rosterChanged in a phase without a hook", () => {
    const { runtime, state } = setup2({ startPhase: "Bare" });
    runtime.dispatch("p1", { type: "START_GAME" });
    runtime.rosterChanged();
    expect(state.log).toEqual([]);
  });

  it("syncPlayer calls onPlayerSync", () => {
    const { runtime, state } = inPlay();
    runtime.syncPlayer("p2");
    expect(state.log).toEqual(["sync:p2"]);
  });

  it("syncPlayer is a no-op without onPlayerSync", () => {
    const { runtime } = setup2({ onPlayerSync: undefined });
    expect(() => runtime.syncPlayer("p2")).not.toThrow();
  });
});

describe("view forwarding", () => {
  it("showTo and hideFrom go to the host", () => {
    const { runtime, host } = inPlay();
    const ref = {};
    const base = makeSpec();
    const spec = {
      ...base,
      phases: {
        ...base.phases,
        Play: {
          ...base.phases.Play,
          onEnter: (ctx: GameContext<S, P, O>) => {
            ctx.showTo("p2", ref);
            ctx.hideFrom("p1", ref);
          },
        },
      },
    };
    const other = new GameRuntime({
      definition: spec,
      state: newState(),
      host,
      options: { rounds: 3 },
    });
    other.dispatch("p1", { type: "START_GAME" });
    expect(host.views).toEqual([
      { op: "show", playerId: "p2", ref },
      { op: "hide", playerId: "p1", ref },
    ]);
    runtime.stop();
    other.stop();
  });
});

describe("KICK_PLAYER", () => {
  it("is host only", () => {
    const { runtime, host } = inPlay();
    runtime.dispatch("p2", { type: "KICK_PLAYER", playerId: "p1" });
    expect(host.errorsTo("p2")[0]).toMatchObject({ code: "UNAUTHORIZED", action: "KICK_PLAYER" });
    expect(host.kicked).toEqual([]);
  });

  it("kicks in any phase and then notifies the roster change", () => {
    const { runtime, host, state } = inPlay();
    runtime.dispatch("p1", { type: "KICK_PLAYER", playerId: "p2" });
    expect(host.kicked).toEqual(["p2"]);
    expect(state.log).toEqual(["roster:Play"]);
    runtime.dispatch("p1", { type: "HOME" });
    host.seat("p3");
    runtime.dispatch("p1", { type: "KICK_PLAYER", playerId: "p3" });
    expect(host.kicked).toEqual(["p2", "p3"]);
  });

  it("kicking in a phase without a roster hook is fine", () => {
    const { runtime, host } = setup2({ startPhase: "Bare" });
    runtime.dispatch("p1", { type: "START_GAME" });
    runtime.dispatch("p1", { type: "KICK_PLAYER", playerId: "p2" });
    expect(host.kicked).toEqual(["p2"]);
  });

  it("refuses to kick yourself or a stranger", () => {
    const { runtime, host } = inPlay();
    runtime.dispatch("p1", { type: "KICK_PLAYER", playerId: "p1" });
    runtime.dispatch("p1", { type: "KICK_PLAYER", playerId: "ghost" });
    expect(host.errorsTo("p1")).toEqual([
      { code: "NOT_ALLOWED", message: expect.any(String), action: "KICK_PLAYER" },
      { code: "NOT_ALLOWED", message: expect.any(String), action: "KICK_PLAYER" },
    ]);
    expect(host.kicked).toEqual([]);
  });

  it("needs a playerId", () => {
    const { runtime, host } = inPlay();
    runtime.dispatch("p1", { type: "KICK_PLAYER" });
    expect(host.errorsTo("p1")[0]).toMatchObject({ code: "INVALID_ACTION" });
  });
});

describe("END_GAME", () => {
  const withHook = () =>
    setup2({ onEndGame: (ctx) => ctx.state.log.push(`onEndGame:${ctx.phase}`) });
  const startedWithHook = () => {
    const ctx = withHook();
    ctx.runtime.dispatch("p1", { type: "START_GAME" });
    ctx.state.log.length = 0;
    return ctx;
  };

  it("runs onEndGame before onReturnToLobby and lands in the Lobby", () => {
    const { runtime, host, state } = startedWithHook();
    const activations = host.activations;
    expect(runtime.dispatch("p1", { type: "END_GAME" })).toBeUndefined();
    expect(runtime.phase).toBe("Lobby");
    expect(state.log).toEqual(["onEndGame:Play", "lobby:Play"]);
    expect(host.activations).toBe(activations + 1);
    host.advance(10_000);
    expect(state.log).toEqual(["onEndGame:Play", "lobby:Play"]);
  });

  it("is host only", () => {
    const { runtime, host, state } = startedWithHook();
    runtime.dispatch("p2", { type: "END_GAME" });
    expect(host.errorsTo("p2")[0]).toMatchObject({ code: "UNAUTHORIZED", action: "END_GAME" });
    expect(runtime.phase).toBe("Play");
    expect(state.log).toEqual([]);
  });

  it("is refused in the Lobby", () => {
    const { runtime, state } = withHook();
    expect(runtime.dispatch("p1", { type: "END_GAME" })).toEqual({
      code: "WRONG_PHASE",
      message: "END_GAME is not allowed in Lobby",
      action: "END_GAME",
    });
    expect(state.log).toEqual([]);
  });

  it("returns to the Lobby without an onEndGame hook", () => {
    const { runtime } = inPlay();
    runtime.dispatch("p1", { type: "END_GAME" });
    expect(runtime.phase).toBe("Lobby");
  });

  it("lets the host start again", () => {
    const { runtime } = inPlay();
    runtime.dispatch("p1", { type: "END_GAME" });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(runtime.phase).toBe("Play");
  });
});

describe("SET_OPTIONS", () => {
  it("merges, validates, publishes and updates ctx.options in the Lobby", () => {
    const { runtime, host, state } = setup2();
    runtime.dispatch("p1", { type: "SET_OPTIONS", rounds: 5 });
    expect(host.published).toEqual([{ rounds: 5 }]);
    runtime.dispatch("p1", { type: "START_GAME" });
    runtime.dispatch("p1", { type: "TOOLS" });
    expect(state.log.at(-1)).toContain(":5:7");
  });

  it("is host only and Lobby only", () => {
    const { runtime, host } = setup2();
    runtime.dispatch("p2", { type: "SET_OPTIONS", rounds: 5 });
    expect(host.errorsTo("p2")[0]).toMatchObject({ code: "UNAUTHORIZED" });
    runtime.dispatch("p1", { type: "START_GAME" });
    runtime.dispatch("p1", { type: "SET_OPTIONS", rounds: 5 });
    expect(host.errorsTo("p1")[0]).toMatchObject({ code: "WRONG_PHASE", action: "SET_OPTIONS" });
    expect(host.published).toEqual([]);
  });

  it("rejects options failing the schema and keeps the old value", () => {
    const { runtime, host } = setup2();
    runtime.dispatch("p1", { type: "SET_OPTIONS", rounds: "many" });
    expect(host.errorsTo("p1")[0]).toMatchObject({ code: "INVALID_ACTION", action: "SET_OPTIONS" });
    expect(host.published).toEqual([]);
  });

  it("merges unvalidated when the game declares no options schema", () => {
    const { runtime, host } = setup2({ options: undefined });
    runtime.dispatch("p1", { type: "SET_OPTIONS", a: 1 });
    runtime.dispatch("p1", { type: "SET_OPTIONS", b: 2 });
    expect(host.published).toEqual([
      { rounds: 3, a: 1 },
      { rounds: 3, a: 1, b: 2 },
    ]);
  });
});
