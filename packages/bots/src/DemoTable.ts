import { claimName, type RoomConnector } from "@partygame/client-utils";
import type { BaseGameState } from "@partygame/shared/schema";
import { BotPlayer } from "./BotPlayer.js";
import { defaultConnector } from "./ColyseusConnector.js";
import { type JoinBotsOptions, joinBots } from "./joinBots.js";
import { captureRoomCode, RoomWatch } from "./RoomWatch.js";
import type { BotConnection, BotKit, BotRoom } from "./types.js";

/** Connection, bot kit, bot count and finish rule for a {@link DemoTable}. */
export interface DemoTableOptions<TState extends BaseGameState>
  extends BotConnection,
    BotKit<TState>,
    Pick<JoinBotsOptions<TState>, "nameFor" | "timeoutMs" | "resolveCode"> {
  /** Bots besides the host bot. */
  bots: number;
  /** Room options the host creates the room with; `seats` is added. */
  roomOptions?: object;
  hostName?: string;
  /** True once the game has reached its end. */
  isFinished: (state: TState) => boolean;
  /** Creates the room and seats the bots; a Colyseus connector for `endpoint` by default. */
  connector?: RoomConnector<TState>;
}

/** A watch-only room played by bots: a host bot creates and starts it; spectators watch. */
export class DemoTable<TState extends BaseGameState> {
  private readonly hostId = crypto.randomUUID();
  private readonly botIds: string[];
  private host: BotPlayer<TState> | undefined;
  protected seat: { room: BotRoom<TState>; watch: RoomWatch; code: string } | undefined;
  private bots: BotPlayer<TState>[] = [];
  private readonly connector: RoomConnector<TState>;

  constructor(private readonly options: DemoTableOptions<TState>) {
    this.botIds = Array.from({ length: options.bots }, () => crypto.randomUUID());
    this.connector =
      options.connector ??
      defaultConnector(options.endpoint, {
        roomName: options.roomName,
        stateClass: options.stateClass,
      });
  }

  /** Creates the room and its host bot; returns the room code. */
  async open(): Promise<string> {
    if (this.seat) throw new Error("The table is already open");
    const { strategy, roomOptions, bot, bots } = this.options;
    const hostName = this.options.hostName ?? "Host Bot";
    const room = await this.connector.create({
      ...roomOptions,
      playerId: this.hostId,
      seatSecret: crypto.randomUUID() + crypto.randomUUID(),
      seats: [this.hostId, ...this.botIds],
    });
    const watch = new RoomWatch(room);
    let code = "";
    try {
      // Capture the code at its first well-formed value, before claimName's round trip can blank it.
      code = await captureRoomCode(watch, () => room.state);
      await claimName(room, this.hostId, hostName);
    } catch (error) {
      await Promise.allSettled([room.leave(true)]);
      throw error;
    }
    this.seat = { room, watch, code };
    this.host = new BotPlayer(room, this.hostId, hostName, strategy, {
      ...bot,
      host: { expectedPlayers: bots + 1, ...bot?.host },
    });
    return this.seat.code;
  }

  /** Creates the room with a host bot and seats the other bots; resolves with all of them. */
  async seatBots(): Promise<BotPlayer<TState>[]> {
    const { code } = this.openSeat();
    const { endpoint, apiPort, stateClass, strategy, bot, bots, nameFor, resolveCode, timeoutMs } =
      this.options;
    this.bots = await joinBots({
      code,
      count: bots,
      endpoint,
      apiPort,
      stateClass,
      strategy,
      playerIds: this.botIds,
      connector: this.connector,
      ...(bot ? { bot } : {}),
      ...(nameFor ? { nameFor } : {}),
      ...(resolveCode === undefined ? {} : { resolveCode }),
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    });
    return this.bots;
  }

  /** Resolves once `isFinished` holds. */
  async finished(timeoutMs = Number.POSITIVE_INFINITY): Promise<void> {
    const { room, watch } = this.openSeat();
    await watch.until(() => this.options.isFinished(room.state), timeoutMs, "the end of the game");
  }

  /** Leaves the room and disconnects the host bot and every other bot. */
  async leave(): Promise<void> {
    const host = this.host;
    this.host = undefined;
    this.seat = undefined;
    await Promise.allSettled([host?.leave(), ...this.bots.splice(0).map((each) => each.leave())]);
  }

  private openSeat(): { room: BotRoom<TState>; watch: RoomWatch; code: string } {
    if (!this.seat) throw new Error("The table is not open");
    return this.seat;
  }
}
