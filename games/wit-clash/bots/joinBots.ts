import { Client } from "@colyseus/sdk";
import { ClientMessage, waitFor } from "@partygame/shared";
import { WitClashState } from "../src/state.js";
import { type BotOptions, BotPlayer } from "./BotPlayer.js";
import { RoomLocator } from "./RoomLocator.js";

export interface JoinBotsOptions {
  code: string;
  count: number;
  endpoint: string;
  apiPort: number;
  bot?: BotOptions;
  /** playerIds for the bots in order; a random one when the list runs out. */
  playerIds?: readonly string[];
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;

/** Joins `count` bots, named "Bot 1", "Bot 2", ..., skipping names the room already uses. */
export class BotJoiner {
  private readonly client: Client;
  private readonly locator: RoomLocator;

  constructor(private readonly options: JoinBotsOptions) {
    this.client = new Client(options.endpoint);
    this.locator = new RoomLocator(options.endpoint, options.apiPort);
  }

  async join(): Promise<BotPlayer[]> {
    const roomId = await this.locator.resolve(this.options.code);
    const bots: BotPlayer[] = [];
    for (let i = 0; i < this.options.count; ++i) bots.push(await this.joinOne(roomId, i));
    return bots;
  }

  private async joinOne(roomId: string, index: number): Promise<BotPlayer> {
    const playerId = this.options.playerIds?.[index] ?? crypto.randomUUID();
    const room = await this.client.joinById<WitClashState>(roomId, { playerId }, WitClashState);
    await waitFor(() => room.state.roomCode !== "", "the room state", this.timeoutMs());
    const name = this.freeName(room.state);
    room.send(ClientMessage.SET_NAME, name);
    await waitFor(
      () => room.state.players.get(playerId)?.name === name,
      `the name ${name}`,
      this.timeoutMs(),
    );
    return new BotPlayer(room, playerId, name, this.options.bot);
  }

  private freeName(state: WitClashState): string {
    const taken = new Set([...state.players.values()].map((player) => player.name.toLowerCase()));
    let n = 1;
    while (taken.has(`bot ${n}`)) ++n;
    return `Bot ${n}`;
  }

  private timeoutMs(): number {
    return this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }
}

export const joinBots = (options: JoinBotsOptions): Promise<BotPlayer[]> =>
  new BotJoiner(options).join();
