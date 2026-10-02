import { Client } from "@colyseus/sdk";
import type { BaseGameState } from "@partygame/shared/schema";
import { BotPlayer } from "./BotPlayer.js";
import { claimName } from "./claimName.js";
import { type JoinBotsOptions, joinBots } from "./joinBots.js";
import { RoomWatch } from "./RoomWatch.js";
import type { BotConnection, BotKit, BotRoom } from "./types.js";

export interface DemoTableOptions<TState extends BaseGameState>
  extends BotConnection,
    BotKit<TState>,
    Pick<JoinBotsOptions<TState>, "nameFor" | "timeoutMs"> {
  /** Bots besides the host bot. */
  bots: number;
  /** Room options the host creates the room with; `seats` is added. */
  roomOptions?: object;
  hostName?: string;
  /** True once the game has reached its end. */
  isFinished: (state: TState) => boolean;
}

/** A watch-only room played by bots: a host bot creates and starts it; spectators watch. */
export class DemoTable<TState extends BaseGameState> {
  private readonly hostId = crypto.randomUUID();
  private readonly botIds: string[];
  private host: BotPlayer<TState> | undefined;
  private seat: { room: BotRoom<TState>; watch: RoomWatch } | undefined;
  private bots: BotPlayer<TState>[] = [];

  constructor(private readonly options: DemoTableOptions<TState>) {
    this.botIds = Array.from({ length: options.bots }, () => crypto.randomUUID());
  }

  /** Creates the room and its host bot; returns the room code. */
  async open(): Promise<string> {
    if (this.seat) throw new Error("The table is already open");
    const { endpoint, roomName, stateClass, strategy, roomOptions, bot, bots } = this.options;
    const hostName = this.options.hostName ?? "Host Bot";
    const room = await new Client(endpoint).create<TState>(
      roomName,
      { ...roomOptions, playerId: this.hostId, seats: [this.hostId, ...this.botIds] },
      stateClass,
    );
    const watch = new RoomWatch(room);
    try {
      await claimName(room, this.hostId, hostName);
    } catch (error) {
      await Promise.allSettled([room.leave(true)]);
      throw error;
    }
    this.seat = { room, watch };
    this.host = new BotPlayer(room, this.hostId, hostName, strategy, {
      ...bot,
      host: { expectedPlayers: bots + 1, ...bot?.host },
    });
    return room.state.roomCode;
  }

  async seatBots(): Promise<BotPlayer<TState>[]> {
    const { room } = this.openSeat();
    const { endpoint, apiPort, stateClass, strategy, bot, bots, nameFor, timeoutMs } = this.options;
    this.bots = await joinBots({
      code: room.state.roomCode,
      count: bots,
      endpoint,
      apiPort,
      stateClass,
      strategy,
      playerIds: this.botIds,
      ...(bot ? { bot } : {}),
      ...(nameFor ? { nameFor } : {}),
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    });
    return this.bots;
  }

  /** Resolves once `isFinished` holds. */
  async finished(timeoutMs = Number.POSITIVE_INFINITY): Promise<void> {
    const { room, watch } = this.openSeat();
    await watch.until(() => this.options.isFinished(room.state), timeoutMs, "the end of the game");
  }

  async leave(): Promise<void> {
    const host = this.host;
    this.host = undefined;
    this.seat = undefined;
    await Promise.allSettled([host?.leave(), ...this.bots.splice(0).map((each) => each.leave())]);
  }

  private openSeat(): { room: BotRoom<TState>; watch: RoomWatch } {
    if (!this.seat) throw new Error("The table is not open");
    return this.seat;
  }
}
