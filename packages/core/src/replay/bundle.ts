import { z } from "zod";
import { type ActionLog, ActionLogSchema } from "../actionLog.js";

/** The bundle format version this framework reads and writes; bump when the shape changes. */
const BUNDLE_VERSION = 1;

/** One synced-state snapshot taken at a logged moment. */
export interface ReplaySnapshot {
  /** The seq of the log entry (a `transition` or `enter`) at which this snapshot was taken. */
  seq: number;
  /** The phase this snapshot shows. */
  phase: string;
  /** The synced state at that moment, as opaque JSON — never private state. */
  state: unknown;
}

/**
 * A shareable replay: the action log plus the versions and content hash needed to interpret it,
 * and per-phase synced-state snapshots for viewing without re-running the runtime. Synced state
 * only — a bundle must never carry `ctx.priv` or `.view()` fields.
 */
export interface ReplayBundle {
  /** The bundle format version; {@link parseBundle} rejects anything but the current one. */
  bundleVersion: typeof BUNDLE_VERSION;
  /** The game name; must equal `log.header.game`. */
  name: string;
  /** The framework version that produced the log. */
  frameworkVersion: string;
  /** The game version; must equal `log.header.version`. */
  gameVersion: string;
  /** A game-supplied hash of the content the session used. */
  contentHash: string;
  /** The recorded session. */
  log: ActionLog;
  /** Synced-state snapshots, in strictly increasing `seq` order. */
  snapshots: ReplaySnapshot[];
}

/** The parts {@link createBundle} takes; it stamps the current `bundleVersion`. */
export type ReplayBundleParts = Omit<ReplayBundle, "bundleVersion">;

const ReplaySnapshotSchema = z.strictObject({
  seq: z.number(),
  phase: z.string(),
  state: z.json(),
});

/** The wire shape of a {@link ReplayBundle}: strict objects, so unknown fields are rejected. */
export const ReplayBundleSchema = z.strictObject({
  bundleVersion: z.literal(BUNDLE_VERSION),
  name: z.string(),
  frameworkVersion: z.string(),
  gameVersion: z.string(),
  contentHash: z.string(),
  log: ActionLogSchema,
  snapshots: z.array(ReplaySnapshotSchema),
});

/** Builds a bundle at the current format version. */
export function createBundle(parts: ReplayBundleParts): ReplayBundle {
  return { bundleVersion: BUNDLE_VERSION, ...parts };
}

/**
 * Parses untrusted bundle JSON. Throws a named error for an unknown `bundleVersion` (the common
 * "written by a newer framework" case) and for anything else that fails {@link ReplayBundleSchema};
 * the zod error is attached as `cause`, never surfaced as raw text.
 */
export function parseBundle(json: unknown): ReplayBundle {
  if (typeof json === "object" && json !== null && "bundleVersion" in json) {
    const version = (json as { bundleVersion: unknown }).bundleVersion;
    if (version !== BUNDLE_VERSION) {
      throw new Error(
        `parseBundle: unknown bundle version ${JSON.stringify(version)}; only version ${BUNDLE_VERSION} is supported`,
      );
    }
  }
  const parsed = ReplayBundleSchema.safeParse(json);
  if (!parsed.success)
    throw new Error("parseBundle: malformed replay bundle", { cause: parsed.error });
  // The schema output differs from ReplayBundle only in zod's inference artifacts (a mutable seed
  // tuple, explicit-undefined optionals), so one assertion is enough.
  return parsed.data as ReplayBundle;
}

/** Recursively sorts object keys; arrays keep their order. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = canonicalize(source[key]);
    return out;
  }
  return value;
}

/** The sha-256 hex digest of the bundle's canonical JSON (sorted keys); stable across key order. */
export async function hashBundle(bundle: ReplayBundle): Promise<string> {
  const canonical = JSON.stringify(canonicalize(bundle));
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The outcome of {@link verifyBundle}: success, or the first bad part with a reason. */
export type VerifyBundleResult =
  | { ok: true }
  | { ok: false; seq: number; phase: string; reason: string };

/**
 * Checks a bundle's internal consistency without re-running the runtime (the browser has none):
 * the log header must match the bundle's `name`/`gameVersion`, and every snapshot must name a
 * `transition` or `enter` entry in the log, with strictly increasing `seq`s. Returns `{ ok: true }`
 * or the first failure — non-snapshot failures report `seq: 0` and an empty phase.
 */
export function verifyBundle(bundle: ReplayBundle): VerifyBundleResult {
  const { log, snapshots, name, gameVersion } = bundle;
  if (log.header.game !== name) {
    return {
      ok: false,
      seq: 0,
      phase: "",
      reason: `log header game "${log.header.game}" does not match the bundle name "${name}"`,
    };
  }
  if (log.header.version !== gameVersion) {
    return {
      ok: false,
      seq: 0,
      phase: "",
      reason: `log header version "${log.header.version}" does not match the bundle gameVersion "${gameVersion}"`,
    };
  }
  const stepSeqs = new Set<number>();
  for (const entry of log.entries) {
    if (entry.kind === "transition" || entry.kind === "enter") stepSeqs.add(entry.seq);
  }
  let previous: number | undefined;
  for (const snapshot of snapshots) {
    if (previous !== undefined && snapshot.seq <= previous) {
      return {
        ok: false,
        seq: snapshot.seq,
        phase: snapshot.phase,
        reason: `snapshot seqs must be strictly increasing (got ${snapshot.seq} after ${previous})`,
      };
    }
    if (!stepSeqs.has(snapshot.seq)) {
      return {
        ok: false,
        seq: snapshot.seq,
        phase: snapshot.phase,
        reason: `no transition or enter log entry with seq ${snapshot.seq}`,
      };
    }
    previous = snapshot.seq;
  }
  return { ok: true };
}
