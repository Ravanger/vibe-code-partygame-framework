import { LOBBY_PHASE } from "@partygame/shared";
import { setup } from "xstate";

/** Callbacks the generated machine calls back into the runtime. */
export interface PhaseMachineCallbacks {
  /**
   * Every phase, keyed by name; only the presence of `duration` matters — it marks the phase as
   * timed, and its value is read through {@link PhaseMachineCallbacks.duration}.
   */
  phases: Record<string, { duration?: unknown }>;
  /** Enter the named phase (each state's entry action). */
  enter(name: string): void;
  /** The current phase's timer fired (the `after` transition). */
  timeout(): void;
  /** Milliseconds for a timed phase's next timer. */
  duration(): number;
  /** Run a hook, catching its failures where the runtime keeps them. */
  guard(fn: () => void): void;
}

/**
 * Build the game machine: one state per phase plus `Lobby`, a root `GO` event that re-enters the
 * target phase, and an `after` timer on every timed phase. Pure — all runtime behaviour arrives
 * through the callbacks.
 */
export function buildPhaseMachine(callbacks: PhaseMachineCallbacks) {
  const delays: Record<string, () => number> = {};
  const states: Record<string, object> = {};
  for (const [name, phase] of Object.entries(callbacks.phases)) {
    const node: Record<string, unknown> = {
      entry: () => callbacks.guard(() => callbacks.enter(name)),
    };
    if (phase.duration !== undefined) {
      delays[name] = callbacks.duration;
      node.after = {
        [name]: {
          actions: () => callbacks.guard(callbacks.timeout),
        },
      };
    }
    states[name] = node;
  }
  return setup({
    types: { events: {} as { type: "GO"; phase: string } },
    delays,
  }).createMachine({
    id: "game",
    initial: LOBBY_PHASE,
    on: {
      GO: Object.keys(states).map((name) => ({
        guard: ({ event }: { event: { phase: string } }) => event.phase === name,
        target: `.${name}`,
        reenter: true,
      })),
    },
    states,
  });
}
