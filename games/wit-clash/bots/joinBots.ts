import { Client } from "@colyseus/sdk";
import { ClientMessage } from "@partygame/shared";
import { WitClashState } from "../src/state.js";
import { type BotOptions, BotPlayer } from "./BotPlayer.js";
import { RoomLocator } from "./RoomLocator.js";

export interface JoinBotsOptions {
  code: string;
  count: number;
  endpoint: string;
  apiPort: number;
  bot?: BotOptions;
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
    for (let i = 0; i < this.options.count; ++i) bots.push(await this.joinOne(roomId));
    return bots;
  }

  private async joinOne(roomId: string): Promise<BotPlayer> {
    const playerId = crypto.randomUUID();
    const room = await this.client.joinById<WitClashState>(roomId, { playerId }, WitClashState);
    await this.until(() => room.state.roomCode !== "", "the room state");
    const name = this.freeName(room.state);
    room.send(ClientMessage.SET_NAME, name);
    await this.until(() => room.state.players.get(playerId)?.name === name, `the name ${name}`);
    return new BotPlayer(room, playerId, name, this.options.bot);
  }

  private freeName(state: WitClashState): string {
    const taken = new Set([...state.players.values()].map((player) => player.name.toLowerCase()));
    let n = 1;
    while (taken.has(`bot ${n}`)) ++n;
    return `Bot ${n}`;
  }

  private async until(predicate: () => boolean, what: string): Promise<void> {
    const deadline = Date.now() + (this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
}

export const joinBots = (options: JoinBotsOptions): Promise<BotPlayer[]> =>
  new BotJoiner(options).join();
