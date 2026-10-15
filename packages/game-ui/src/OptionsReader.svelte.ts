import type { GameConnectionManager } from "@partygame/game-client";
import type { BaseGameState } from "@partygame/shared/schema";
import type { z } from "zod";

/**
 * The room's published options, parsed once per state change.
 * Falls back to `defaults`, or to the schema's own defaults when that is omitted —
 * which requires every schema field to have a `.default()`.
 */
export class OptionsReader<TOptions> {
  /** The current options: what the server published, else the fallback. Reactive. */
  // Field initializer, not a constructor assignment: Stryker wraps constructor statements in
  // if/else, and Svelte only accepts `$derived` as a top-level constructor assignment, so the
  // instrumented output would not compile.
  readonly current: TOptions = $derived.by(() => {
    const raw = this.manager.state?.options;
    if (!raw) return this.fallbackValue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return this.fallbackValue;
    }
    const result = this.schema.safeParse(parsed);
    return result.success ? result.data : this.fallbackValue;
  });

  private readonly fallbackValue: TOptions;

  constructor(
    private readonly manager: GameConnectionManager<BaseGameState>,
    private readonly schema: z.ZodType<TOptions>,
    defaults?: TOptions,
  ) {
    this.fallbackValue = defaults ?? schema.parse({});
  }
}
