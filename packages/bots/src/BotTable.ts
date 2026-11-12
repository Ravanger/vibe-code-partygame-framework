import type { RoomConnector } from "@partygame/client-utils";
import type { BaseGameState } from "@partygame/shared/schema";
import type { BotPlayer } from "./BotPlayer.js";
import { defaultConnector } from "./ColyseusConnector.js";
import { type JoinBotsOptions, joinBots } from "./joinBots.js";
import { captureRoomCode, RoomWatch } from "./RoomWatch.js";
import type { BotConnection, BotKit, BotRoom } from "./types.js";

/** Connection, bot kit and join options for a {@link BotTable}. */
export interface BotTableOptions<TState extends BaseGameState>
  extends BotConnection,
    BotKit<TState>,
    Pick<JoinBotsOptions<TState>, "nameFor" | "timeoutMs" | "resolveCode"> {
  /** Opens the room and seats the bots; a Colyseus connector for `endpoint` by default. */
  connector?: RoomConnector<TState>;
}

/** How many bots to seat and how long, in milliseconds, to wait for a human first. */
export interface SeatBotsOptions {
  count: number;
  timeoutMs?: number;
}

const DEFAULT_SEAT_TIMEOUT_MS = 120_000;

/** Opens an empty room as a spectator, then seats bots once a human has joined and named themselves. */
export class BotTable<TState extends BaseGameState> {
  private readonly connector: RoomConnector<TState>;
  private seat: { room: BotRoom<TState>; watch: RoomWatch; code: string } | undefined;
  private bots: BotPlayer<TState>[] = [];

  constructor(private readonly options: BotTableOptions<TState>) {
    this.connector =
      options.connector ??
      defaultConnector(options.endpoint, {
        roomName: options.roomName,
        stateClass: options.stateClass,
      });
  }

  /** Creates the room and returns its code. */
  async open(): Promise<string> {
    if (this.seat) throw new Error("The table is already open");
    const room = await this.connector.create({ playerId: crypto.randomUUID(), spectator: true });
    const watch = new RoomWatch(room);
    this.seat = { room, watch, code: "" };
    // Capture the code at its first well-formed value; a later read can be malformed.
    this.seat.code = await captureRoomCode(watch, () => room.state);
    return this.seat.code;
  }

  /** Waits for a human to join and name themselves, then seats `count` bots and resolves with them. */
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
      resolveCode,
      timeoutMs: joinTimeoutMs,
    } = this.options;
    this.bots = await joinBots({
      code,
      count,
      endpoint,
      apiPort,
      stateClass,
      strategy,
      connector: this.connector,
      ...(bot ? { bot } : {}),
      ...(nameFor ? { nameFor } : {}),
      ...(resolveCode === undefined ? {} : { resolveCode }),
      ...(joinTimeoutMs === undefined ? {} : { timeoutMs: joinTimeoutMs }),
    });
    await this.leaveRoom();
    return this.bots;
  }

  /** Leaves the table room and disconnects every seated bot. */
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
