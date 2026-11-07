import { describe, expect, it } from "vitest";
import {
  type ActionLog,
  actionLogMiddleware,
  defineGame,
  getActionLog,
  type PhaseState,
  required,
} from "../../src/index.js";
import {
  createBundle,
  hashBundle,
  parseBundle,
  type ReplayBundle,
  ReplayBundleSchema,
  verifyBundle,
} from "../../src/replay/index.js";
import { TestTable } from "../../src/testing/TestTable.js";

const definition = defineGame<PhaseState, Record<string, never>, Record<string, never>>({
  name: "BundleTap",
  version: "7",
  minPlayers: 1,
  maxPlayers: 4,
  startPhase: "Tap",
  createPrivateState: () => ({}),
  phases: {
    Tap: {
      duration: 1000,
      onTimeout: (ctx) => ctx.transition("Done"),
    },
    Done: {},
  },
});

const newState = (): PhaseState => ({ phase: "", phaseEndsAt: 0, canStart: false });

/** A deterministic live session: Lobby enter, START_GAME, Tap enter, timeout, Done enter. */
function liveBundle(): ReplayBundle {
  const table = new TestTable({
    definition: { ...definition, middleware: [actionLogMiddleware()] },
    state: newState(),
    options: {},
    players: 2,
  });
  table.start();
  table.tick(1000);
  const log = getActionLog(table.priv) as ActionLog;
  const enterSeq = (phase: string): number =>
    required(
      log.entries.find((entry) => entry.kind === "enter" && entry.phase === phase),
      `enter ${phase}`,
    ).seq;
  return createBundle({
    name: definition.name,
    frameworkVersion: "0.1.0",
    gameVersion: definition.version,
    contentHash: "abc123",
    log,
    snapshots: [
      { seq: enterSeq("Lobby"), phase: "Lobby", state: { taps: 0 } },
      {
        seq: enterSeq("Tap"),
        phase: "Tap",
        state: { taps: 3, players: ["p1", "p2"], meta: { deep: [true, 0, "x"] } },
      },
      { seq: enterSeq("Done"), phase: "Done", state: null },
    ],
  });
}

describe("ReplayBundleSchema", () => {
  it("round-trips a bundle built from a real action log", () => {
    const bundle = liveBundle();
    expect(ReplayBundleSchema.safeParse(bundle).success).toBe(true);
    expect(parseBundle(JSON.parse(JSON.stringify(bundle)))).toEqual(bundle);
  });

  it("keeps snapshots opaque: any JSON-shaped state parses", () => {
    const bundle = liveBundle();
    const weird = {
      ...bundle,
      snapshots: [
        { seq: 1, phase: "Lobby", state: { surprise: [1, { deep: null }], off: "shape" } },
      ],
    };
    expect(ReplayBundleSchema.safeParse(weird).success).toBe(true);
  });

  it("rejects unknown fields (strict objects)", () => {
    const bundle = liveBundle();
    expect(ReplayBundleSchema.safeParse({ ...bundle, extra: true }).success).toBe(false);
    expect(
      ReplayBundleSchema.safeParse({
        ...bundle,
        snapshots: [{ seq: 1, phase: "Lobby", state: {}, bonus: 1 }],
      }).success,
    ).toBe(false);
  });
});

describe("hashBundle", () => {
  it("is deterministic and returns sha-256 hex", async () => {
    const bundle = liveBundle();
    const first = await hashBundle(bundle);
    expect(await hashBundle(bundle)).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when any part of the bundle changes", async () => {
    const bundle = liveBundle();
    const base = await hashBundle(bundle);

    const tamperedLog = JSON.parse(JSON.stringify(bundle)) as ReplayBundle;
    required(tamperedLog.log.entries[1], "log entry").t += 5;
    expect(await hashBundle(tamperedLog)).not.toBe(base);

    expect(await hashBundle({ ...bundle, gameVersion: "99" })).not.toBe(base);
    expect(await hashBundle({ ...bundle, frameworkVersion: "0.2.0" })).not.toBe(base);
    expect(await hashBundle({ ...bundle, contentHash: "deadbeef" })).not.toBe(base);

    const snapshots = [...bundle.snapshots];
    required(snapshots[1], "snapshot").state = { taps: 99 };
    expect(await hashBundle({ ...bundle, snapshots })).not.toBe(base);
  });

  it("ignores object key order (canonical JSON)", async () => {
    const bundle = liveBundle();
    const { log, ...withoutLog } = bundle;
    const reordered = { ...withoutLog, log };
    expect(await hashBundle(reordered)).toBe(await hashBundle(bundle));
  });

  it("keeps an own __proto__ key in the canonical form", async () => {
    const bundle = liveBundle();
    const plain = JSON.parse('{"taps": 3}') as Record<string, unknown>;
    const objectProto = JSON.parse('{"taps": 3, "__proto__": {"evil": true}}') as Record<
      string,
      unknown
    >;
    const primitiveProto = JSON.parse('{"taps": 3, "__proto__": "x"}') as Record<string, unknown>;
    // Sanity: JSON.parse carries __proto__ as an own data key, not a prototype assignment.
    expect(Object.hasOwn(objectProto, "__proto__")).toBe(true);
    expect(Object.hasOwn(primitiveProto, "__proto__")).toBe(true);

    const withPlain = [...bundle.snapshots];
    required(withPlain[1], "snapshot").state = plain;
    const base = await hashBundle({ ...bundle, snapshots: withPlain });

    const withObject = [...bundle.snapshots];
    required(withObject[1], "snapshot").state = objectProto;
    expect(await hashBundle({ ...bundle, snapshots: withObject })).not.toBe(base);

    const withPrimitive = [...bundle.snapshots];
    required(withPrimitive[1], "snapshot").state = primitiveProto;
    expect(await hashBundle({ ...bundle, snapshots: withPrimitive })).not.toBe(base);
  });
});

describe("parseBundle", () => {
  it("rejects an unknown bundle version with a clear error", () => {
    const bundle = liveBundle();
    expect(() => parseBundle({ ...bundle, bundleVersion: 2 })).toThrow(
      "parseBundle: unknown bundle version 2",
    );
    expect(() => parseBundle({ ...bundle, bundleVersion: "one" })).toThrow(
      'parseBundle: unknown bundle version "one"',
    );
  });

  it("rejects malformed input with a named error, never a raw TypeError", () => {
    for (const bad of ["nope", null, {}]) {
      expect(() => parseBundle(bad)).toThrow("parseBundle: malformed replay bundle");
    }
  });
});

describe("verifyBundle", () => {
  it("accepts a valid bundle", () => {
    expect(verifyBundle(liveBundle())).toEqual({ ok: true });
  });

  it("fails when the log header does not match the bundle", () => {
    const bundle = liveBundle();
    expect(verifyBundle({ ...bundle, name: "other" })).toEqual({
      ok: false,
      seq: 0,
      phase: "",
      reason: expect.stringContaining("does not match"),
    });
    expect(verifyBundle({ ...bundle, gameVersion: "99" })).toEqual({
      ok: false,
      seq: 0,
      phase: "",
      reason: expect.stringContaining("does not match"),
    });
  });

  it("fails a snapshot that names no transition or enter entry, naming its phase", () => {
    const bundle = liveBundle();
    const actionSeq = required(
      bundle.log.entries.find((entry) => entry.kind === "action"),
      "action entry",
    ).seq;
    expect(
      verifyBundle({ ...bundle, snapshots: [{ seq: 999, phase: "Ghost", state: {} }] }),
    ).toEqual({
      ok: false,
      seq: 999,
      phase: "Ghost",
      reason: expect.stringContaining("seq 999"),
    });
    expect(
      verifyBundle({ ...bundle, snapshots: [{ seq: actionSeq, phase: "Tap", state: {} }] }),
    ).toEqual({
      ok: false,
      seq: actionSeq,
      phase: "Tap",
      reason: expect.stringContaining(`seq ${actionSeq}`),
    });
  });

  it("fails snapshot seqs that are not strictly increasing", () => {
    const bundle = liveBundle();
    const first = required(bundle.snapshots[0], "snapshot");
    const second = required(bundle.snapshots[1], "snapshot");
    expect(verifyBundle({ ...bundle, snapshots: [first, { ...second, seq: first.seq }] })).toEqual({
      ok: false,
      seq: first.seq,
      phase: second.phase,
      reason: expect.stringContaining("strictly increasing"),
    });
    expect(verifyBundle({ ...bundle, snapshots: [second, first] })).toEqual({
      ok: false,
      seq: first.seq,
      phase: first.phase,
      reason: expect.stringContaining("strictly increasing"),
    });
  });

  it("accepts a bundle with no snapshots", () => {
    const bundle = liveBundle();
    expect(verifyBundle({ ...bundle, snapshots: [] })).toEqual({ ok: true });
  });
});
