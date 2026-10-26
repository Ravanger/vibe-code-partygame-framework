import { claimName, type RoomConnector } from "@partygame/client-utils";
import type { BaseGameState } from "@partygame/shared/schema";
import { BotPlayer } from "./BotPlayer.js";
import { ColyseusConnector } from "./ColyseusConnector.js";
import type { BotConnection, BotKit } from "./types.js";

const DEFAULT_TIMEOUT_MS = 5000;

export interface JoinBotsOptions<TState extends BaseGameState>
  extends BotConnection,
    Omit<BotKit<TState>, "roomName"> {
  code: string;
  count: number;
  /** playerIds for the bots in order; a random one when the list runs out. */
  playerIds?: readonly string[];
  /** Name for the n-th free slot (1-based); "Bot n" by default. Taken names are skipped. */
  nameFor?: (n: number) => string;
  timeoutMs?: number;
  /** Opens the bot seats; a Colyseus connector for `endpoint` and `apiPort` by default. */
  connector?: RoomConnector<TState>;
}

class BotJoiner<TState extends BaseGameState> {
  private readonly connector: RoomConnector<TState>;

  constructor(private readonly options: JoinBotsOptions<TState>) {
    this.connector =
      options.connector ??
      new ColyseusConnector(options.endpoint, options.apiPort, { stateClass: options.stateClass });
  }

  async join(): Promise<BotPlayer<TState>[]> {
    const { code, count } = this.options;
    const bots: BotPlayer<TState>[] = [];
    try {
      for (let i = 0; i < count; ++i) bots.push(await this.joinOne(code, i));
    } catch (error) {
      await Promise.allSettled(bots.map((bot) => bot.leave()));
      throw error;
    }
    return bots;
  }

  private async joinOne(code: string, index: number): Promise<BotPlayer<TState>> {
    const { strategy, bot, playerIds } = this.options;
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const playerId = playerIds?.[index] ?? crypto.randomUUID();
    const room = await this.connector.join(code, { playerId, timeoutMs });
    try {
      const name = this.freeName(room.state);
      await claimName(room, playerId, name, timeoutMs);
      return new BotPlayer(room, playerId, name, strategy, bot);
    } catch (error) {
      await Promise.allSettled([room.leave(true)]);
      throw error;
    }
  }

  private freeName(state: TState): string {
    const nameFor = this.options.nameFor ?? ((n: number) => `Bot ${n}`);
    const taken = new Set([...state.players.values()].map((seat) => seat.name.toLowerCase()));
    for (let n = 1; n <= taken.size + 1; ++n) {
      const name = nameFor(n);
      if (!taken.has(name.toLowerCase())) return name;
    }
    throw new Error("nameFor keeps returning names that are already taken");
  }
}

/** Joins `count` bots to room `code` and names them; on failure every seat it took is left again. */
export const joinBots = <TState extends BaseGameState>(
  options: JoinBotsOptions<TState>,
): Promise<BotPlayer<TState>[]> => new BotJoiner(options).join();
