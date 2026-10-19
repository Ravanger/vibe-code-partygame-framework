import {
  CLIENT_MESSAGES,
  ErrorCode,
  FrameworkError,
  MAX_OPTIONS_JSON_LENGTH,
} from "@partygame/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  actionFactory,
  defineGame,
  type GameContext,
  type GameDefinition,
  GameRuntime,
  InvalidPrivateStateError,
  type PhaseState,
  seedFromNumber,
  sfc32,
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
    version: "1",
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
          TYPED: action({
            from: "player",
            payload: z.object({}),
            handler: () => {
              throw new FrameworkError(ErrorCode.NOT_ALLOWED, "internal detail");
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

/** A host that can be made to throw from activateWaitingPlayers, for failure-policy guard tests. */
class FaultyActivateHost extends FakeHost {
  failActivation = false;
  activateWaitingPlayers(): void {
    if (this.failActivation) throw new Error("activate boom");
    super.activateWaitingPlayers();
  }
}

function setup2(overrides: Overrides = {}, ready = true, host: FakeHost = new FakeHost()) {
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

/** A createPrivateState that lies about its return type, for the non-object guard tests. */
const lie =
  (bad: unknown): (() => unknown) =>
  () =>
    bad;

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

  it("throws InvalidPrivateStateError when createPrivateState returns a primitive or null", () => {
    for (const bad of [42, "nope", null]) {
      const spec = makeSpec({
        createPrivateState: lie(bad) as Spec["createPrivateState"],
      });
      const host = new FakeHost();
      host.seat("p1");
      expect(
        () =>
          new GameRuntime({
            definition: spec,
            state: newState(),
            host,
            options: { rounds: 3 },
          }),
      ).toThrow(InvalidPrivateStateError);
    }
  });

  it("names the private-state error with a fixed message", () => {
    const spec = makeSpec({
      createPrivateState: lie(null) as Spec["createPrivateState"],
    });
    const host = new FakeHost();
    host.seat("p1");
    let thrown: unknown;
    try {
      new GameRuntime({ definition: spec, state: newState(), host, options: { rounds: 3 } });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(InvalidPrivateStateError);
    expect((thrown as Error).name).toBe("InvalidPrivateStateError");
    expect((thrown as Error).message).toBe("createPrivateState() must return an object");
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
      { code: "UNAUTHORIZED", message: CLIENT_MESSAGES.UNAUTHORIZED },
    ]);
    expect(runtime.phase).toBe("Lobby");
  });

  it("START_GAME needs minPlayers active players", () => {
    const { runtime, host } = setup2({ minPlayers: 3 });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(host.errorsTo("p1")).toEqual([
      { code: "NOT_ENOUGH_PLAYERS", message: CLIENT_MESSAGES.NOT_ENOUGH_PLAYERS },
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

  it("notifies the host of every applied phase transition", () => {
    const { runtime, host } = setup2();
    expect(host.transitions).toEqual([]);
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(host.transitions).toEqual([{ from: "Lobby", to: "Play" }]);
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
        { code: "INVALID_ACTION", message: CLIENT_MESSAGES.INVALID_ACTION },
      ]);
    },
  );

  it("framework rejections omit the action field", () => {
    const { runtime, host } = inPlay();
    runtime.dispatch("p1", { type: "NO_SUCH" });
    runtime.dispatch("p1", { type: "GUESS", n: 1 });
    runtime.dispatch("p1", { type: "GUESS", n: 1 });
    const errors = host.errorsTo("p1");
    expect(errors).toMatchObject([{ code: "UNKNOWN_ACTION" }, { code: "WRONG_PHASE" }]);
    for (const error of errors) expect(error).not.toHaveProperty("action");
  });

  it("unknown action", () => {
    const { runtime, host } = inPlay();
    runtime.dispatch("p1", { type: "NO_SUCH" });
    expect(host.errorsTo("p1")).toEqual([
      { code: "UNKNOWN_ACTION", message: CLIENT_MESSAGES.UNKNOWN_ACTION },
    ]);
  });

  it("action from another phase", () => {
    const { runtime, host } = inPlay();
    runtime.dispatch("p1", { type: "GUESS", n: 1 });
    runtime.dispatch("p1", { type: "GUESS", n: 1 });
    expect(host.errorsTo("p1")).toEqual([
      { code: "WRONG_PHASE", message: CLIENT_MESSAGES.WRONG_PHASE },
    ]);
  });

  it("host action from a guest, and from an unseated sender", () => {
    const { runtime, host } = inPlay();
    runtime.dispatch("p2", { type: "BOSS" });
    runtime.dispatch("ghost", { type: "GUESS", n: 1 });
    expect(host.errorsTo("p2")[0]).toMatchObject({ code: "UNAUTHORIZED" });
    expect(host.errorsTo("ghost")[0]).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("inactive sender", () => {
    const { runtime, host, p2 } = inPlay();
    p2.isActive = false;
    runtime.dispatch("p2", { type: "GUESS", n: 1 });
    expect(host.errorsTo("p2")[0]).toMatchObject({
      code: "NOT_ACTIVE",
      message: CLIENT_MESSAGES.NOT_ACTIVE,
    });
  });

  it("payload failing its schema answers the fixed INVALID_ACTION message", () => {
    const { runtime, state } = inPlay();
    expect(runtime.dispatch("p2", { type: "GUESS", n: "one" })).toEqual({
      code: ErrorCode.INVALID_ACTION,
      message: CLIENT_MESSAGES.INVALID_ACTION,
      action: "GUESS",
    });
    expect(state.log).toEqual([]);
  });

  it("built-in actions with a bad payload answer the fixed INVALID_ACTION message", () => {
    const { runtime } = setup2();
    expect(runtime.dispatch("p1", { type: "KICK_PLAYER", playerId: 42 })).toEqual({
      code: ErrorCode.INVALID_ACTION,
      message: CLIENT_MESSAGES.INVALID_ACTION,
      action: "KICK_PLAYER",
    });
    expect(runtime.dispatch("p1", { type: "SET_OPTIONS", rounds: "x" })).toEqual({
      code: ErrorCode.INVALID_ACTION,
      message: CLIENT_MESSAGES.INVALID_ACTION,
      action: "SET_OPTIONS",
    });
  });

  it("maps a handler-thrown FrameworkError to its fixed client message without failing the run", () => {
    const { runtime, host, state } = inPlay();
    const result = runtime.dispatch("p2", { type: "TYPED" });
    expect(result).toEqual({ code: ErrorCode.NOT_ALLOWED, message: CLIENT_MESSAGES.NOT_ALLOWED });
    expect(host.errorsTo("p2")).toEqual([result]);
    expect(runtime.phase).toBe("Play");
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
    [
      "malformed envelope",
      "p1",
      "x",
      { code: "INVALID_ACTION", message: CLIENT_MESSAGES.INVALID_ACTION },
    ],
    [
      "unknown action",
      "p1",
      { type: "NO_SUCH" },
      { code: "UNKNOWN_ACTION", message: CLIENT_MESSAGES.UNKNOWN_ACTION },
    ],
    [
      "unseated sender",
      "ghost",
      { type: "BOSS" },
      { code: "UNAUTHORIZED", message: CLIENT_MESSAGES.UNAUTHORIZED },
    ],
    [
      "bad payload",
      "p1",
      { type: "GUESS", n: "x" },
      { code: "INVALID_ACTION", message: CLIENT_MESSAGES.INVALID_ACTION, action: "GUESS" },
    ],
    [
      "handler reject",
      "p1",
      { type: "NOPE" },
      { code: "NOT_ALLOWED", message: "no thanks", action: "NOPE" },
    ],
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
    // Unseeded host is seedFromNumber(0), and this is the table's first rng draw.
    const rng = sfc32(seedFromNumber(0));
    expect(state.log).toEqual([`tools:2:1:p2:undefined:${rng()}:${host.now()}:3:7`]);
    expect(host.sent).toContainEqual({ playerId: "p2", type: "HELLO", payload: 1 });
    expect(host.broadcasts).toEqual([{ type: "ALL", payload: 2 }]);
    expect(host.activations).toBe(1);
  });

  it("rejects transitions to undeclared phases at the call site", () => {
    const { runtime } = inPlay();
    expect(() => runtime.dispatch("p2", { type: "BAD_TARGET" })).toThrow('Unknown phase "Missing"');
  });

  it("drops queued transitions when a handler throws and returns to the Lobby", () => {
    const { runtime, state } = inPlay();
    expect(() => runtime.dispatch("p2", { type: "BOOM" })).toThrow("boom");
    expect(runtime.phase).toBe("Lobby");
    expect(state.notice).toBeTruthy();
  });

  it("surfaces an onEnter failure to the caller, returns to the Lobby and keeps working", () => {
    let explode = true;
    const { runtime, state } = setup2({
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
    expect(runtime.phase).toBe("Lobby");
    expect(state.notice).toBeTruthy();
    explode = false;
    runtime.dispatch("p1", { type: "START_GAME" });
    runtime.dispatch("p1", { type: "GO_ON" });
    expect(runtime.phase).toBe("Score");
  });

  it("surfaces an onTimeout failure to the timer's caller, returns to the Lobby and keeps working", () => {
    let explode = true;
    const { runtime, host, state } = setup2({
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
    expect(runtime.phase).toBe("Lobby");
    expect(state.notice).toBeTruthy();
    explode = false;
    runtime.dispatch("p1", { type: "START_GAME" });
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

describe("onError and the default failure policy", () => {
  const NOTICE = "The game stopped because of an unexpected error.";
  const boomSpec = {
    phases: {
      Play: {
        actions: {
          GUESS: action({
            from: "player",
            payload: z.object({ n: z.number() }),
            handler: (ctx) => ctx.transition("Bad"),
          }),
          BOOM: action({
            from: "player",
            payload: z.object({}),
            handler: () => {
              throw new Error("boom");
            },
          }),
        },
      },
      Bad: {
        onEnter: () => {
          throw new Error("enter boom");
        },
      },
      Score: {},
    },
  };

  it("hands onError every failure of one run, in order, as one AggregateError", () => {
    const seen: unknown[] = [];
    const { runtime } = setup2({
      ...boomSpec,
      middleware: [
        (ctx, next) => {
          if (ctx.event.kind === "transition" && ctx.event.to === "Bad") {
            throw new Error("observe boom");
          }
          next();
        },
      ],
      onError: (_ctx, error) => {
        seen.push(error);
      },
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    let thrown: unknown;
    try {
      runtime.dispatch("p2", { type: "GUESS", n: 1 });
    } catch (error) {
      thrown = error;
    }
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeInstanceOf(AggregateError);
    const errors = (seen[0] as AggregateError).errors;
    expect(errors.map((e) => String(e))).toEqual(["Error: observe boom", "Error: enter boom"]);
    expect(thrown).toBe(seen[0]);
  });

  it("hands a single failure to onError unwrapped and rethrows it", () => {
    const seen: unknown[] = [];
    const { runtime } = setup2({
      ...boomSpec,
      onError: (_ctx, error) => {
        seen.push(error);
      },
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    let thrown: unknown;
    try {
      runtime.dispatch("p2", { type: "BOOM" });
    } catch (error) {
      thrown = error;
    }
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeInstanceOf(Error);
    expect(seen[0]).not.toBeInstanceOf(AggregateError);
    expect((seen[0] as Error).message).toBe("boom");
    expect(thrown).toBe(seen[0]);
  });

  it("returns the room to the Lobby with a fixed notice when a hook throws and there is no onError", () => {
    const { runtime, state } = setup2(boomSpec);
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(() => runtime.dispatch("p2", { type: "GUESS", n: 1 })).toThrow("enter boom");
    expect(runtime.phase).toBe("Lobby");
    expect(state.notice).toBe(NOTICE);
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(runtime.phase).toBe("Play");
  });

  it("sets only the notice when the failure happens in the Lobby", () => {
    const { runtime, state } = setup2({
      onPlayerSync: () => {
        throw new Error("sync boom");
      },
    });
    expect(() => runtime.syncPlayer("p1")).toThrow("sync boom");
    expect(runtime.phase).toBe("Lobby");
    expect(state.notice).toBe(NOTICE);
    expect(state.log).toEqual([]);
  });

  it("applies the same policy to a throwing timer callback", () => {
    const { runtime, host, state } = setup2({
      phases: {
        Play: {
          duration: 100,
          onTimeout: () => {
            throw new Error("timeout boom");
          },
        },
        Score: {},
      },
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(() => host.advance(100)).toThrow("timeout boom");
    expect(runtime.phase).toBe("Lobby");
    expect(state.notice).toBe(NOTICE);
  });

  it("applies the same policy to a throwing middleware", () => {
    const { runtime, state } = setup2({
      phases: {
        Play: {
          actions: {
            GUESS: action({
              from: "player",
              payload: z.object({ n: z.number() }),
              handler: (ctx) => ctx.state.log.push("guess"),
            }),
          },
        },
        Score: {},
      },
      middleware: [
        (ctx, next) => {
          if (ctx.event.kind === "action" && ctx.event.actionType === "GUESS") {
            throw new Error("middleware boom");
          }
          next();
        },
      ],
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(() => runtime.dispatch("p2", { type: "GUESS", n: 1 })).toThrow("middleware boom");
    expect(runtime.phase).toBe("Lobby");
    expect(state.notice).toBe(NOTICE);
  });

  it("catches a throwing onError, surfaces its failure through the rethrow and still applies the default policy", () => {
    const { runtime, state } = setup2({
      ...boomSpec,
      onError: () => {
        throw new Error("onError boom");
      },
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    let thrown: unknown;
    try {
      runtime.dispatch("p2", { type: "BOOM" });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).errors.map((e) => String(e))).toEqual([
      "Error: boom",
      "Error: onError boom",
    ]);
    expect(runtime.phase).toBe("Lobby");
    expect(state.notice).toBe(NOTICE);
  });

  it("logs a failure raised by the default policy itself instead of recursing", () => {
    let onErrorRuns = 0;
    const { runtime, state } = setup2({
      ...boomSpec,
      onReturnToLobby: () => {
        throw new Error("lobby boom");
      },
      onError: (_ctx, _error) => {
        ++onErrorRuns;
      },
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    let thrown: unknown;
    try {
      runtime.dispatch("p2", { type: "BOOM" });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).errors.map((e) => String(e))).toEqual([
      "Error: boom",
      "Error: lobby boom",
    ]);
    expect(onErrorRuns).toBe(1);
    expect(runtime.phase).toBe("Lobby");
    expect(state.notice).toBe(NOTICE);
  });

  it("joins a failure from the default policy's host calls into the rethrow", () => {
    const host = new FaultyActivateHost();
    const { runtime, state } = setup2({ ...boomSpec }, true, host);
    runtime.dispatch("p1", { type: "START_GAME" });
    host.failActivation = true;
    let thrown: unknown;
    try {
      runtime.dispatch("p2", { type: "BOOM" });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).errors.map((e) => String(e))).toEqual([
      "Error: boom",
      "Error: activate boom",
    ]);
    // The policy still completes its return to the Lobby, and the failure does not linger.
    expect(runtime.phase).toBe("Lobby");
    expect(state.notice).toBe(NOTICE);
    host.failActivation = false;
    expect(() => runtime.dispatch("p2", { type: "BOOM" })).not.toThrow();
  });

  it("does not run the default policy when onError queues returnToLobby", () => {
    const { runtime, state } = setup2({
      ...boomSpec,
      onError: (ctx) => {
        ctx.returnToLobby();
      },
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(() => runtime.dispatch("p2", { type: "BOOM" })).toThrow("boom");
    expect(runtime.phase).toBe("Lobby");
    expect(state.notice).toBeUndefined();
  });

  it("applies the transition onError queued instead of the default policy", () => {
    const { runtime, state } = setup2({
      ...boomSpec,
      onError: (ctx) => {
        ctx.transition("Score");
      },
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(() => runtime.dispatch("p2", { type: "BOOM" })).toThrow("boom");
    expect(runtime.phase).toBe("Score");
    expect(state.notice).toBeUndefined();
  });

  it("logs a failure from applying onError's own transition without recursing", () => {
    const { runtime, state } = setup2({
      ...boomSpec,
      onReturnToLobby: () => {
        throw new Error("lobby boom");
      },
      onError: (ctx) => {
        ctx.returnToLobby();
      },
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    let thrown: unknown;
    try {
      runtime.dispatch("p2", { type: "BOOM" });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).errors.map((e) => String(e))).toEqual([
      "Error: boom",
      "Error: lobby boom",
    ]);
    expect(runtime.phase).toBe("Play");
    expect(state.notice).toBeUndefined();
  });
});

const catching = (fn: () => void): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
};

describe("every hook failure ends under the failure policy", () => {
  const NOTICE = "The game stopped because of an unexpected error.";
  const loopPhases = {
    Ping: { onEnter: (ctx: GameContext<S, P, O>) => ctx.transition("Pong") },
    Pong: { onEnter: (ctx: GameContext<S, P, O>) => ctx.transition("Ping") },
  };
  const errorsOf = (thrown: unknown): string[] =>
    thrown instanceof AggregateError ? thrown.errors.map((e) => String(e)) : [String(thrown)];

  it("routes a two-phase onEnter loop through onError and back to the Lobby", () => {
    const seen: unknown[] = [];
    const { runtime, state } = setup2({
      startPhase: "Ping",
      phases: loopPhases,
      onError: (_ctx, error) => seen.push(error),
    });
    const thrown = catching(() => runtime.dispatch("p1", { type: "START_GAME" }));
    expect(seen).toHaveLength(1);
    expect(String(seen[0])).toContain("chained transitions");
    expect(String(thrown)).toContain("chained transitions");
    expect(runtime.phase).toBe("Lobby");
    expect(state.notice).toBe(NOTICE);
  });

  it("still ends in the Lobby, rethrowing the original failure, when onError queues a loop", () => {
    const { runtime, state } = setup2({
      startPhase: "Play",
      phases: {
        ...loopPhases,
        Play: {
          actions: {
            BOOM: action({
              from: "player",
              payload: z.object({}),
              handler: () => {
                throw new Error("boom");
              },
            }),
          },
        },
      },
      onError: (ctx) => ctx.transition("Ping"),
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    const errors = errorsOf(catching(() => runtime.dispatch("p2", { type: "BOOM" })));
    expect(errors[0]).toBe("Error: boom");
    expect(errors.some((e) => e.includes("chained transitions"))).toBe(true);
    expect(runtime.phase).toBe("Lobby");
    expect(state.notice).toBe(NOTICE);
  });

  it("calls onReturnToLobby once when it throws on a queued returnToLobby", () => {
    let calls = 0;
    const { runtime } = setup2({
      onReturnToLobby: () => {
        ++calls;
        throw new Error("lobby boom");
      },
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    const errors = errorsOf(catching(() => runtime.dispatch("p1", { type: "HOME" })));
    expect(errors).toEqual(["Error: lobby boom"]);
    expect(calls).toBe(1);
    expect(runtime.phase).toBe("Lobby");
  });

  it("reports a construction-time failure at construction, not on the next action", () => {
    const seen: unknown[] = [];
    let armed = true;
    const host = new FakeHost();
    host.seat("p1");
    host.seat("p2");
    const state = newState();
    const runtime = new GameRuntime({
      definition: makeSpec({
        onError: (_ctx, error) => seen.push(error),
        middleware: [
          (ctx, next) => {
            if (armed && ctx.event.kind === "enter") {
              armed = false;
              throw new Error("enter boom");
            }
            next();
          },
        ],
      }),
      state,
      host,
      options: { rounds: 3 },
    });
    expect(seen.map((e) => String(e))).toEqual(["Error: enter boom"]);
    expect(state.notice).toBe(NOTICE);
    expect(runtime.dispatch("p1", { type: "START_GAME" })).toBeUndefined();
    expect(seen).toHaveLength(1);
    expect(runtime.phase).toBe("Play");
  });

  it("gives a FrameworkError from onRosterChange the same policy as a plain Error", () => {
    const seen: unknown[] = [];
    const { runtime, state } = setup2({
      phases: {
        Play: {
          onRosterChange: () => {
            throw new FrameworkError(ErrorCode.NOT_ALLOWED, "roster detail");
          },
        },
      },
      onError: (_ctx, error) => seen.push(error),
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    const thrown = catching(() => runtime.rosterChanged());
    expect(thrown).toBeInstanceOf(FrameworkError);
    expect(seen).toEqual([thrown]);
    expect(runtime.phase).toBe("Lobby");
    expect(state.notice).toBe(NOTICE);
  });

  it("gives a FrameworkError from onTimeout the same policy as a plain Error", () => {
    const seen: unknown[] = [];
    const { runtime, host } = setup2({
      phases: {
        Play: {
          duration: 1000,
          onTimeout: () => {
            throw new FrameworkError(ErrorCode.NOT_ALLOWED, "timeout detail");
          },
        },
      },
      onError: (_ctx, error) => seen.push(error),
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(catching(() => host.advance(1000))).toBeInstanceOf(FrameworkError);
    expect(seen).toHaveLength(1);
    expect(runtime.phase).toBe("Lobby");
  });
});

describe("the failure policy's Lobby return is observable", () => {
  const BOOM_PHASES = {
    Play: {
      actions: {
        BOOM: action({
          from: "player",
          payload: z.object({}),
          handler: () => {
            throw new Error("boom");
          },
        }),
        HOME: action({
          from: "player",
          payload: z.object({}),
          handler: (ctx) => ctx.returnToLobby(),
        }),
      },
    },
  } satisfies Spec["phases"];

  const observed = (overrides: Overrides = {}) => {
    const transitions: string[] = [];
    const ctx = setup2({
      phases: BOOM_PHASES,
      middleware: [
        (mctx, next) => {
          if (mctx.event.kind === "transition") {
            transitions.push(`${mctx.event.from}->${mctx.event.to}`);
          }
          next();
        },
      ],
      ...overrides,
    });
    ctx.runtime.dispatch("p1", { type: "START_GAME" });
    transitions.length = 0;
    return { ...ctx, transitions };
  };

  it("emits exactly one transition to middleware when a hook failure returns the room to the Lobby", () => {
    const { runtime, transitions } = observed();
    expect(() => runtime.dispatch("p2", { type: "BOOM" })).toThrow("boom");
    expect(runtime.phase).toBe("Lobby");
    expect(transitions).toEqual(["Play->Lobby"]);
  });

  it("emits one transition, not two, when a throwing onReturnToLobby hands over to the policy", () => {
    const { runtime, transitions } = observed({
      onReturnToLobby: () => {
        throw new Error("lobby boom");
      },
    });
    expect(() => runtime.dispatch("p2", { type: "HOME" })).toThrow("lobby boom");
    expect(runtime.phase).toBe("Lobby");
    expect(transitions).toEqual(["Play->Lobby"]);
  });

  it("does not let a throwing observer stop the return to the Lobby", () => {
    const { runtime } = setup2({
      phases: BOOM_PHASES,
      middleware: [
        (mctx, next) => {
          if (mctx.event.kind === "transition" && mctx.event.to === "Lobby") {
            throw new Error("observe boom");
          }
          next();
        },
      ],
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    const thrown = catching(() => runtime.dispatch("p2", { type: "BOOM" }));
    expect((thrown as AggregateError).errors.map((e) => String(e))).toEqual([
      "Error: boom",
      "Error: observe boom",
    ]);
    expect(runtime.phase).toBe("Lobby");
  });
});

describe("the failure notice", () => {
  it("is cleared when the next game starts", () => {
    const { runtime, state } = setup2();
    state.notice = "The game stopped because of an unexpected error.";
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(state.notice).toBe("");
  });

  it("survives a START_GAME that is refused", () => {
    const { runtime, state } = setup2({}, false);
    state.notice = "old";
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(runtime.phase).toBe("Lobby");
    expect(state.notice).toBe("old");
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
    expect(host.errorsTo("p2")[0]).toMatchObject({ code: "UNAUTHORIZED" });
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
    expect(host.errorsTo("p2")[0]).toMatchObject({ code: "UNAUTHORIZED" });
    expect(runtime.phase).toBe("Play");
    expect(state.log).toEqual([]);
  });

  it("is refused in the Lobby", () => {
    const { runtime, state } = withHook();
    expect(runtime.dispatch("p1", { type: "END_GAME" })).toEqual({
      code: ErrorCode.WRONG_PHASE,
      message: CLIENT_MESSAGES.WRONG_PHASE,
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
    expect(host.errorsTo("p1")[0]).toMatchObject({ code: "WRONG_PHASE" });
    expect(host.published).toEqual([]);
  });

  it("rejects options failing the schema and keeps the old value", () => {
    const { runtime, host } = setup2();
    runtime.dispatch("p1", { type: "SET_OPTIONS", rounds: "many" });
    expect(host.errorsTo("p1")[0]).toMatchObject({ code: "INVALID_ACTION", action: "SET_OPTIONS" });
    expect(host.published).toEqual([]);
  });

  it("rejects any non-type keys when the game declares no options schema", () => {
    const { runtime, host } = setup2({ options: undefined });
    runtime.dispatch("p1", { type: "SET_OPTIONS", a: 1 });
    expect(host.errorsTo("p1")[0]).toMatchObject({ code: "INVALID_ACTION", action: "SET_OPTIONS" });
    expect(host.published).toEqual([]);
  });

  it("accepts empty SET_OPTIONS when the game declares no options schema and publishes the unchanged options", () => {
    const { runtime, host } = setup2({ options: undefined });
    runtime.dispatch("p1", { type: "SET_OPTIONS" });
    expect(host.errorsTo("p1")).toEqual([]);
    expect(host.published).toEqual([{ rounds: 3 }]);
  });

  it("rejects options whose JSON exceeds MAX_OPTIONS_JSON_LENGTH", () => {
    const { runtime, host } = setup2({ options: z.looseObject({ rounds: z.number() }) });
    runtime.dispatch("p1", { type: "SET_OPTIONS", data: "x".repeat(MAX_OPTIONS_JSON_LENGTH) });
    expect(host.errorsTo("p1")[0]).toMatchObject({ code: "INVALID_ACTION", action: "SET_OPTIONS" });
    expect(host.published).toEqual([]);
  });
});
