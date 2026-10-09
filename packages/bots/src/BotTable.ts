import { Client } from "@colyseus/sdk";
import type { BaseGameState } from "@partygame/shared/schema";
import type { BotPlayer } from "./BotPlayer.js";
import { type JoinBotsOptions, joinBots } from "./joinBots.js";
import { RoomWatch } from "./RoomWatch.js";
import type { BotConnection, BotKit, BotRoom } from "./types.js";

export interface BotTableOptions<TState extends BaseGameState>
  extends BotConnection,
    BotKit<TState>,
    Pick<JoinBotsOptions<TState>, "nameFor" | "timeoutMs"> {}

export interface SeatBotsOptions {
  count: number;
  timeoutMs?: number;
}

const DEFAULT_SEAT_TIMEOUT_MS = 120_000;
const OPEN_TIMEOUT_MS = 5000;

/** Opens an empty room as a spectator, then seats bots once a human has joined and named themselves. */
export class BotTable<TState extends BaseGameState> {
  private readonly client: Client;
  private seat: { room: BotRoom<TState>; watch: RoomWatch; code: string } | undefined;
  private bots: BotPlayer<TState>[] = [];

  constructor(private readonly options: BotTableOptions<TState>) {
    this.client = new Client(options.endpoint);
  }

  /** Creates the room and returns its code. */
  async open(): Promise<string> {
    if (this.seat) throw new Error("The table is already open");
    const room = await this.client.create<TState>(
      this.options.roomName,
      { playerId: crypto.randomUUID(), spectator: true },
      this.options.stateClass,
    );
    const watch = new RoomWatch(room);
    this.seat = { room, watch, code: "" };
    await watch.until(() => room.state.roomCode !== "", OPEN_TIMEOUT_MS, "the room code");
    this.seat.code = room.state.roomCode;
    return this.seat.code;
  }

  async seatBots({
    count,
    timeoutMs = DEFAULT_SEAT_TIMEOUT_MS,
  }: SeatBotsOptions): Promise<BotPlayer<TState>[]> {
    if (!this.seat) throw new Error("The table is not open");
    const { room, watch, code } = this.seat;
    await watch.until(
      () => [...room.state.players.values()].some((player) => player.name !== ""),
      timeoutMs,
      "a player to join and enter a name",
    );
    const {
      endpoint,
      apiPort,
      stateClass,
      strategy,
      bot,
      nameFor,
      timeoutMs: joinTimeoutMs,
    } = this.options;
    this.bots = await joinBots({
      code,
      count,
      endpoint,
      apiPort,
      stateClass,
      strategy,
      ...(bot ? { bot } : {}),
      ...(nameFor ? { nameFor } : {}),
      ...(joinTimeoutMs === undefined ? {} : { timeoutMs: joinTimeoutMs }),
    });
    await this.leaveRoom();
    return this.bots;
  }

  async leave(): Promise<void> {
    await this.leaveRoom();
    await Promise.allSettled(this.bots.splice(0).map((bot) => bot.leave()));
  }

  private async leaveRoom(): Promise<void> {
    const seat = this.seat;
    this.seat = undefined;
    if (seat && !seat.watch.gone) await seat.room.leave(true);
  }
}
