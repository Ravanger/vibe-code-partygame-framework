import type { GameConnectionManager } from "@partygame/game-client/connection";

const CODE_PATTERN = /^[A-Z]{4}$/;
const LAST_ROOM_KEY = "lastRoomCode";

export class WelcomeViewModel {
  code = $state("");
  localError = $state<string | undefined>(undefined);
  #hasAutoJoined = false;
  manager: GameConnectionManager;
  urlCode: string | undefined;

  constructor(manager: GameConnectionManager, urlCode?: string | undefined) {
    this.manager = manager;
    this.urlCode = urlCode;
    if (urlCode && CODE_PATTERN.test(urlCode)) this.code = urlCode;
  }

  codeIsValid = $derived.by(() => CODE_PATTERN.test(this.code));
  busy = $derived.by(() => this.manager.connectionStatus === "connecting");
  /** Hosting is ALWAYS offered. Hiding it behind stored state was D7. */
  canHost = true;

  get previousRoomCode() {
    try {
      return localStorage.getItem(LAST_ROOM_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  }

  setCode(raw: string) {
    this.code = raw
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 4);
  }

  async host() {
    this.localError = undefined;
    try {
      await this.manager.create("wit_clash");
      this.#rememberRoomCode();
    } catch (e) {
      this.localError = message(e);
    }
  }

  async join() {
    this.localError = undefined;
    if (!this.codeIsValid) {
      this.localError = "Game code must be 4 letters (A–Z).";
      return;
    }
    try {
      await this.manager.joinByCode(this.code);
      this.#rememberRoomCode();
    } catch (e) {
      this.localError = message(e);
    }
  }

  /** Called once on mount when the page was opened with ?code=XXXX. */
  async autoJoinIfRequested() {
    if (this.#hasAutoJoined) return;
    if (!this.urlCode || !CODE_PATTERN.test(this.urlCode)) return;
    this.#hasAutoJoined = true;
    this.code = this.urlCode;
    await this.join();
  }

  async rejoinPrevious() {
    const code = this.previousRoomCode;
    if (!code) return;
    this.code = code;
    await this.join();
  }

  dismissError() {
    this.localError = undefined;
    this.manager.reset();
  }

  /**
   * Read the code from synced state, not from a timer. Fixes D8, which slept
   * 100ms then 200ms and hoped the state had arrived.
   */
  #rememberRoomCode() {
    const code = (this.manager.room?.state as { roomCode?: string } | undefined)?.roomCode;
    if (code) {
      try {
        localStorage.setItem(LAST_ROOM_KEY, code);
      } catch {
        /* private mode */
      }
    }
  }
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
