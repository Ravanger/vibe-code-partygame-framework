import { Client } from "@colyseus/sdk";
import { resolveRoomCode, waitFor } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";
import { BotPlayer } from "./BotPlayer.js";
import { claimName } from "./claimName.js";
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
}

/** `http(s)://host:apiPort` for a game server endpoint (`ws:` maps to `http:`, `wss:` to `https:`). */
export const apiBaseOf = (endpoint: string, apiPort: number): string => {
  const url = new URL(endpoint);
  return `${url.protocol === "wss:" ? "https" : "http"}://${url.hostname}:${apiPort}`;
};

class BotJoiner<TState extends BaseGameState> {
  private readonly client: Client;

  constructor(private readonly options: JoinBotsOptions<TState>) {
    this.client = new Client(options.endpoint);
  }

  async join(): Promise<BotPlayer<TState>[]> {
    const { endpoint, apiPort, code, count } = this.options;
    const roomId = await resolveRoomCode(apiBaseOf(endpoint, apiPort), code);
    const bots: BotPlayer<TState>[] = [];
    try {
      for (let i = 0; i < count; ++i) bots.push(await this.joinOne(roomId, i));
    } catch (error) {
      await Promise.allSettled(bots.map((bot) => bot.leave()));
      throw error;
    }
    return bots;
  }

  private async joinOne(roomId: string, index: number): Promise<BotPlayer<TState>> {
    const { stateClass, strategy, bot, playerIds } = this.options;
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const playerId = playerIds?.[index] ?? crypto.randomUUID();
    const room = await this.client.joinById<TState>(roomId, { playerId }, stateClass);
    try {
      await waitFor(() => room.state.roomCode !== "", "the room state", timeoutMs);
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
