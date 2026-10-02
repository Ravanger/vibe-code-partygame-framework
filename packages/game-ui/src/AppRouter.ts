import type { GameConnectionManager } from "@partygame/game-client";
import { LOBBY_PHASE, type ServerError } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";

export interface RouterScreen {
  /** Shown for a moment when the room enters the phase; empty for none. */
  banner?: string;
}

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

  get phase(): string {
    return this.manager.state?.phase ?? LOBBY_PHASE;
  }

  get screen(): Route<keyof TScreens & string> {
    const { status } = this.manager;
    if (status !== "connected" && status !== "reconnecting") return { kind: "welcome" };
    const phase = this.phase;
    if (this.manager.me()?.isActive === false && phase !== LOBBY_PHASE) {
      return { kind: "join-next-round" };
    }
    return this.isKnown(phase) ? { kind: "phase", phase } : { kind: "connecting" };
  }

  get screenKey(): string {
    const route = this.screen;
    return route.kind === "phase" ? route.phase : route.kind;
  }

  get banner(): string {
    const route = this.screen;
    return route.kind === "phase" ? (this.screens[route.phase]?.banner ?? "") : "";
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

  private isKnown(phase: string): phase is keyof TScreens & string {
    return Object.hasOwn(this.screens, phase);
  }
}

/** Routes the connection status and room phase to a screen of `screens`. */
export function createAppRouter<
  TState extends BaseGameState,
  TScreens extends Readonly<Record<string, RouterScreen>>,
>(manager: GameConnectionManager<TState>, screens: TScreens): AppRouter<TState, TScreens> {
  return new AppRouter(manager, screens);
}
