import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  type ActionLog,
  ActionLogSchema,
  actionFactory,
  actionLogMiddleware,
  defineGame,
  getActionLog,
  type PhaseState,
} from "../src/index.js";
import { TestTable } from "../src/testing/TestTable.js";

interface S extends PhaseState {
  taps: number;
}

const action = actionFactory<S, Record<string, never>, Record<string, never>>();

const definition = defineGame<S, Record<string, never>, Record<string, never>>({
  name: "SchemaTap",
  version: "1",
  minPlayers: 1,
  maxPlayers: 4,
  startPhase: "Tap",
  createPrivateState: () => ({}),
  phases: {
    Tap: {
      duration: 1000,
      onTimeout: (ctx) => ctx.transition("Done"),
      actions: {
        TAP: action({
          from: "player",
          payload: z.object({}),
          handler: (ctx) => {
            ctx.state.taps += 1;
          },
        }),
      },
    },
    Done: {},
  },
});

const newState = (): S => ({ phase: "", phaseEndsAt: 0, canStart: false, taps: 0 });

/** One full session with the log middleware: construction enter, START_GAME, a TAP, the timeout. */
function liveLog(): ActionLog {
  const table = new TestTable({
    definition: { ...definition, middleware: [actionLogMiddleware()] },
    state: newState(),
    options: {},
    players: 2,
  });
  table.start();
  table.act("p2", "TAP");
  table.tick(1000);
  return getActionLog(table.priv) as ActionLog;
}

/** A JSON round-trip of a live log, kept untyped: the schema takes unknown, and corrupting a field needs a value a typed log would refuse. */
const raw = (): unknown => JSON.parse(JSON.stringify(liveLog()));

const withHeader = (log: unknown, patch: Record<string, unknown>): unknown => ({
  ...(log as object),
  header: { ...((log as { header?: object }).header ?? {}), ...patch },
});

const withRoster = (log: unknown, roster: unknown): unknown => ({ ...(log as object), roster });

const replaceEntryAt = (log: unknown, index: number, entry: unknown): unknown => {
  const entries = [...((log as { entries?: unknown[] }).entries ?? [])];
  entries[index] = entry;
  return { ...(log as object), entries };
};

/** Spreads `patch` over the entry at `index` (a field override, not a replacement). */
const patchEntryAt = (log: unknown, index: number, patch: Record<string, unknown>): unknown => {
  const entries = [...((log as { entries?: unknown[] }).entries ?? [])];
  entries[index] = { ...(entries[index] as object), ...patch };
  return { ...(log as object), entries };
};

/**
 * Normalizes zod's inference artifacts so schema and interface compare on shape: drops readonly
 * (zod infers a mutable seed tuple) and makes optionals required. `NonNullable` is part of that:
 * under `exactOptionalPropertyTypes`, stripping the optional marker removes only the implicit
 * `undefined`, so an explicit one (zod's inference) must be removed too for both sides to meet.
 */
type Normalize<T> = T extends readonly unknown[]
  ? { -readonly [K in keyof T]: Normalize<T[K]> }
  : T extends object
    ? { [K in keyof T]-?: Normalize<NonNullable<T[K]>> }
    : T;

/** Strict bidirectional identity: true only when the two types are identical. */
type Equals<A, B> =
  (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2 ? true : false;

/** Compile-time guard: a field added, removed or re-typed on either side breaks this line. */
const SCHEMA_MATCHES_INTERFACE: Equals<
  Normalize<z.infer<typeof ActionLogSchema>>,
  Normalize<ActionLog>
> = true;

describe("ActionLogSchema accepts", () => {
  it("a middleware-produced log, round-tripped through JSON", () => {
    const parsed = ActionLogSchema.safeParse(raw());
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual(liveLog());
  });

  it("a log without header.version (recorded before versioning)", () => {
    const log = raw();
    const header = { ...((log as { header?: object }).header ?? {}) };
    delete (header as Record<string, unknown>).version;
    const parsed = ActionLogSchema.safeParse({ ...(log as object), header });
    expect(parsed.success).toBe(true);
  });

  it("a log without header.protocolVersion (recorded before protocol versioning)", () => {
    // The schema stays permissive like `version`: the refusal, naming the expected version, is replay's job.
    const log = raw();
    const header = { ...((log as { header?: object }).header ?? {}) };
    delete (header as Record<string, unknown>).protocolVersion;
    const parsed = ActionLogSchema.safeParse({ ...(log as object), header });
    expect(parsed.success).toBe(true);
  });

  it("a lobby-only log without a roster", () => {
    const table = new TestTable({
      definition: { ...definition, middleware: [actionLogMiddleware()] },
      state: newState(),
      options: {},
      players: 2,
    });
    const log = getActionLog(table.priv) as ActionLog;
    expect(log.roster).toBeUndefined();
    expect(ActionLogSchema.safeParse(JSON.parse(JSON.stringify(log))).success).toBe(true);
  });

  it("keeps the schema shape-identical to the ActionLog interface", () => {
    // The real check is at compile time (SCHEMA_MATCHES_INTERFACE); this pins its value.
    expect(SCHEMA_MATCHES_INTERFACE).toBe(true);
  });
});

describe("ActionLogSchema rejects", () => {
  it("a log whose entries are missing or not an array", () => {
    const log = raw();
    expect(
      ActionLogSchema.safeParse({ header: (log as { header?: unknown }).header }).success,
    ).toBe(false);
    expect(ActionLogSchema.safeParse({ ...(log as object), entries: "nope" }).success).toBe(false);
  });

  it("a log whose header is missing or null", () => {
    const log = raw();
    const noHeader = { ...(log as object) };
    delete (noHeader as Record<string, unknown>).header;
    expect(ActionLogSchema.safeParse(noHeader).success).toBe(false);
    expect(ActionLogSchema.safeParse({ ...(log as object), header: null }).success).toBe(false);
  });

  it("a header missing or mistyping its fields", () => {
    const log = raw();
    for (const patch of [
      { game: 42 },
      { seed: "x" },
      { seed: [1, 2, 3] },
      { startedAt: "x" },
      { version: 42 },
    ]) {
      expect(ActionLogSchema.safeParse(withHeader(log, patch)).success).toBe(false);
    }
  });

  it("a roster that is not an array", () => {
    expect(ActionLogSchema.safeParse(withRoster(raw(), "nope")).success).toBe(false);
  });

  it("a malformed roster seat", () => {
    const log = raw();
    for (const roster of [
      null,
      42,
      [{ id: "aaaa-1" }],
      [{ id: 7, isConnected: true, isReady: true, isActive: true }],
    ]) {
      expect(ActionLogSchema.safeParse(withRoster(log, roster)).success).toBe(false);
    }
  });

  it("an entry that is not an object", () => {
    const log = raw();
    expect(ActionLogSchema.safeParse(replaceEntryAt(log, 1, null)).success).toBe(false);
    expect(ActionLogSchema.safeParse(replaceEntryAt(log, 1, "nope")).success).toBe(false);
  });

  it("an entry without a known kind", () => {
    const log = raw();
    expect(ActionLogSchema.safeParse(replaceEntryAt(log, 3, {})).success).toBe(false);
    expect(ActionLogSchema.safeParse(patchEntryAt(log, 1, { kind: "teleport" })).success).toBe(
      false,
    );
  });

  it("an entry with a non-numeric t or seq or a non-string phase", () => {
    const log = raw();
    expect(ActionLogSchema.safeParse(patchEntryAt(log, 1, { t: "100" })).success).toBe(false);
    expect(ActionLogSchema.safeParse(patchEntryAt(log, 1, { seq: "second" })).success).toBe(false);
    expect(ActionLogSchema.safeParse(patchEntryAt(log, 1, { phase: 42 })).success).toBe(false);
  });

  it("unknown fields (strict objects)", () => {
    const log = raw();
    expect(ActionLogSchema.safeParse({ ...(log as object), extra: true }).success).toBe(false);
    expect(ActionLogSchema.safeParse(withHeader(log, { surprise: 1 })).success).toBe(false);
    expect(ActionLogSchema.safeParse(patchEntryAt(log, 1, { bonus: 2 })).success).toBe(false);
  });
});
