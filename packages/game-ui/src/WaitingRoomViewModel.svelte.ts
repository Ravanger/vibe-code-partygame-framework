import { joinUrl } from "@partygame/client-utils";
import type { GameConnectionManager } from "@partygame/game-client";
import { KICK_PLAYER, START_GAME } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";
import { NameField } from "./NameField.svelte.js";

/** A seat as the waiting room lists it. */
export interface LobbyPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  isMe: boolean;
}

const defaultLocation = (): { origin: string; pathname: string } => ({
  origin: window.location.origin,
  pathname: window.location.pathname,
});

const defaultClipboard = {
  writeText: (text: string) => navigator.clipboard.writeText(text),
};

/** The lobby screen: roster, room code and share link, name entry, kicking and starting the game. */
export class WaitingRoomViewModel<TState extends BaseGameState> {
  kickCandidate = $state<string | undefined>(undefined);
  readonly nameField: NameField<TState>;
  /** Decided once, so the name card does not jump away while its owner is typing. */
  readonly nameFirst: boolean;
  private readonly location: () => { origin: string; pathname: string };
  private readonly clipboard: { writeText(text: string): Promise<void> };

  /**
   * @param manager The connection this lobby belongs to.
   * @param browser Browser access for the share link and copy button; defaults to the page's
   * `window.location` and `navigator.clipboard`, read lazily, so non-browser hosts can inject their own.
   */
  constructor(
    private readonly manager: GameConnectionManager<TState>,
    browser: {
      location?: () => { origin: string; pathname: string };
      clipboard?: { writeText(text: string): Promise<void> };
    } = {},
  ) {
    this.nameField = new NameField(manager);
    this.nameFirst = this.needsName;
    this.location = browser.location ?? defaultLocation;
    this.clipboard = browser.clipboard ?? defaultClipboard;
  }

  /** True while this client's seat has not yet been named. */
  get needsName(): boolean {
    return this.manager.me()?.isReady === false;
  }

  /** True when the room code and share link should be shown: for the host and spectators. */
  get showJoinInfo(): boolean {
    return this.isHost || this.isSpectator;
  }

  /** True for a named non-host player, who waits for the host to start. */
  get showWaitingPanel(): boolean {
    return !this.isHost && !this.isSpectator && !this.needsName;
  }

  /** The name as typed so far. */
  get draftName(): string {
    return this.nameField.draft;
  }

  /** The server's lobby notice; empty when there is none. */
  get notice(): string {
    return this.manager.state?.notice ?? "";
  }

  /** The room's join code, or an empty string before the state has synced. */
  get roomCode(): string {
    return this.manager.roomCode ?? "";
  }

  /** Every seat in the room, in state order. */
  get players(): LobbyPlayer[] {
    return [...(this.manager.state?.players.values() ?? [])].map((seat) => ({
      id: seat.id,
      name: seat.name,
      isHost: seat.role === "host",
      isReady: seat.isReady,
      isConnected: seat.isConnected,
      isMe: seat.id === this.manager.playerId,
    }));
  }

  /** The fewest players the game needs to start; 0 before the state has synced. */
  get minPlayers(): number {
    return this.manager.state?.minPlayers ?? 0;
  }

  /** The most players the room admits; 0 before the state has synced. */
  get maxPlayers(): number {
    return this.manager.state?.maxPlayers ?? 0;
  }

  /** How many seats are both named and connected. */
  get readyCount(): number {
    return this.players.filter((p) => p.isReady && p.isConnected).length;
  }

  /** True while in the room without a seat. */
  get isSpectator(): boolean {
    return this.manager.isSpectator;
  }

  /** How many spectators are watching. */
  get spectatorCount(): number {
    return this.manager.state?.spectatorCount ?? 0;
  }

  /** True when this client's seat holds the host role. */
  get isHost(): boolean {
    return this.manager.isHost;
  }

  /** True for the host when the server reports the game can start. */
  get canStart(): boolean {
    return this.isHost && Boolean(this.manager.state?.canStart);
  }

  /** A link to this page that joins the room. */
  get shareUrl(): string {
    const { origin, pathname } = this.location();
    return joinUrl(`${origin}${pathname}`, this.roomCode);
  }

  /** True for the host and any seat other than their own. */
  canKick(player: LobbyPlayer): boolean {
    return this.isHost && !player.isMe;
  }

  /** Asks the host to confirm kicking this player. */
  askKick(playerId: string): void {
    this.kickCandidate = playerId;
  }

  /** Withdraws the kick confirmation. */
  cancelKick(): void {
    this.kickCandidate = undefined;
  }

  /** Sends `KICK_PLAYER` for the pending candidate; does nothing unless this client is the host. */
  async confirmKick(): Promise<void> {
    const playerId = this.kickCandidate;
    this.kickCandidate = undefined;
    if (playerId && this.isHost) await this.manager.sendAction(KICK_PLAYER, { playerId });
  }

  /** Updates the name draft, which is sent to the server after a short debounce. */
  setName(value: string): void {
    this.nameField.set(value);
  }

  /** Leaves the room. */
  async leave(): Promise<void> {
    await this.manager.leave();
  }

  /** Sends `START_GAME`; does nothing unless `canStart`. */
  async start(): Promise<void> {
    if (this.canStart) await this.manager.sendAction(START_GAME);
  }

  /** Copies the room code to the clipboard; a denied clipboard is ignored. */
  async copyCode(): Promise<void> {
    try {
      await this.clipboard.writeText(this.roomCode);
    } catch {
      // Clipboard access can be denied; the code is on screen anyway.
    }
  }

  /** Cancels the name field's pending rename. */
  destroy(): void {
    this.nameField.destroy();
  }
}
