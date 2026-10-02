import { KICK_PLAYER, START_GAME } from "@partygame/shared";
import type { WitClashManager } from "../manager.js";
import { NameField } from "./NameField.svelte.js";

export interface LobbyPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  isMe: boolean;
}

export class WaitingRoomViewModel {
  kickCandidate = $state<string | undefined>(undefined);
  readonly nameField: NameField;
  /** Decided once, so the name card does not jump away while its owner is typing. */
  readonly nameFirst: boolean;

  constructor(private readonly manager: WitClashManager) {
    this.nameField = new NameField(manager);
    this.nameFirst = this.needsName;
  }

  get needsName(): boolean {
    return this.manager.me()?.isReady === false;
  }

  get showJoinInfo(): boolean {
    return this.isHost || this.isSpectator;
  }

  get showWaitingPanel(): boolean {
    return !this.isHost && !this.isSpectator && !this.needsName;
  }

  get draftName(): string {
    return this.nameField.draft;
  }

  get notice(): string {
    return this.manager.state?.notice ?? "";
  }

  get roomCode(): string {
    return this.manager.roomCode ?? "";
  }

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

  get minPlayers(): number {
    return this.manager.state?.minPlayers ?? 0;
  }

  get maxPlayers(): number {
    return this.manager.state?.maxPlayers ?? 0;
  }

  get readyCount(): number {
    return this.players.filter((p) => p.isReady && p.isConnected).length;
  }

  get isSpectator(): boolean {
    return this.manager.isSpectator;
  }

  get spectatorCount(): number {
    return this.manager.state?.spectatorCount ?? 0;
  }

  get isHost(): boolean {
    return this.manager.isHost;
  }

  get canStart(): boolean {
    return this.isHost && Boolean(this.manager.state?.canStart);
  }

  get shareUrl(): string {
    return `${window.location.origin}${window.location.pathname}?code=${this.roomCode}`;
  }

  canKick(player: LobbyPlayer): boolean {
    return this.isHost && !player.isMe;
  }

  askKick(playerId: string): void {
    this.kickCandidate = playerId;
  }

  cancelKick(): void {
    this.kickCandidate = undefined;
  }

  async confirmKick(): Promise<void> {
    const playerId = this.kickCandidate;
    this.kickCandidate = undefined;
    if (playerId && this.isHost) await this.manager.sendAction(KICK_PLAYER, { playerId });
  }

  setName(value: string): void {
    this.nameField.set(value);
  }

  async leave(): Promise<void> {
    await this.manager.leave();
  }

  async start(): Promise<void> {
    if (this.canStart) await this.manager.sendAction(START_GAME);
  }

  async copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.roomCode);
    } catch {
      // Clipboard access can be denied; the code is on screen anyway.
    }
  }

  destroy(): void {
    this.nameField.destroy();
  }
}
