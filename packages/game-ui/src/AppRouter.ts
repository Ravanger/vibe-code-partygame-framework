import type { GameConnectionManager } from "@partygame/game-client";
import { LOBBY_PHASE, type ServerError } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";

/** A screen entry of the router's table, optionally with a banner. */
export interface RouterScreen {
  /** Shown for a moment when the room enters the phase; empty for none. */
  banner?: string;
}

/** The screen the router picked: a fixed screen or one game phase. */
export type Route<TPhase extends string> =
  | { kind: "welcome" }
  | { kind: "connecting" }
  | { kind: "join-next-round" }
  | { kind: "phase"; phase: TPhase };

/** Routes the connection status and room phase to a screen of `screens`. */
export class AppRouter<
  TState extends BaseGameState,
  TScreens extends Readonly<Record<string, RouterScreen>>,
> {
  constructor(
    protected readonly manager: GameConnectionManager<TState>,
    protected readonly screens: TScreens,
  ) {}

  /** The room's current phase, or the lobby phase before the state has synced. */
  get phase(): string {
    return this.manager.state?.phase ?? LOBBY_PHASE;
  }

  /** The route for the current connection status, seat and phase; a phase missing from `screens` yields `connecting`. */
  get screen(): Route<keyof TScreens & string> {
    const { status } = this.manager;
    if (status !== "connected" && status !== "reconnecting") return { kind: "welcome" };
    const phase = this.phase;
    if (this.manager.me()?.isActive === false && phase !== LOBBY_PHASE) {
      return { kind: "join-next-round" };
    }
    return this.isKnown(phase) ? { kind: "phase", phase } : { kind: "connecting" };
  }

  /** A string that changes whenever the route does, for keying transitions. */
  get screenKey(): string {
    const route = this.screen;
    return route.kind === "phase" ? route.phase : route.kind;
  }

  /** The banner text of the current phase's screen; empty when there is none. */
  get banner(): string {
    const route = this.screen;
    return route.kind === "phase" ? (this.screens[route.phase]?.banner ?? "") : "";
  }

  /** True while in the room without a seat. */
  get isSpectator(): boolean {
    return this.manager.isSpectator;
  }

  /** True while the connection is being restored. */
  get isReconnecting(): boolean {
    return this.manager.status === "reconnecting";
  }

  /** The room's join code, or an empty string before the state has synced. */
  get roomCode(): string {
    return this.manager.roomCode ?? "";
  }

  /** The latest server rejection not yet dismissed. */
  get error(): ServerError | undefined {
    return this.manager.lastServerError;
  }

  /** Clears the current server error. */
  dismissError(): void {
    this.manager.dismissError();
  }

  private isKnown(phase: string): phase is keyof TScreens & string {
    return Object.hasOwn(this.screens, phase);
  }
}

/** Creates an `AppRouter` for `manager` that picks the screen in `screens` matching the current room phase. */
export function createAppRouter<
  TState extends BaseGameState,
  TScreens extends Readonly<Record<string, RouterScreen>>,
>(manager: GameConnectionManager<TState>, screens: TScreens): AppRouter<TState, TScreens> {
  return new AppRouter(manager, screens);
}
