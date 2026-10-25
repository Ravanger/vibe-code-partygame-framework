import { PROTOCOL_VERSION } from "@partygame/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  type ActionLog,
  actionFactory,
  defineGame,
  mulberry32,
  type PhaseState,
} from "../src/index.js";
import { replayLog } from "../src/replay/index.js";
import { TestTable } from "../src/testing/index.js";

/** One seeded run of the fuzz; small enough to stay well under the suite's time budget. */
const ITERATIONS = 500;

interface S extends PhaseState {
  taps: number;
  rolls: number[];
}

const optionsSchema = z.object({ fast: z.boolean().default(false) });
type FuzzOptions = z.infer<typeof optionsSchema>;

const action = actionFactory<S, Record<string, never>, FuzzOptions>();

const definition = defineGame<S, Record<string, never>, FuzzOptions>({
  name: "Fuzz",
  version: "1",
  minPlayers: 2,
  maxPlayers: 4,
  startPhase: "Tap",
  options: optionsSchema,
  createPrivateState: () => ({}),
  phases: {
    Tap: {
      duration: 1000,
      onTimeout: (ctx) => ctx.transition("Roll"),
      actions: {
        TAP: action({
          from: "player",
          payload: z.object({ by: z.number() }),
          handler: (ctx) => {
            ctx.state.taps += ctx.payload.by;
          },
        }),
      },
    },
    Roll: {
      duration: 500,
      onEnter: (ctx) => {
        ctx.state.rolls.push(Math.floor(ctx.rng() * 1000));
      },
      onTimeout: (ctx) => ctx.transition("Tap"),
      actions: {
        TAP: action({
          from: "player",
          payload: z.object({ by: z.number() }),
          handler: (ctx) => {
            ctx.state.taps -= ctx.payload.by;
          },
        }),
      },
    },
  },
});

const newState = (): S => ({ phase: "", phaseEndsAt: 0, canStart: false, taps: 0, rolls: [] });

const pick = <T>(rng: () => number, items: readonly T[]): T => {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error("fuzz pool is empty");
  return item;
};

/** One hostile raw action: a valid TAP among malformed payloads, names and envelopes. */
const hostileEnvelope = (rng: () => number): unknown =>
  pick(rng, [
    { type: "TAP", by: Math.floor(rng() * 7) - 3 },
    { type: "TAP", by: "nope" },
    { type: "TAP", by: null },
    { type: "TAP", by: [1] },
    { type: "TAP", by: { nested: true } },
    { type: "TAP" },
    { type: "NOPE_NOPE" },
    { type: "tap" },
    { type: "" },
    null,
    42,
    "TAP",
    [1, 2],
    true,
  ]);

/** One hostile value for the options schema: JSON-shaped garbage around a sometimes-valid object. */
const randomOptionValue = (rng: () => number, depth: number): unknown => {
  if (depth >= 2) return pick(rng, [null, true, false, 0, -1.5, "true", "", "fast"]);
  return pick(rng, [
    null,
    true,
    false,
    Math.floor(rng() * 21) - 10,
    rng(),
    Number.MAX_SAFE_INTEGER,
    "true",
    "fast",
    "",
    {},
    { fast: randomOptionValue(rng, depth + 1) },
    { other: randomOptionValue(rng, depth + 1) },
    Array.from({ length: Math.floor(rng() * 3) }, () => randomOptionValue(rng, depth + 1)),
  ]);
};

/** A recorded session: the construction-time Lobby enter, a manual start and the Tap enter. */
const baseLog = (): ActionLog => ({
  header: {
    game: "Fuzz",
    version: "1",
    protocolVersion: PROTOCOL_VERSION,
    seed: [10, 20, 30, 40],
    startedAt: 1_000_000,
  },
  roster: [
    { id: "alpha-player-1", isConnected: true, isReady: true, isActive: true },
    { id: "alpha-player-2", isConnected: true, isReady: true, isActive: true },
  ],
  entries: [
    { seq: 1, t: 1_000_000, phase: "Lobby", kind: "enter" },
    {
      seq: 2,
      t: 1_000_100,
      phase: "Lobby",
      kind: "action",
      actionType: "START_GAME",
      senderId: "alpha-player-1",
      payload: {},
    },
    { seq: 3, t: 1_000_100, phase: "Lobby", kind: "transition", from: "Lobby", to: "Tap" },
    { seq: 4, t: 1_000_100, phase: "Tap", kind: "enter" },
  ],
});

/** Raw values that fail the log shape outright. */
const GARBAGE_LOGS: readonly unknown[] = [
  null,
  42,
  "log",
  [{}],
  {},
  { entries: "nope" },
  { header: null },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The plain-object views of the log that survive earlier corruptions. */
const viewsOf = (log: ActionLog): Record<string, unknown>[] => {
  const candidates: unknown[] = [log, log.header];
  if (Array.isArray(log.roster)) candidates.push(...log.roster);
  if (Array.isArray(log.entries)) candidates.push(...log.entries);
  const views: Record<string, unknown>[] = [];
  for (const candidate of candidates) {
    if (isRecord(candidate)) views.push(candidate);
  }
  return views;
};

/** Deletes one key, never producing an empty `entries` array or a transition missing its target. */
const deleteKey = (rng: () => number, log: ActionLog): void => {
  const target = pick(rng, viewsOf(log));
  let keys = Object.keys(target);
  // Deleting `to` from a transition would reach an unprefixed throw; corrupt another field instead.
  if (keys.includes("to")) keys = keys.filter((key) => key !== "to");
  delete target[pick(rng, keys)];
};

/** Sets one existing key to a value of the wrong type. */
const wrongType = (rng: () => number, log: ActionLog): void => {
  const target = pick(rng, viewsOf(log));
  const key = pick(rng, Object.keys(target));
  const current = target[key];
  target[key] = typeof current === "string" ? 42 : typeof current === "number" ? "soon" : null;
};

/** Adds an unknown key, which the strict log schema rejects. */
const unknownKey = (rng: () => number, log: ActionLog): void => {
  const target = pick(rng, viewsOf(log));
  target[`fuzz${Math.floor(rng() * 1000)}`] = true;
};

/** One hostile log: raw garbage, or the base log with 0 to 3 single-field corruptions. */
const randomLog = (rng: () => number): ActionLog => {
  if (rng() < 0.2) return pick(rng, GARBAGE_LOGS) as ActionLog;
  const log = JSON.parse(JSON.stringify(baseLog())) as ActionLog;
  const mutations = Math.floor(rng() * 4);
  for (let m = 0; m < mutations; ++m) {
    pick(rng, [deleteKey, wrongType, unknownKey])(rng, log);
  }
  return log;
};

describe("security fuzz", () => {
  it("dispatch never throws on hostile envelopes and leaves state untouched on rejection", () => {
    const rng = mulberry32(5001);
    const table = new TestTable({
      definition,
      state: newState(),
      options: { fast: false },
      players: 4,
      seed: 7,
    });
    expect(table.start()).toBeUndefined();
    const senders = ["p1", "p2", "p3", "p4", "ghost"];
    let rejections = 0;
    for (let i = 0; i < ITERATIONS; ++i) {
      const sender = pick(rng, senders);
      const raw = hostileEnvelope(rng);
      const before = JSON.stringify(table.state);
      // A throw here fails the test: dispatch must reject, not crash.
      const error = table.runtime.dispatch(sender, raw);
      if (error !== undefined) {
        ++rejections;
        expect(JSON.stringify(table.state)).toBe(before);
      }
    }
    expect(rejections).toBeGreaterThan(0);
  });

  it("the options schema never throws on hostile values and parses into a bootable room", () => {
    const rng = mulberry32(5002);
    let successes = 0;
    for (let i = 0; i < ITERATIONS; ++i) {
      const value = randomOptionValue(rng, 0);
      // safeParse must never throw on any input.
      const result = optionsSchema.safeParse(value);
      if (result.success) {
        ++successes;
        expect(result.data.fast).toBeTypeOf("boolean");
        const table = new TestTable({
          definition,
          state: newState(),
          options: result.data,
          players: 2,
        });
        expect(table.phase).toBe("Lobby");
      }
    }
    expect(successes).toBeGreaterThan(0);
  });

  it("replayLog throws only named errors on hostile logs", () => {
    const rng = mulberry32(5003);
    let threw = 0;
    let ok = 0;
    for (let i = 0; i < ITERATIONS; ++i) {
      const log = randomLog(rng);
      try {
        replayLog(definition, log, { state: newState(), options: { fast: false } });
        ++ok;
      } catch (cause) {
        ++threw;
        expect(cause).toBeInstanceOf(Error);
        expect((cause as Error).message).toMatch(/^replayLog:/);
      }
    }
    expect(threw).toBeGreaterThan(0);
    expect(ok).toBeGreaterThan(0);
  });
});
