import type { GameConnectionManager } from "@partygame/game-client/connection";
import { readMinPlayers } from "../config.js";

const NAME_DEBOUNCE_MS = 250;

interface LobbyState {
  roomCode: string;
  players: Map<
    string,
    { id: string; name: string; role: string; isReady: boolean; isConnected: boolean }
  >;
}

export class WaitingRoomViewModel {
  draftName = $state("");
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly manager: GameConnectionManager,
    minPlayers: number = readMinPlayers(),
  ) {
    this.minPlayers = minPlayers;
  }

  private readonly state = $derived(
    this.manager.stateVersion >= 0
      ? (this.manager.room?.state as LobbyState | undefined)
      : undefined,
  );

  readonly roomCode = $derived(this.state?.roomCode ?? "");
  readonly players = $derived(this.state?.players ? [...this.state.players.values()] : []);
  readonly localPlayer = $derived(this.players.find((p) => p.id === this.manager.room?.sessionId));
  readonly isHost = $derived(this.localPlayer?.role === "host");
  readonly readyCount = $derived(this.players.filter((p) => p.isReady && p.isConnected).length);

  /**
   * Injected, not read from import.meta.env inline — an inline env read is
   * untestable. The component passes `readMinPlayers()`; tests pass a literal.
   */
  readonly minPlayers: number;
  readonly canStart = $derived(this.isHost && this.readyCount >= this.minPlayers);

  readonly shareUrl = $derived(
    `${window.location.origin}${window.location.pathname}?code=${this.roomCode}`,
  );

  /** Local draft updates instantly; the server hears one message per burst. */
  setName(value: string) {
    this.draftName = value;
    clearTimeout(this.timer);
    const trimmed = value.trim();
    if (!trimmed) return;
    this.timer = setTimeout(
      () => this.manager.room?.send("SET_NAME", trimmed.slice(0, 20)),
      NAME_DEBOUNCE_MS,
    );
  }

  start() {
    if (this.canStart) this.manager.room?.send("ACTION", { type: "START_GAME" });
  }

  async copyCode() {
    try {
      await navigator.clipboard.writeText(this.roomCode);
    } catch {
      // Ignore clipboard errors
    }
  }

  destroy() {
    clearTimeout(this.timer);
  }
}
