import { LOBBY_PHASE, type ServerError } from "@partygame/shared";
import { PHASE } from "../../src/phaseNames.js";
import type { WitClashManager } from "../manager.js";
import { isKnownPhase, type KnownPhase, PHASE_SCREENS } from "../screens/index.js";

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

  get screenKey(): string {
    const route = this.screen;
    return route.kind === "phase" ? route.phase : route.kind;
  }

  get banner(): string {
    const route = this.screen;
    if (route.kind !== "phase") return "";
    const laterMatchup = (this.manager.state?.activeMatchupIndex ?? 0) > 0;
    return route.phase === PHASE.MatchupVoting && laterMatchup
      ? ""
      : PHASE_SCREENS[route.phase].banner;
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
