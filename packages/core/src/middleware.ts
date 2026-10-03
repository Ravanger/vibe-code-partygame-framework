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
