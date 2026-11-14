import { ManualHost } from "../runtime/ManualHost.js";
import type { RuntimeHost } from "../runtime/types.js";
import {
  MAX_TIMER_FIRES_PER_ADVANCE,
  MAX_TIMER_FIRES_PER_REPLAY,
  TimerLimitError,
} from "../timers.js";

/**
 * A minimal {@link RuntimeHost} for replaying a recorded session: a manual clock, seats and the
 * given seed — no recording or assertion helpers, because a replay observes state snapshots, not
 * messages. Client traffic (send, broadcast, views) is dropped; `kick` only removes the seat;
 * transition notifications clear the audience once-scopes so a re-dispatched `ctx.audience.once`
 * sees the same answers as live.
 */
export class ReplayHost extends ManualHost implements RuntimeHost {
  /** Timer fires this run has performed so far; the whole run is budgeted, not just one advance. */
  private firedTotal = 0;

  /**
   * Advances the clock to `time + ms`, firing every due timer in `(at, id)` order. One advance
   * fires at most {@link MAX_TIMER_FIRES_PER_ADVANCE} timers and a whole run at most
   * {@link MAX_TIMER_FIRES_PER_REPLAY}; exceeding either throws a `replayLog:`-prefixed
   * {@link TimerLimitError}, so a hostile log's huge time gaps cannot do unbounded work.
   */
  advance(ms: number): void {
    const target = this.time + ms;
    let fired = 0;
    for (;;) {
      const head = this.queue.peek();
      if (head === undefined || head.at > target) break;
      ++fired;
      if (fired > MAX_TIMER_FIRES_PER_ADVANCE) {
        throw new TimerLimitError(
          `replayLog: this advance would fire more than ${MAX_TIMER_FIRES_PER_ADVANCE} timers; the log's time gaps are too large to replay`,
        );
      }
      if (this.firedTotal + fired > MAX_TIMER_FIRES_PER_REPLAY) {
        throw new TimerLimitError(
          `replayLog: this run would fire more than ${MAX_TIMER_FIRES_PER_REPLAY} timers in total; the log is too long to replay`,
        );
      }
      this.queue.shift();
      this.time = head.at;
      head.callback();
    }
    this.firedTotal += fired;
    this.time = target;
  }

  /** {@inheritDoc RuntimeHost.send} */
  send(_playerId: string, _type: string, _payload: unknown): void {}

  /** {@inheritDoc RuntimeHost.broadcast} */
  broadcast(_type: string, _payload: unknown): void {}

  /** {@inheritDoc RuntimeHost.showTo} */
  showTo(_playerId: string, _ref: object): void {}

  /** {@inheritDoc RuntimeHost.hideFrom} */
  hideFrom(_playerId: string, _ref: object): void {}

  publishOptions(_options: unknown): void {}
}
