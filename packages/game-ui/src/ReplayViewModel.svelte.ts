import { type BaseGameState, syncedStateFromJson } from "@partygame/shared/schema";

/** One recorded phase boundary of a replay bundle: the synced state when `phase` ended. */
export interface ReplaySnapshot {
  /** Sequence number of the log transition entry this snapshot belongs to. */
  seq: number;
  /** The phase being left — the final state of that phase. */
  phase: string;
  /** Synced state at that moment, as plain JSON. */
  state: Record<string, unknown>;
}

/** Timer used for auto-advance; inject a fake in tests. */
export interface ReplayTimer {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
}

/** Options for {@link ReplayViewModel}. */
export interface ReplayViewModelOptions {
  /** Auto-advance cadence in milliseconds (default 1000). */
  intervalMs?: number;
  /** Timer implementation (default: the global one). */
  timer?: ReplayTimer;
}

/** A read-only stand-in for a connection manager that renders one replay snapshot. */
export interface SnapshotManager<TState extends BaseGameState> {
  /** Always true: a replay viewer never owns a seat. */
  readonly isSpectator: true;
  /** A fresh state instance filled from the viewmodel's current snapshot (empty when none). */
  readonly state: TState;
}

/** Bundle format version this viewer understands; must match `BUNDLE_VERSION` in @partygame/core/replay. */
const SUPPORTED_BUNDLE_VERSION = 1;
const DEFAULT_INTERVAL_MS = 1000;

const defaultTimer: ReplayTimer = {
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (id) => clearInterval(id as number),
};

// The mutable position lives in a closure instead of class fields: Stryker wraps constructor
// statements in if/else, so `$state` cannot be assigned in the constructor, and a `$state` class
// field initializer leaves phantom uncovered items when v8 merges per-project maps (see
// docs/framework/troubleshooting.md).
function createPosition() {
  let index = $state(0);
  let playing = $state(false);
  return {
    get index(): number {
      return index;
    },
    set index(next: number) {
      index = next;
    },
    get playing(): boolean {
      return playing;
    },
    set playing(next: boolean) {
      playing = next;
    },
  };
}

type Loaded = { snapshots: ReplaySnapshot[]; error: null } | { snapshots: []; error: string };

function loadSnapshots(text: string): Loaded {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail("not valid JSON");
  }
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    return fail("not a replay bundle");
  }
  const bundleJson = json as Record<string, unknown>;
  if (bundleJson.bundleVersion !== SUPPORTED_BUNDLE_VERSION) {
    return fail(`unsupported bundle version ${String(bundleJson.bundleVersion)}`);
  }
  if (!Array.isArray(bundleJson.snapshots)) return fail("missing snapshots");
  for (const entry of bundleJson.snapshots) {
    if (!isSnapshot(entry)) return fail("malformed snapshot");
  }
  return { snapshots: bundleJson.snapshots, error: null };
}

function isSnapshot(entry: unknown): boolean {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return false;
  const snap = entry as Record<string, unknown>;
  return (
    typeof snap.seq === "number" &&
    typeof snap.phase === "string" &&
    snap.state !== null &&
    typeof snap.state === "object" &&
    !Array.isArray(snap.state)
  );
}

function fail(message: string): Loaded {
  return { snapshots: [], error: message };
}

/**
 * Steps through the snapshots of a replay bundle file as a read-only spectator — no game runtime,
 * no server connection. The constructor parses and structurally validates the bundle text; an
 * invalid or wrong-version file sets {@link ReplayViewModel.error} and leaves no snapshots.
 */
export class ReplayViewModel {
  /** Error from loading the bundle text; `null` when the bundle is valid. */
  readonly error: string | null;

  private readonly position = createPosition();
  private readonly list: readonly ReplaySnapshot[];
  private readonly timer: ReplayTimer;
  private readonly intervalMs: number;
  private handle: unknown = null;

  constructor(text: string, options: ReplayViewModelOptions = {}) {
    this.timer = options.timer ?? defaultTimer;
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    const loaded = loadSnapshots(text);
    this.error = loaded.error;
    this.list = loaded.snapshots;
  }

  /** Snapshots of the loaded bundle, in log order; empty when the file was invalid. */
  get snapshots(): readonly ReplaySnapshot[] {
    return this.list;
  }

  /** Index of the snapshot being viewed. */
  get index(): number {
    return this.position.index;
  }

  /** Synced state of the snapshot at `index`; `null` when no bundle loaded. */
  get current(): Record<string, unknown> | null {
    const snap = this.list[this.index];
    return snap === undefined ? null : snap.state;
  }

  /** Phase recorded for the snapshot at `index`; empty string when no bundle loaded. */
  get phase(): string {
    const snap = this.list[this.index];
    return snap === undefined ? "" : snap.phase;
  }

  /** Step to the next snapshot (clamped at the end). */
  next(): void {
    this.goTo(this.index + 1);
  }

  /** Step to the previous snapshot (clamped at the start). */
  previous(): void {
    this.goTo(this.index - 1);
  }

  /** Jump to snapshot `i`, clamped to the bundle's range; a no-op without a bundle. */
  goTo(i: number): void {
    const last = this.list.length - 1;
    if (last < 0) return;
    this.position.index = Math.min(Math.max(i, 0), last);
  }

  /** Whether auto-advance is running. */
  get isPlaying(): boolean {
    return this.position.playing;
  }

  /** Start auto-advancing every `intervalMs`; a no-op when already playing or at the end. */
  play(): void {
    if (this.isPlaying || this.index >= this.list.length - 1) return;
    this.position.playing = true;
    this.handle = this.timer.setInterval(() => this.tick(), this.intervalMs);
  }

  /** Stop auto-advancing. */
  pause(): void {
    if (!this.isPlaying) return;
    this.timer.clearInterval(this.handle);
    this.handle = null;
    this.position.playing = false;
  }

  private tick(): void {
    this.next();
    if (this.index >= this.list.length - 1) this.pause();
  }
}

/**
 * Adapts a {@link ReplayViewModel} to the shape screens read from a `GameConnectionManager`, so a
 * game's existing screens can render a snapshot read-only. Limits: snapshots hold synced state
 * only (never private or per-client data), and the bundle must come from this framework's exporter
 * — the adapter fills whatever is there as-is.
 */
export function snapshotManager<TState extends BaseGameState>(
  viewModel: ReplayViewModel,
  stateClass: new () => TState,
): SnapshotManager<TState> {
  return {
    isSpectator: true,
    get state(): TState {
      const current = viewModel.current;
      if (current === null) return new stateClass();
      return syncedStateFromJson(stateClass, current);
    },
  };
}
