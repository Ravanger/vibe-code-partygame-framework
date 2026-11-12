import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  actionFactory,
  defineGame,
  departedIds,
  endIfBelowMinimum,
  ensureMine,
  type GameContext,
  isBelowMinimum,
  type PhaseState,
  pruneMine,
  RosterLedger,
  required,
  resetMine,
  seatedCount,
} from "../src/index.js";
import { TestTable } from "../src/testing/index.js";

interface RosterState extends PhaseState {
  mine: Map<string, object>;
}
type RosterCtx = GameContext<RosterState, Record<string, never>, Record<string, never>>;

const captured: { ctx?: RosterCtx; below?: boolean } = {};

const action = actionFactory<RosterState, Record<string, never>, Record<string, never>>();

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
      actions: {
        CHECK_MINIMUM: action({
          from: "player",
          payload: z.object({}),
          handler: (ctx) => {
            captured.below = endIfBelowMinimum(ctx, 2, "too few");
          },
        }),
      },
    },
  },
});

const table = (): TestTable<RosterState, Record<string, never>, Record<string, never>> =>
  new TestTable({
    definition,
    state: { phase: "", phaseEndsAt: 0, canStart: false, mine: new Map() },
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

describe("RosterLedger", () => {
  it("remembers every name and only the active, ready participants", () => {
    const t = table();
    t.start();
    const ledger = new RosterLedger();
    ledger.remember(ctxOf());
    expect(ledger.rememberedNames).toEqual({ p1: "p1", p2: "p2", p3: "p3" });
    expect(ledger.participantIds).toEqual(["p1", "p2", "p3"]);
  });

  it("updates renamed seats and skips blank, not-ready or inactive ones", () => {
    const t = table();
    t.start();
    const ctx = ctxOf();
    const ledger = new RosterLedger();
    required(t.host.seats[0], "seat").name = "";
    required(t.host.seats[1], "seat").isReady = false;
    required(t.host.seats[2], "seat").isActive = false;
    ledger.remember(ctx);
    expect(ledger.rememberedNames).toEqual({ p2: "p2", p3: "p3" });
    expect(ledger.participantIds).toEqual(["p1"]);
    required(t.host.seats[0], "seat").name = "Pip";
    ledger.remember(ctx);
    expect(ledger.rememberedNames).toEqual({ p1: "Pip", p2: "p2", p3: "p3" });
  });

  it("names a seated player by their seat, a leaver by the remembered name, an unknown id empty", () => {
    const t = table();
    t.start();
    const ctx = ctxOf();
    const ledger = new RosterLedger();
    ledger.remember(ctx);
    expect(ledger.nameOf(ctx, "p1")).toBe("p1");
    required(t.host.seats[2], "seat").name = "Pip";
    ledger.remember(ctx);
    t.leave("p3");
    expect(ledger.nameOf(ctx, "p3")).toBe("Pip");
    expect(ledger.nameOf(ctx, "nobody")).toBe("");
  });

  it("drop forgets one player; clear forgets everyone", () => {
    const t = table();
    t.start();
    const ctx = ctxOf();
    const ledger = new RosterLedger();
    ledger.remember(ctx);
    t.leave("p3");
    ledger.drop("p3");
    expect(ledger.participantIds).toEqual(["p1", "p2"]);
    expect(ledger.nameOf(ctx, "p3")).toBe("");
    ledger.clear();
    expect(ledger.rememberedNames).toEqual({});
    expect(ledger.participantIds).toEqual([]);
  });
});

describe("endIfBelowMinimum", () => {
  it("is a no-op at or above the minimum", () => {
    const t = table();
    t.start();
    t.act("p2", "CHECK_MINIMUM");
    expect(captured.below).toBe(false);
    expect(t.state.phase).toBe("Room");
    expect(t.state.notice).toBeUndefined();
    t.leave("p3");
    t.act("p2", "CHECK_MINIMUM");
    expect(captured.below).toBe(false);
  });

  it("sets the notice and returns to the lobby below the minimum", () => {
    const t = table();
    t.start();
    t.leave("p2");
    t.leave("p3");
    t.act("p1", "CHECK_MINIMUM");
    expect(captured.below).toBe(true);
    expect(t.state.notice).toBe("too few");
    expect(t.state.phase).toBe("Lobby");
  });
});

describe("private entries", () => {
  it("ensureMine creates and reveals a missing entry, then reuses it", () => {
    const t = table();
    t.start();
    const ctx = ctxOf();
    const first = ensureMine(ctx, t.state.mine, "p1", () => ({}));
    expect(t.state.mine.get("p1")).toBe(first);
    expect(t.host.views).toEqual([{ op: "show", playerId: "p1", ref: first }]);
    expect(ensureMine(ctx, t.state.mine, "p1", () => ({ other: true }))).toBe(first);
    expect(t.host.views).toHaveLength(1);
  });

  it("resetMine hides every entry and empties the map", () => {
    const t = table();
    t.start();
    const ctx = ctxOf();
    const a = ensureMine(ctx, t.state.mine, "p1", () => ({}));
    const b = ensureMine(ctx, t.state.mine, "p2", () => ({}));
    resetMine(ctx, t.state.mine);
    expect(t.state.mine.size).toBe(0);
    expect(t.host.views).toEqual([
      { op: "show", playerId: "p1", ref: a },
      { op: "show", playerId: "p2", ref: b },
      { op: "hide", playerId: "p1", ref: a },
      { op: "hide", playerId: "p2", ref: b },
    ]);
  });

  it("pruneMine hides and removes only the departed entries, unique in input order", () => {
    const t = table();
    t.start();
    const ctx = ctxOf();
    const a = ensureMine(ctx, t.state.mine, "p1", () => ({}));
    const b = ensureMine(ctx, t.state.mine, "p2", () => ({}));
    const c = ensureMine(ctx, t.state.mine, "p3", () => ({}));
    t.leave("p2");
    t.drop("p3");
    const keys = [...t.state.mine.keys()];
    expect(pruneMine(ctx, t.state.mine, [...keys, ...keys, "p9"])).toEqual(["p2", "p9"]);
    expect(t.state.mine.has("p1")).toBe(true);
    expect(t.state.mine.has("p3")).toBe(true);
    expect(t.host.views).toEqual([
      { op: "show", playerId: "p1", ref: a },
      { op: "show", playerId: "p2", ref: b },
      { op: "show", playerId: "p3", ref: c },
      { op: "hide", playerId: "p2", ref: b },
    ]);
  });
});
