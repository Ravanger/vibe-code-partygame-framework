import { ErrorCode, FrameworkError, START_GAME } from "@partygame/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineGame, type GameDefinition, GameRuntime, type PhaseState } from "../../src/index.js";
import { DispatchPipeline } from "../../src/runtime/DispatchPipeline.js";
import { Lobby } from "../../src/runtime/lobby.js";
import {
  type CoreStrings,
  defaultCoreStrings,
  mergeCoreStrings,
} from "../../src/runtime/strings.js";
import type {
  ActionContext,
  ActionDefinition,
  GameContext,
  PlayerInfo,
} from "../../src/runtime/types.js";
import { FakeHost } from "../../src/testing/FakeHost.js";

type S = PhaseState;

const valid = (strings?: Partial<CoreStrings>): GameDefinition<S> =>
  defineGame<S, Record<string, never>, Record<string, unknown>>({
    name: "G",
    version: "1",
    minPlayers: 2,
    maxPlayers: 4,
    startPhase: "Play",
    createPrivateState: () => ({}),
    phases: { Play: {} },
    ...(strings ? { strings } : {}),
  });

describe("CoreStrings and defineGame", () => {
  it("holds the English text for every core-owned string", () => {
    expect(defaultCoreStrings.stopped).toBe("The game has ended");
    expect(defaultCoreStrings.failureNotice).toBe(
      "The game stopped because of an unexpected error.",
    );
    expect(defaultCoreStrings.cannotKickSelf).toBe("You cannot kick yourself");
    expect(defaultCoreStrings.noSuchPlayer).toBe("No such player");
    expect(defaultCoreStrings.endGameInLobby).toBe("END_GAME is not allowed in Lobby");
    expect(defaultCoreStrings.needAtLeast(3)).toBe("Need at least 3 players to start");
    expect(defaultCoreStrings.notAllowedToSend("PRESS")).toBe("Not allowed to send PRESS");
    expect(defaultCoreStrings.waitingToBeLetIn).toBe("You are waiting to be let in");
    expect(defaultCoreStrings.audienceActionFromSeat("VOTE")).toBe("VOTE is an audience action");
    expect(defaultCoreStrings.notAllowedInPhase("VOTE", "Scoring")).toBe(
      "VOTE is not allowed in Scoring",
    );
    expect(defaultCoreStrings.unknownAction("NOPE")).toBe("Unknown action NOPE");
  });

  it("fills the definition with the merged table, keeping its identity", () => {
    const spec = valid({ cannotKickSelf: "Du kannst dich nicht selbst rausschmeißen" });
    expect(spec.strings).toBeDefined();
    expect(spec.strings?.cannotKickSelf).toBe("Du kannst dich nicht selbst rausschmeißen");
    expect(spec.strings?.noSuchPlayer).toBe(defaultCoreStrings.noSuchPlayer);
  });

  it("leaves a definition without strings on the defaults", () => {
    const spec = valid();
    expect(spec.strings).toEqual(defaultCoreStrings);
  });

  it("merges only the given keys over the defaults", () => {
    const merged = mergeCoreStrings({ stopped: "Vorbei" });
    expect(merged.stopped).toBe("Vorbei");
    expect(merged.noSuchPlayer).toBe(defaultCoreStrings.noSuchPlayer);
  });
});

describe("client-visible core strings through the runtime", () => {
  const started = (strings?: Partial<CoreStrings>) => {
    const host = new FakeHost();
    host.seat("p1");
    host.seat("p2");
    const state: S = { phase: "Lobby", phaseEndsAt: 0, canStart: false };
    const runtime = new GameRuntime<S, Record<string, never>, Record<string, unknown>>({
      definition: valid(strings),
      state,
      host,
      options: {},
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    return { host, state, runtime };
  };

  it("keeps the English defaults without a strings table", () => {
    const { host, runtime } = started();
    runtime.dispatch("p1", { type: "KICK_PLAYER", playerId: "p1" });
    runtime.dispatch("p1", { type: "KICK_PLAYER", playerId: "ghost" });
    expect(host.errorsTo("p1")).toEqual([
      { code: ErrorCode.NOT_ALLOWED, message: "You cannot kick yourself", action: "KICK_PLAYER" },
      { code: ErrorCode.NOT_ALLOWED, message: "No such player", action: "KICK_PLAYER" },
    ]);
    runtime.stop();
    expect(runtime.dispatch("p1", { type: "START_GAME" })).toEqual({
      code: ErrorCode.NOT_ALLOWED,
      message: "The game has ended",
    });
  });

  it("carries the replacement in kick and stopped refusals and keeps other keys on the defaults", () => {
    const { host, runtime } = started({
      cannotKickSelf: "Du kannst dich nicht selbst rausschmeißen",
      stopped: "Das Spiel ist vorbei",
    });
    runtime.dispatch("p1", { type: "KICK_PLAYER", playerId: "p1" });
    runtime.dispatch("p1", { type: "KICK_PLAYER", playerId: "ghost" });
    expect(host.errorsTo("p1")).toEqual([
      {
        code: ErrorCode.NOT_ALLOWED,
        message: "Du kannst dich nicht selbst rausschmeißen",
        action: "KICK_PLAYER",
      },
      { code: ErrorCode.NOT_ALLOWED, message: "No such player", action: "KICK_PLAYER" },
    ]);
    runtime.stop();
    expect(runtime.dispatchAudience("a1", { type: "START_GAME" })).toEqual({
      code: ErrorCode.NOT_ALLOWED,
      message: "Das Spiel ist vorbei",
    });
  });

  it("writes the replaced failure notice to state.notice", () => {
    const host = new FakeHost();
    host.seat("p1");
    host.seat("p2");
    const state: S = { phase: "Lobby", phaseEndsAt: 0, canStart: false };
    const definition = defineGame<S, Record<string, never>, Record<string, unknown>>({
      name: "G",
      version: "1",
      minPlayers: 2,
      maxPlayers: 4,
      startPhase: "Play",
      createPrivateState: () => ({}),
      phases: {
        Play: {
          onEnter: () => {
            throw new Error("boom");
          },
        },
      },
      strings: { failureNotice: "Etwas ist schiefgelaufen." },
    });
    const runtime = new GameRuntime<S, Record<string, never>, Record<string, unknown>>({
      definition,
      state,
      host,
      options: {},
    });
    expect(() => runtime.dispatch("p1", { type: "START_GAME" })).toThrow();
    expect(state.notice).toBe("Etwas ist schiefgelaufen.");
  });
});

describe("log-only core strings", () => {
  const seat = (i: number): PlayerInfo => ({
    id: `p${i}`,
    name: `P${i}`,
    role: i === 0 ? "host" : "player",
    isConnected: true,
    isReady: true,
    isActive: true,
  });

  const fakeContext = (activePlayers: number): GameContext<S, unknown, unknown> => ({
    state: { phase: "Lobby", phaseEndsAt: 0, canStart: false },
    priv: {},
    options: {},
    phase: "Lobby",
    players: () => [],
    activePlayers: () => Array.from({ length: activePlayers }, (_, i) => seat(i)),
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
    gameVersion: "1",
    seed: [0, 0, 0, 0],
  });

  const frameworkError = (fn: () => void): FrameworkError => {
    try {
      fn();
    } catch (error) {
      if (error instanceof FrameworkError) return error;
    }
    throw new Error("expected a FrameworkError");
  };

  it("builds the lobby refusals from the table, function entries included", () => {
    const definition = valid({
      endGameInLobby: "END_GAME geht im Lobby nicht",
      needAtLeast: (n) => `Noch ${n - 1} Spieler fehlen`,
    });
    const lobby = new Lobby<S, Record<string, never>, Record<string, unknown>>({
      definition,
      host: new FakeHost(),
      options: { get: () => ({}), set: () => {} },
      hasStarted: () => false,
      rosterChanged: () => {},
    });
    expect(
      frameworkError(() => lobby.endGameAction().handler(fakeContext(2) as never)).message,
    ).toBe("END_GAME geht im Lobby nicht");
    const actions = lobby.phase().actions;
    if (actions === undefined)
      throw new Error("expected the Lobby to declare its built-in actions");
    const startGame = actions[START_GAME] as ActionDefinition<S, unknown, unknown, unknown>;
    expect(frameworkError(() => startGame.handler(fakeContext(1) as never)).message).toBe(
      "Noch 1 Spieler fehlen",
    );
  });

  it("builds the pipeline refusals from the table, function entries included", () => {
    const def: ActionDefinition<S, unknown, unknown, unknown> = {
      from: "host",
      payload: z.object({}),
      handler: (_ctx: ActionContext<S, unknown, unknown, unknown>) => {},
    };
    const player: PlayerInfo = {
      id: "p1",
      name: "P1",
      role: "player",
      isConnected: true,
      isReady: true,
      isActive: true,
    };
    const pipeline = new DispatchPipeline<S, unknown, unknown>({
      builtins: {},
      currentPhaseActions: () => ({ GIVE_UP: def }),
      declaredInAnyPhase: (type) => type === "NOPE",
      phaseName: () => "Scoring",
      players: () => [player],
      contextFactory: () => fakeContext(0),
      filterLevel: () => "off",
      audienceOnce: () => true,
      reject: () => {},
      chain: (_event, inner) => inner(),
      strings: {
        notAllowedToSend: (action) => `Nein: ${action}`,
        waitingToBeLetIn: "Warten auf Einlass",
        audienceActionFromSeat: (action) => `${action} ist ein Zuschauerzug`,
        notAllowedInPhase: (action, phase) => `${action} nicht in ${phase}`,
        unknownAction: (action) => `Unbekannt: ${action}`,
      },
    });
    expect(frameworkError(() => pipeline.run("p1", { type: "GIVE_UP" })).message).toBe(
      "Nein: GIVE_UP",
    );
  });
});
