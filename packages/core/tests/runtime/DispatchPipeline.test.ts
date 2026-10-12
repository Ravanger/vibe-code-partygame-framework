import { ErrorCode, type ServerError } from "@partygame/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DispatchPipeline } from "../../src/runtime/DispatchPipeline.js";
import type {
  ActionContext,
  ActionDefinition,
  GameContext,
  MiddlewareEvent,
  PhaseState,
  PlayerInfo,
} from "../../src/runtime/types.js";

type D = ActionDefinition<PhaseState, unknown, unknown, unknown>;

const fakeContext = (): GameContext<PhaseState, unknown, unknown> => ({
  state: { phase: "Play", phaseEndsAt: 0, canStart: false },
  priv: {},
  options: {},
  phase: "Play",
  players: () => [],
  activePlayers: () => [],
  player: () => undefined,
  activateWaitingPlayers: () => {},
  send: () => {},
  broadcast: () => {},
  showTo: () => {},
  hideFrom: () => {},
  transition: () => {},
  returnToLobby: () => {},
  rng: () => 0,
  newId: () => "id",
  now: () => 0,
  gameName: "Test",
  seed: 1,
});

const player = (over: Partial<PlayerInfo> = {}): PlayerInfo => ({
  id: "p1",
  name: "P1",
  role: "player",
  isConnected: true,
  isReady: true,
  isActive: true,
  ...over,
});

function makeDef(
  from: "host" | "player" = "player",
  onHandler?: (ctx: ActionContext<PhaseState, unknown, unknown, unknown>) => void,
): { def: D; ran: () => number; lastPayload: () => unknown } {
  let runs = 0;
  let lastPayload: unknown;
  const def: D = {
    from,
    payload: z.object({ n: z.number() }),
    handler(ctx) {
      ++runs;
      lastPayload = ctx.payload;
      onHandler?.(ctx);
    },
  };
  return { def, ran: () => runs, lastPayload: () => lastPayload };
}

function makePipeline(
  options: {
    builtins?: Record<string, D>;
    phaseActions?: Record<string, D>;
    declaredElsewhere?: string[];
    phaseName?: string;
    players?: PlayerInfo[];
  } = {},
) {
  const sent: ServerError[] = [];
  const events: MiddlewareEvent[] = [];
  const pipeline = new DispatchPipeline<PhaseState, unknown, unknown>({
    builtins: options.builtins ?? {},
    currentPhaseActions: () => options.phaseActions,
    declaredInAnyPhase: (type) => (options.declaredElsewhere ?? []).includes(type),
    phaseName: () => options.phaseName ?? "Play",
    players: () => options.players ?? [player()],
    contextFactory: fakeContext,
    reject: (_playerId, action, code, message) => {
      sent.push(action === undefined ? { code, message } : { code, message, action });
    },
    chain: (event, inner) => {
      events.push(event);
      inner();
    },
  });
  return { pipeline, sent, events };
}

describe("DispatchPipeline", () => {
  it("rejects a malformed envelope with INVALID_ACTION without looking anything up", () => {
    const h = makePipeline();
    h.pipeline.run("p1", "not an object");
    expect(h.sent).toEqual([{ code: ErrorCode.INVALID_ACTION, message: "Malformed action" }]);
    expect(h.events).toEqual([]);
  });

  it("rejects an envelope whose type is not a valid action name", () => {
    const h = makePipeline();
    h.pipeline.run("p1", { type: "bad-name" });
    expect(h.sent).toEqual([{ code: ErrorCode.INVALID_ACTION, message: "Malformed action" }]);
  });

  it("rejects an undeclared action with UNKNOWN_ACTION", () => {
    const h = makePipeline();
    h.pipeline.run("p1", { type: "NOPE" });
    expect(h.sent).toEqual([
      { code: ErrorCode.UNKNOWN_ACTION, message: "Unknown action NOPE", action: "NOPE" },
    ]);
    expect(h.events).toEqual([]);
  });

  it("rejects a declared-elsewhere action with WRONG_PHASE naming the current phase", () => {
    const h = makePipeline({ declaredElsewhere: ["NOPE"], phaseName: "Scoring" });
    h.pipeline.run("p1", { type: "NOPE" });
    expect(h.sent).toEqual([
      { code: ErrorCode.WRONG_PHASE, message: "NOPE is not allowed in Scoring", action: "NOPE" },
    ]);
  });

  it("rejects UNAUTHORIZED for an unknown sender and a non-host on a host-only action, and lets the host through", () => {
    const { def, ran } = makeDef("host");
    const ghost = makePipeline({ players: [], phaseActions: { GIVE_UP: def } });
    ghost.pipeline.run("ghost", { type: "GIVE_UP", n: 1 });
    expect(ghost.sent).toEqual([
      { code: ErrorCode.UNAUTHORIZED, message: "Not allowed to send GIVE_UP", action: "GIVE_UP" },
    ]);

    const nonHost = makePipeline({ phaseActions: { GIVE_UP: def } });
    nonHost.pipeline.run("p1", { type: "GIVE_UP", n: 1 });
    expect(nonHost.sent).toEqual([
      { code: ErrorCode.UNAUTHORIZED, message: "Not allowed to send GIVE_UP", action: "GIVE_UP" },
    ]);

    const host = makePipeline({
      players: [player({ id: "h1", role: "host" })],
      phaseActions: { GIVE_UP: def },
    });
    host.pipeline.run("h1", { type: "GIVE_UP", n: 1 });
    expect(host.sent).toEqual([]);
    expect(ran()).toBe(1);
  });

  it("rejects NOT_ACTIVE for a waiting seat", () => {
    const { def } = makeDef();
    const h = makePipeline({
      players: [player({ isActive: false })],
      phaseActions: { GIVE_UP: def },
    });
    h.pipeline.run("p1", { type: "GIVE_UP", n: 1 });
    expect(h.sent).toEqual([
      { code: ErrorCode.NOT_ACTIVE, message: "You are waiting to be let in", action: "GIVE_UP" },
    ]);
  });

  it("rejects INVALID_ACTION when the payload fails the phase schema", () => {
    const { def, ran } = makeDef();
    const h = makePipeline({ phaseActions: { GIVE_UP: def } });
    h.pipeline.run("p1", { type: "GIVE_UP", n: "not a number" });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]?.code).toBe(ErrorCode.INVALID_ACTION);
    expect(h.sent[0]?.action).toBe("GIVE_UP");
    expect(h.sent[0]?.message).toBeTruthy();
    expect(ran()).toBe(0);
  });

  it("runs the handler inside chain with the parsed payload on success", () => {
    const { def, ran, lastPayload } = makeDef();
    const h = makePipeline({ phaseActions: { GIVE_UP: def } });
    h.pipeline.run("p1", { type: "GIVE_UP", n: 7 });
    expect(h.sent).toEqual([]);
    expect(ran()).toBe(1);
    expect(lastPayload()).toEqual({ n: 7 });
    expect(h.events).toEqual([
      { kind: "action", actionType: "GIVE_UP", senderId: "p1", payload: { n: 7 } },
    ]);
  });

  it("prefers builtins over the current phase's actions", () => {
    const builtin = makeDef();
    const local = makeDef();
    const h = makePipeline({
      builtins: { GIVE_UP: builtin.def },
      phaseActions: { GIVE_UP: local.def },
    });
    h.pipeline.run("p1", { type: "GIVE_UP", n: 1 });
    expect(builtin.ran()).toBe(1);
    expect(local.ran()).toBe(0);
  });

  it("routes ctx.reject through the runtime reject with the action name", () => {
    const { def } = makeDef("player", (ctx) => ctx.reject(ErrorCode.NOT_ALLOWED, "nope"));
    const h = makePipeline({ phaseActions: { GIVE_UP: def } });
    h.pipeline.run("p1", { type: "GIVE_UP", n: 1 });
    expect(h.sent).toEqual([{ code: ErrorCode.NOT_ALLOWED, message: "nope", action: "GIVE_UP" }]);
  });
});
