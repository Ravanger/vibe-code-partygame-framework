import type { GameConnectionManager } from "@partygame/game-client/connection";

export type Screen =
  | "welcome"
  | "connecting"
  | "waiting-room"
  | "category-vote"
  | "prompting"
  | "matchup-vote"
  | "results"
  | "unsupported";

/** Game phase -> screen. Adding a phase means adding one line here. */
const PHASE_TO_SCREEN: Record<string, Screen> = {
  Lobby: "waiting-room",
  CategorySelection: "category-vote",
  Prompting: "prompting",
  Voting: "matchup-vote",
  Results: "results",
};

export class AppViewModel {
  constructor(private readonly manager: GameConnectionManager) {}

  // Getter that reads stateVersion first: room.state is a Colyseus schema
  // object (never proxied by Svelte), so without this tick the screen router
  // never re-derives when the server changes phase.
  get phase(): string {
    return this.manager.stateVersion >= 0
      ? ((this.manager.room?.state as { phase?: string } | undefined)?.phase ?? "Lobby")
      : "Lobby";
  }

  get errorMessage(): string | undefined {
    return this.manager.error;
  }

  get screen(): Screen {
    const status = this.manager.connectionStatus;
    if (status === "connecting") return "connecting";
    // Not connected for ANY reason -> Welcome. An error is a banner there, not a
    // dead end. Routing "disconnected" to an error page was the original bug (D1):
    // Welcome is what starts the connection, so it must be reachable while disconnected.
    if (status !== "connected") return "welcome";
    return PHASE_TO_SCREEN[this.phase] ?? "unsupported";
  }
}
