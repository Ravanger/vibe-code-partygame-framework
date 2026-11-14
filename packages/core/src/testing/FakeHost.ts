import { ServerMessage } from "@partygame/shared";
import { ManualHost } from "../runtime/ManualHost.js";
import type { Logger, LogLevel, LogLine, RuntimeHost, TimerHandle } from "../runtime/types.js";
import { MAX_TIMER_FIRES_PER_ADVANCE, TimerLimitError } from "../timers.js";

/** A message `FakeHost` recorded as sent to one player. */
export interface Sent {
  playerId: string;
  type: string;
  payload: unknown;
}

/** A recording {@link RuntimeHost} with a manual clock, for driving the runtime in tests without a server. */
export class FakeHost extends ManualHost implements RuntimeHost {
  readonly sent: Sent[] = [];
  readonly broadcasts: Array<{ type: string; payload: unknown }> = [];
  activations = 0;
  readonly views: Array<{ op: "show" | "hide"; playerId: string; ref: object }> = [];
  readonly kicked: string[] = [];
  readonly published: unknown[] = [];
  readonly transitions: Array<{ from: string; to: string }> = [];
  /** Delivery lateness added to every timer, in ms — models a host clock that fires on a grid. 0 fires exactly on time. */
  timerLatenessMs = 0;
  /** Every line `ctx.log` wrote, in order. */
  readonly logs: LogLine[] = [];
  readonly log: Logger = {
    info: (event, fields) => this.record("info", event, fields),
    warn: (event, fields) => this.record("warn", event, fields),
    error: (event, fields) => this.record("error", event, fields),
  };
  /** Promotes the seat and demotes the current host (#36); delete it to simulate a host without `setHost`. */
  setHost?: (playerId: string) => void = (id) => {
    for (const seat of this.seats) {
      if (seat.id === id) seat.role = "host";
      else if (seat.role === "host") seat.role = "player";
    }
  };

  /** The number of timers scheduled and not yet fired or cleared. */
  get pendingTimers(): number {
    return this.queue.size;
  }

  /** The payloads of every `ERROR` message sent to `playerId`. */
  errorsTo(playerId: string): unknown[] {
    return this.sent
      .filter((s) => s.playerId === playerId && s.type === ServerMessage.ERROR)
      .map((s) => s.payload);
  }

  /** Advances the manual clock by `ms` milliseconds, firing every due timer in `(at, id)` order; one advance fires at most {@link MAX_TIMER_FIRES_PER_ADVANCE} timers, a larger jump throws {@link TimerLimitError}. */
  advance(ms: number): void {
    const target = this.time + ms;
    let fired = 0;
    for (;;) {
      const head = this.queue.peek();
      if (head === undefined || head.at > target) break;
      ++fired;
      if (fired > MAX_TIMER_FIRES_PER_ADVANCE) {
        throw new TimerLimitError(
          `FakeHost.advance would fire more than ${MAX_TIMER_FIRES_PER_ADVANCE} timers in one advance`,
        );
      }
      this.queue.shift();
      this.time = head.at;
      head.callback();
    }
    this.time = target;
  }

  activateWaitingPlayers(): void {
    super.activateWaitingPlayers();
    ++this.activations;
  }

  /** {@inheritDoc RuntimeHost.send} */
  send(playerId: string, type: string, payload: unknown): void {
    this.sent.push({ playerId, type, payload });
  }

  /** {@inheritDoc RuntimeHost.broadcast} */
  broadcast(type: string, payload: unknown): void {
    this.broadcasts.push({ type, payload });
  }

  notifyTransition(from: string, to: string): void {
    this.transitions.push({ from, to });
    super.notifyTransition(from, to);
  }

  /** {@inheritDoc RuntimeHost.showTo} */
  showTo(playerId: string, ref: object): void {
    this.views.push({ op: "show", playerId, ref });
  }

  /** {@inheritDoc RuntimeHost.hideFrom} */
  hideFrom(playerId: string, ref: object): void {
    this.views.push({ op: "hide", playerId, ref });
  }

  kick(playerId: string): void {
    this.kicked.push(playerId);
    super.kick(playerId);
  }

  publishOptions(options: unknown): void {
    this.published.push(options);
  }

  /** {@inheritDoc RuntimeHost.setTimeout} */
  setTimeout(callback: () => void, ms: number): TimerHandle {
    return super.setTimeout(callback, ms + this.timerLatenessMs);
  }

  private record(level: LogLevel, event: string, fields?: LogLine["fields"]): void {
    this.logs.push({ level, event, ...(fields !== undefined ? { fields } : {}) });
  }
}
