import { Client } from "@colyseus/sdk";
import { claimName, waitFor } from "@partygame/client-utils";
import { PROTOCOL_VERSION, RoomCodeSchema } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";
import { BotPlayer } from "./BotPlayer.js";
import { type JoinBotsOptions, joinBots } from "./joinBots.js";
import { RoomWatch } from "./RoomWatch.js";
import type { BotConnection, BotKit, BotRoom } from "./types.js";

const OPEN_TIMEOUT_MS = 5000;

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
  protected seat: { room: BotRoom<TState>; watch: RoomWatch; code: string } | undefined;
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
      {
        ...roomOptions,
        playerId: this.hostId,
        seats: [this.hostId, ...this.botIds],
        protocolVersion: PROTOCOL_VERSION,
      },
      stateClass,
    );
    const watch = new RoomWatch(room);
    // The initial state sync lands after create() resolves (room.state is undefined until then),
    // and a wire hiccup can blank the synced code at any point after that. Capture it atomically
    // at its first well-formed observation — before claimName's round trip opens a window in
    // which a late read would capture "".
    let code = "";
    try {
      await waitFor(
        () => {
          const candidate = room.state?.roomCode ?? "";
          if (RoomCodeSchema.safeParse(candidate).success) {
            code = candidate;
            return true;
          }
          return false;
        },
        "the room state",
        OPEN_TIMEOUT_MS,
      );
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

  async seatBots(): Promise<BotPlayer<TState>[]> {
    const { code } = this.openSeat();
    const { endpoint, apiPort, stateClass, strategy, bot, bots, nameFor, timeoutMs } = this.options;
    this.bots = await joinBots({
      code,
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

  private openSeat(): { room: BotRoom<TState>; watch: RoomWatch; code: string } {
    if (!this.seat) throw new Error("The table is not open");
    return this.seat;
  }
}
