/** Browser storage the policy persists to (e.g. `localStorage`); every access is wrapped, so a throwing or empty storage (private windows) degrades to sound off. */
export interface SoundStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The event target that unlocks sound on the first gesture — the window in a game client. */
export interface GestureTarget {
  addEventListener(type: "pointerdown" | "keydown", listener: () => void): void;
}

export interface SoundPolicyOptions {
  /** Where the toggle is persisted. */
  storage: SoundStorage;
  /** The game's `storagePrefix`; the toggle is stored under `${storagePrefix}.sound`. */
  storagePrefix: string;
  /** Where the first gesture (pointerdown/keydown) is listened for. */
  target: GestureTarget;
}

/**
 * A room's sound policy: off by default, one persisted toggle, and nothing may play before the
 * first tap — browsers block audio until a user gesture, and players on a shared TV may not want
 * it at all. Games gate their audio on {@link canPlay}.
 */
export class SoundPolicy {
  #enabled = $state(false);
  #unlocked = $state(false);

  constructor(private readonly options: SoundPolicyOptions) {
    this.#enabled = this.read();
    const unlock = (): void => {
      this.#unlocked = true;
    };
    this.options.target.addEventListener("pointerdown", unlock);
    this.options.target.addEventListener("keydown", unlock);
  }

  /** Whether sound is turned on; persisted across reloads under `${storagePrefix}.sound`. */
  get enabled(): boolean {
    return this.#enabled;
  }

  /** Whether a first gesture (pointerdown or keydown) has happened. */
  get unlocked(): boolean {
    return this.#unlocked;
  }

  /** The gate for audio: sound on AND the browser has heard a gesture. */
  get canPlay(): boolean {
    return this.enabled && this.unlocked;
  }

  /** Flips `enabled` and persists it; a throwing storage is ignored. */
  toggle(): void {
    this.#enabled = !this.#enabled;
    this.write(this.#enabled);
  }

  private get key(): string {
    return `${this.options.storagePrefix}.sound`;
  }

  private read(): boolean {
    try {
      return this.options.storage.getItem(this.key) === "1";
    } catch {
      return false;
    }
  }

  private write(value: boolean): void {
    try {
      this.options.storage.setItem(this.key, value ? "1" : "0");
    } catch {}
  }
}
