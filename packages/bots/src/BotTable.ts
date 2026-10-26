import type { RoomConnector } from "@partygame/client-utils";
import { RoomCodeSchema } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";
import type { BotPlayer } from "./BotPlayer.js";
import { ColyseusConnector } from "./ColyseusConnector.js";
import { type JoinBotsOptions, joinBots } from "./joinBots.js";
import { RoomWatch } from "./RoomWatch.js";
import type { BotConnection, BotKit, BotRoom } from "./types.js";

export interface BotTableOptions<TState extends BaseGameState>
  extends BotConnection,
    BotKit<TState>,
    Pick<JoinBotsOptions<TState>, "nameFor" | "timeoutMs"> {
  /** Opens the room and seats the bots; a Colyseus connector for `endpoint` and `apiPort` by default. */
  connector?: RoomConnector<TState>;
}

export interface SeatBotsOptions {
  count: number;
  timeoutMs?: number;
}

const DEFAULT_SEAT_TIMEOUT_MS = 120_000;
const OPEN_TIMEOUT_MS = 5000;

/** Opens an empty room as a spectator, then seats bots once a human has joined and named themselves. */
export class BotTable<TState extends BaseGameState> {
  private readonly connector: RoomConnector<TState>;
  private seat: { room: BotRoom<TState>; watch: RoomWatch; code: string } | undefined;
  private bots: BotPlayer<TState>[] = [];

  constructor(private readonly options: BotTableOptions<TState>) {
    this.connector =
      options.connector ??
      new ColyseusConnector(options.endpoint, options.apiPort, {
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
    // The initial state sync lands after create() resolves (room.state is undefined until then),
    // and a wire hiccup can leave the synced code malformed; capture it atomically at its first
    // well-formed observation instead of any non-empty value (the API would refuse a garbage code
    // with "Invalid code format").
    let code = "";
    await watch.until(
      () => {
        const candidate = room.state?.roomCode ?? "";
        if (RoomCodeSchema.safeParse(candidate).success) {
          code = candidate;
          return true;
        }
        return false;
      },
      OPEN_TIMEOUT_MS,
      "the room code",
    );
    this.seat.code = code;
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
      connector: this.connector,
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
