/**
 * Per-rule, per-component exceptions for the axe suite (#82). An entry silences one rule for one
 * component only. Every entry needs a comment above it explaining why the violation is acceptable
 * and, when a fix is tracked, the issue that tracks it.
 */
export interface A11yAllowEntry {
  /** The axe rule id, e.g. `"button-name"`. */
  rule: string;
  /** The component name passed to `expectNoViolations`, e.g. `"Timer"`. */
  component: string;
  /** Why the violation is acceptable for this component. */
  reason: string;
}

/** Currently empty: every component must pass axe with zero violations. */
export const A11Y_ALLOW_LIST: A11yAllowEntry[] = [];
