/** Once-per-scope tracking for seatless audience senders; cleared on every phase transition. */
export class AudienceScopes {
  private readonly used = new Map<string, Set<string>>();

  /** True the first time `audienceKey` uses `scope`; false afterwards until {@link AudienceScopes.clear}. */
  once(audienceKey: string, scope: string): boolean {
    const scopes = this.used.get(audienceKey);
    if (scopes === undefined) {
      this.used.set(audienceKey, new Set([scope]));
      return true;
    }
    if (scopes.has(scope)) return false;
    scopes.add(scope);
    return true;
  }

  /** Forget every key and scope (a phase change). */
  clear(): void {
    this.used.clear();
  }
}
