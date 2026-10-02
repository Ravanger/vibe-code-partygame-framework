import type { Room } from "@colyseus/sdk";
import { waitFor } from "@partygame/shared";
import type { BotOptions, BotPlayer } from "../bots/BotPlayer.js";
import { joinBots } from "../bots/joinBots.js";
import type { WitClashOptions } from "../src/options.js";
import { PHASE } from "../src/phaseNames.js";
import type { WitClashState } from "../src/state.js";
import { GameClient } from "./GameClient.js";
import { HostBot } from "./HostBot.js";

export const DEMO_ROOM_OPTIONS: WitClashOptions = {
  totalRounds: 2,
  categoryVoteSeconds: 8,
  promptSeconds: 20,
  voteSeconds: 8,
  revealSeconds: 6,
};

export const DEMO_BOT_OPTIONS: BotOptions = {
  answerDelayMs: [2000, 9000],
  voteDelayMs: [1000, 4000],
};

export const DEMO_NEXT_ROUND_MS = 8000;

export interface DemoTableOptions {
  endpoint: string;
  apiPort: number;
  /** Bots besides the host bot. */
  bots: number;
  room?: Partial<WitClashOptions>;
  bot?: BotOptions;
  nextRoundDelayMs?: number;
}

const HOST_NAME = "Host Bot";

/** A watch-only room played by bots: the host bot starts it and advances every round, then stops at the final results. */
export class DemoTable {
  private readonly hostId = crypto.randomUUID();
  private readonly botIds: string[];
  private host: HostBot | undefined;
  private hostRoom: Room<WitClashState> | undefined;
  private bots: BotPlayer[] = [];

  constructor(private readonly options: DemoTableOptions) {
    this.botIds = Array.from({ length: options.bots }, () => crypto.randomUUID());
  }

  /** Creates the room and its host bot; returns the room code. */
  async open(): Promise<string> {
    const { endpoint, apiPort, room, bot, nextRoundDelayMs = 0 } = this.options;
    const hostRoom = await new GameClient(endpoint, apiPort).create(this.hostId, HOST_NAME, {
      ...DEMO_ROOM_OPTIONS,
      ...room,
      seats: [this.hostId, ...this.botIds],
    });
    this.hostRoom = hostRoom;
    this.host = new HostBot(hostRoom, this.hostId, HOST_NAME, {
      ...bot,
      nextRoundDelayMs,
      expectedPlayers: this.options.bots + 1,
    });
    return hostRoom.state.roomCode;
  }

  async seatBots(): Promise<BotPlayer[]> {
    const room = this.hostRoom;
    if (!room) throw new Error("The table is not open");
    this.bots = await joinBots({
      code: room.state.roomCode,
      count: this.options.bots,
      endpoint: this.options.endpoint,
      apiPort: this.options.apiPort,
      playerIds: this.botIds,
      ...(this.options.bot ? { bot: this.options.bot } : {}),
    });
    return this.bots;
  }

  /** Resolves once the game sits on the final results. */
  async finished(timeoutMs = Number.POSITIVE_INFINITY): Promise<void> {
    const room = this.hostRoom;
    if (!room) throw new Error("The table is not open");
    await waitFor(
      () => room.state.phase === PHASE.Results && room.state.isFinalRound,
      "the final results",
      timeoutMs,
      100,
    );
  }

  async leave(): Promise<void> {
    const host = this.host;
    this.host = undefined;
    await Promise.allSettled([host?.leave(), ...this.bots.splice(0).map((bot) => bot.leave())]);
  }
}
