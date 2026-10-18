import { describe, expect, it } from "vitest";
import {
  defineGame,
  departedIds,
  type GameContext,
  isBelowMinimum,
  type PhaseState,
  required,
  seatedCount,
} from "../src/index.js";
import { TestTable } from "../src/testing/index.js";

type RosterState = PhaseState;
type RosterCtx = GameContext<RosterState, Record<string, never>, Record<string, never>>;

const captured: { ctx?: RosterCtx } = {};

const definition = defineGame<RosterState, Record<string, never>, Record<string, never>>({
  name: "Roster",
  version: "1",
  minPlayers: 2,
  maxPlayers: 6,
  startPhase: "Room",
  createPrivateState: () => ({}),
  phases: {
    Room: {
      onEnter: (ctx) => {
        captured.ctx = ctx;
      },
    },
  },
});

const table = (): TestTable<RosterState, Record<string, never>, Record<string, never>> =>
  new TestTable({
    definition,
    state: { phase: "", phaseEndsAt: 0, canStart: false },
    options: {},
    players: 3,
  });

const ctxOf = (): RosterCtx => required(captured.ctx, "context");

describe("seatedCount", () => {
  it("counts only active and ready seats", () => {
    const t = table();
    t.start();
    const ctx = ctxOf();
    expect(seatedCount(ctx)).toBe(3);
    required(t.host.seats[1], "seat").isReady = false;
    expect(seatedCount(ctx)).toBe(2);
    required(t.host.seats[2], "seat").isActive = false;
    expect(seatedCount(ctx)).toBe(1);
  });

  it("still counts a briefly disconnected seat", () => {
    const t = table();
    t.start();
    const ctx = ctxOf();
    t.drop("p2");
    expect(required(t.host.seats[1], "seat").isConnected).toBe(false);
    expect(seatedCount(ctx)).toBe(3);
  });
});

describe("isBelowMinimum", () => {
  it("is false with enough seats and true below the minimum", () => {
    const t = table();
    t.start();
    const ctx = ctxOf();
    expect(isBelowMinimum(ctx, 2)).toBe(false);
    expect(isBelowMinimum(ctx, 3)).toBe(false);
    t.leave("p2");
    t.leave("p3");
    expect(isBelowMinimum(ctx, 2)).toBe(true);
  });
});

describe("departedIds", () => {
  it("returns the ids with no seat, in input order", () => {
    const t = table();
    t.start();
    const ctx = ctxOf();
    expect(departedIds(["p1", "p2", "p3"], ctx)).toEqual([]);
    t.leave("p2");
    expect(departedIds(["p9", "p2", "p1"], ctx)).toEqual(["p9", "p2"]);
  });

  it("is empty for an empty list", () => {
    const t = table();
    t.start();
    expect(departedIds([], ctxOf())).toEqual([]);
  });
});
