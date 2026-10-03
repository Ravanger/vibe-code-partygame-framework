import type { PhaseMiddleware, PhaseState } from "./runtime/index.js";

/** Options for {@link loggingMiddleware}. */
export interface LoggingMiddlewareOptions {
  /** Receives one line per logged event. The middleware itself never touches the console. */
  log(line: string): void;
}

/**
 * Logs phase lifecycle events and actions, one line each: `enter <phase>`,
 * `timeout <phase>`, `action <ACTION_TYPE> by <senderId> in <phase>`,
 * `transition <from> -> <to>`. No line is emitted for roster changes.
 */
export function loggingMiddleware(
  options: LoggingMiddlewareOptions,
): PhaseMiddleware<PhaseState, unknown, unknown> {
  return (ctx, next) => {
    const event = ctx.event;
    switch (event.kind) {
      case "enter":
        options.log(`enter ${ctx.phase}`);
        break;
      case "timeout":
        options.log(`timeout ${ctx.phase}`);
        break;
      case "action":
        options.log(`action ${event.actionType} by ${event.senderId} in ${ctx.phase}`);
        break;
      case "transition":
        options.log(`transition ${event.from} -> ${event.to}`);
        break;
      case "roster-change":
        break;
    }
    next();
  };
}

/** The key under which {@link timingMiddleware} stores its record in `ctx.priv`. */
export const PHASE_TIMINGS = "phaseTimings" as const;

/** One phase's timing record, stored by {@link timingMiddleware} at `priv[PHASE_TIMINGS]`. */
export interface PhaseTimingRecord {
  /** Epoch ms when the phase was most recently entered. */
  enteredAt: number;
  /** Completed durations in ms, oldest first. The currently open entry is not included. */
  durationsMs: number[];
}

function timingsOf(priv: unknown): Record<string, PhaseTimingRecord> {
  // PHASE_TIMINGS is added at runtime; it is not part of the game's declared private state.
  const record = priv as Record<string, unknown>;
  let store = record[PHASE_TIMINGS];
  if (store === undefined) {
    store = {};
    record[PHASE_TIMINGS] = store;
  }
  return store as Record<string, PhaseTimingRecord>;
}

/**
 * Records how long each phase stays open into `ctx.priv[PHASE_TIMINGS]`. Started on enter
 * (before the hook runs), closed when a transition out of the phase is observed. Never
 * touches `ctx.state`; timing metadata stays server-side. The currently open phase has no
 * final duration yet.
 */
export function timingMiddleware(): PhaseMiddleware<PhaseState, unknown, unknown> {
  return (ctx, next) => {
    const event = ctx.event;
    if (event.kind === "enter") {
      const store = timingsOf(ctx.priv);
      const existing = store[ctx.phase];
      store[ctx.phase] = { enteredAt: ctx.now(), durationsMs: existing?.durationsMs ?? [] };
    } else if (event.kind === "transition") {
      const record = timingsOf(ctx.priv)[event.from];
      if (record !== undefined) {
        record.durationsMs.push(ctx.now() - record.enteredAt);
      }
    }
    next();
  };
}
