import type { TextFilter } from "@partygame/content/filter";
import { ErrorCode } from "@partygame/shared";
import {
  InvalidPrivateStateError,
  type MiddlewareContext,
  type PhaseMiddleware,
  type PhaseState,
} from "./runtime/index.js";

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

/** One phase's timing record, stored by {@link timingMiddleware} outside `priv`. */
export interface PhaseTimingRecord {
  /** Epoch ms when the phase was most recently entered. */
  enteredAt: number;
  /** Completed durations in ms, oldest first. The currently open entry is not included. */
  durationsMs: number[];
}

/** One timing store per `ctx.priv` object; the priv itself never gains a framework key. */
const timings = new WeakMap<object, Record<string, PhaseTimingRecord>>();

/**
 * Reads the phase-timing store recorded for a runtime's private state. Returns the stored object
 * itself — a stable reference across calls — or `undefined` when no phase has been entered yet
 * (or the priv is not an object).
 */
export function getPhaseTimings(priv: unknown): Record<string, PhaseTimingRecord> | undefined {
  if (typeof priv !== "object" || priv === null) return undefined;
  return timings.get(priv);
}

function timingsOf(
  ctx: MiddlewareContext<PhaseState, unknown, unknown>,
): Record<string, PhaseTimingRecord> {
  const priv = ctx.priv;
  if (typeof priv !== "object" || priv === null) throw new InvalidPrivateStateError();
  let store = timings.get(priv);
  if (store === undefined) {
    store = {};
    timings.set(priv, store);
  }
  return store;
}

/**
 * Records how long each phase stays open into a store kept outside `ctx.priv` (keyed by it; read
 * back with `getPhaseTimings`). Started on enter (before the hook runs), closed when a transition
 * out of the phase is observed. Never touches `ctx.state`; timing metadata stays server-side. The
 * currently open phase has no final duration yet.
 */
export function timingMiddleware(): PhaseMiddleware<PhaseState, unknown, unknown> {
  return (ctx, next) => {
    const event = ctx.event;
    if (event.kind === "enter") {
      const store = timingsOf(ctx);
      const existing = store[ctx.phase];
      store[ctx.phase] = { enteredAt: ctx.now(), durationsMs: existing?.durationsMs ?? [] };
    } else if (event.kind === "transition") {
      const record = timingsOf(ctx)[event.from];
      if (record !== undefined) {
        record.durationsMs.push(ctx.now() - record.enteredAt);
      }
    }
    next();
  };
}

/**
 * Rejects actions whose declared text fields fail the room's filter level. For an `action` event
 * with `textFields`, runs `filter.check(value, level)` on each named string field of the payload in
 * declaration order and, on the first failure, rejects with `CONTENT_REJECTED` and the filter's
 * reason, skipping the rest of the chain (the handler never runs). Actions without `textFields`,
 * declared fields that are not strings, and a level of `"off"` (the default) pass untouched; at
 * `"off"` the filter is never called.
 */
export function textFilterMiddleware(
  filter: TextFilter,
): PhaseMiddleware<PhaseState, unknown, unknown> {
  return (ctx, next) => {
    const event = ctx.event;
    if (event.kind === "action" && event.filterLevel !== "off") {
      for (const field of event.textFields ?? []) {
        const value = (event.payload as Record<string, unknown>)[field];
        if (typeof value !== "string") continue;
        const result = filter.check(value, event.filterLevel);
        if (!result.ok) {
          ctx.reject(ErrorCode.CONTENT_REJECTED, result.reason);
          return;
        }
      }
    }
    next();
  };
}
