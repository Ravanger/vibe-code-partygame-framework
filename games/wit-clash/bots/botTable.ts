import { Client, type Room } from "@colyseus/sdk";
import { waitFor } from "@partygame/shared";
import { ROOM_NAME } from "../src/roomName.js";
import { WitClashState } from "../src/state.js";
import type { BotOptions, BotPlayer } from "./BotPlayer.js";
import { joinBots } from "./joinBots.js";

export interface BotTableOptions {
  endpoint: string;
  apiPort: number;
  bot?: BotOptions;
}

export interface SeatBotsOptions {
  count: number;
  timeoutMs?: number;
}

const DEFAULT_SEAT_TIMEOUT_MS = 120_000;
const POLL_MS = 20;

/** Opens an empty room as a spectator, then seats bots once a human has joined and named themselves. */
export class BotTable {
  private readonly client: Client;
  private room: Room<WitClashState> | undefined;
  private roomGone = false;
  private bots: BotPlayer[] = [];

  constructor(private readonly options: BotTableOptions) {
    this.client = new Client(options.endpoint);
  }

  async open(): Promise<string> {
    const room = await this.client.create<WitClashState>(
      ROOM_NAME,
      { playerId: crypto.randomUUID(), spectator: true },
      WitClashState,
    );
    room.onLeave(() => {
      this.roomGone = true;
    });
    this.room = room;
    await this.until(() => room.state.roomCode !== "", Number.POSITIVE_INFINITY, "the room code");
    return room.state.roomCode;
  }

  async seatBots({
    count,
    timeoutMs = DEFAULT_SEAT_TIMEOUT_MS,
  }: SeatBotsOptions): Promise<BotPlayer[]> {
    const room = this.room;
    if (!room) throw new Error("The table is not open");
    await this.until(
      () => [...room.state.players.values()].some((player) => player.name !== ""),
      timeoutMs,
      "a player to join and enter a name",
    );
    this.bots = await joinBots({
      code: room.state.roomCode,
      count,
      endpoint: this.options.endpoint,
      apiPort: this.options.apiPort,
      ...(this.options.bot ? { bot: this.options.bot } : {}),
    });
    await this.leaveRoom();
    return this.bots;
  }

  async leave(): Promise<void> {
    await this.leaveRoom();
    await Promise.all(this.bots.splice(0).map((bot) => bot.leave()));
  }

  private async leaveRoom(): Promise<void> {
    const room = this.room;
    this.room = undefined;
    if (room && !this.roomGone) await room.leave();
  }

  private until(predicate: () => boolean, timeoutMs: number, what: string): Promise<void> {
    return waitFor(
      () => {
        if (this.roomGone) throw new Error(`The room closed while waiting for ${what}`);
        return predicate();
      },
      what,
      timeoutMs,
      POLL_MS,
    );
  }
}
