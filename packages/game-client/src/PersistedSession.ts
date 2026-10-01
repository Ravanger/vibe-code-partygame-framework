const KINDS = { local: "localStorage", session: "sessionStorage" } as const;

/** What survives a page reload: a stable player id, the room code, whether it was joined as a spectator, and the current reconnection token. */
export class PersistedSession {
  private id: string | undefined;

  constructor(private readonly prefix: string) {}

  get playerId(): string {
    this.id ??=
      this.read("local", "playerId") ?? this.write("local", "playerId", crypto.randomUUID());
    return this.id;
  }

  get token(): string | undefined {
    return this.read("session", "reconnectionToken");
  }

  set token(value: string) {
    this.write("session", "reconnectionToken", value);
  }

  get roomCode(): string | undefined {
    return this.read("local", "roomCode");
  }

  set roomCode(value: string) {
    this.write("local", "roomCode", value);
  }

  get spectator(): boolean {
    return this.read("local", "spectator") === "1";
  }

  set spectator(value: boolean) {
    if (value) this.write("local", "spectator", "1");
    else this.remove("local", "spectator");
  }

  clear(): void {
    this.remove("local", "roomCode");
    this.remove("local", "spectator");
    this.remove("session", "reconnectionToken");
  }

  private read(kind: keyof typeof KINDS, key: string): string | undefined {
    try {
      return globalThis[KINDS[kind]].getItem(`${this.prefix}.${key}`) ?? undefined;
    } catch {
      return undefined;
    }
  }

  private write(kind: keyof typeof KINDS, key: string, value: string): string {
    try {
      globalThis[KINDS[kind]].setItem(`${this.prefix}.${key}`, value);
    } catch {}
    return value;
  }

  private remove(kind: keyof typeof KINDS, key: string): void {
    try {
      globalThis[KINDS[kind]].removeItem(`${this.prefix}.${key}`);
    } catch {}
  }
}
