import { LOBBY_PHASE, type ServerError } from "@partygame/shared";
import type { WitClashManager } from "../manager.js";
import { isKnownPhase, type KnownPhase } from "../screens/index.js";

export type Route =
  | { kind: "welcome" }
  | { kind: "connecting" }
  | { kind: "join-next-round" }
  | { kind: "phase"; phase: KnownPhase };

/** Routes the connection and the room phase to a screen. */
export class AppViewModel {
  constructor(private readonly manager: WitClashManager) {}

  get phase(): string {
    return this.manager.state?.phase ?? LOBBY_PHASE;
  }

  get screen(): Route {
    const { status } = this.manager;
    if (status !== "connected" && status !== "reconnecting") return { kind: "welcome" };
    const phase = this.phase;
    if (this.manager.me()?.isActive === false && phase !== LOBBY_PHASE) {
      return { kind: "join-next-round" };
    }
    return isKnownPhase(phase) ? { kind: "phase", phase } : { kind: "connecting" };
  }

  get isSpectator(): boolean {
    return this.manager.isSpectator;
  }

  get isReconnecting(): boolean {
    return this.manager.status === "reconnecting";
  }

  get roomCode(): string {
    return this.manager.roomCode ?? "";
  }

  get error(): ServerError | undefined {
    return this.manager.lastServerError;
  }

  dismissError(): void {
    this.manager.dismissError();
  }
}
