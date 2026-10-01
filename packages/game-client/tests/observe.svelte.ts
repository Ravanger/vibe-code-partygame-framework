import { flushSync } from "svelte";

/** Runs `read` in a real effect and records every value it produced; call `stop` when done. */
export function observe<T>(read: () => T): { values: T[]; stop: () => void } {
  const values: T[] = [];
  const stop = $effect.root(() => {
    $effect(() => {
      values.push(read());
    });
  });
  flushSync();
  return { values, stop };
}
