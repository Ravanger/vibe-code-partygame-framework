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
  readonly minPlayers: number;

  // Getter, not $derived: a derived returning the same room.state reference is
  // swallowed by Svelte's equality gate, so the stateVersion tick never reached the
  // deriveds below. As a getter, every reader depends on stateVersion directly.
  private get state(): LobbyState | undefined {
    return this.manager.stateVersion >= 0
      ? (this.manager.room?.state as LobbyState | undefined)
      : undefined;
  }

  readonly roomCode = $derived.by(() => this.state?.roomCode ?? "");
  // Fresh plain snapshots per tick: schema objects are mutated in place (stable
  // identity), and the identity-keyed each block would never re-render a renamed row.
  readonly players = $derived.by(() =>
    this.state?.players ? [...this.state.players.values()].map((p) => ({ ...p })) : [],
  );
  readonly localPlayer = $derived.by(() =>
    this.players.find((p) => p.id === this.manager.room?.sessionId),
  );
  readonly isHost = $derived.by(() => this.localPlayer?.role === "host");
  readonly readyCount = $derived.by(
    () => this.players.filter((p) => p.isReady && p.isConnected).length,
  );

  readonly canStart = $derived.by(() => this.isHost && this.readyCount >= this.minPlayers);

  readonly shareUrl = $derived.by(
    () => `${window.location.origin}${window.location.pathname}?code=${this.roomCode}`,
  );

  constructor(
    private readonly manager: GameConnectionManager,
    minPlayers: number = readMinPlayers(),
  ) {
    this.minPlayers = minPlayers;
    this.draftName = this.localPlayer?.name ?? "";
  }

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
