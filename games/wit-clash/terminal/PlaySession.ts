import { type BotOptions, type BotPlayer, joinBots } from "@partygame/bots";
import { joinUrl, tvUrl } from "@partygame/shared";
import { witClashKit } from "../bots/witClashBot.js";
import type { CategoryRepository } from "../src/content/CategoryRepository.js";
import type { WitClashOptions } from "../src/options.js";
import type { WitClashState } from "../src/state.js";
import { GameClient } from "./GameClient.js";
import { GameServerHandle } from "./GameServerHandle.js";
import type { Prompter } from "./Prompter.js";
import { ServerProbe } from "./ServerProbe.js";
import { TerminalPlayer } from "./TerminalPlayer.js";

export interface PlayOptions {
  name: string;
  /** Bots to seat once the room exists; 0 for none. */
  bots: number;
  /** Room code to join; a new room is created when omitted. */
  join: string | undefined;
  endpoint: string;
  apiPort: number;
  /** Start a game server on `endpoint`'s port when none answers there. */
  startServer: boolean;
  categories: CategoryRepository;
  clientUrl: string;
  /** Options for a room this session creates; the game's defaults when omitted. */
  roomOptions?: Partial<WitClashOptions>;
  bot: BotOptions;
}

/** One terminal player's evening: find or start a server, create or join a room, seat bots, play. */
export class PlaySession {
  private player: TerminalPlayer | undefined;
  private stopped = false;

  constructor(
    private readonly options: PlayOptions,
    private readonly io: Prompter,
    private readonly probe: ServerProbe = new ServerProbe(),
  ) {}

  /** Ends the game for this player; `run` then cleans up and returns. */
  stop(): void {
    this.stopped = true;
    this.player?.stop();
  }

  async run(): Promise<void> {
    const server = await this.server();
    try {
      await this.play();
    } finally {
      await server?.stop();
    }
  }

  private async server(): Promise<GameServerHandle | undefined> {
    const { endpoint, apiPort, startServer } = this.options;
    const port = Number(new URL(endpoint).port);
    if (await this.probe.isGameServer(port, apiPort)) {
      this.io.print(`Using the game server on ${endpoint} (API port ${apiPort}).`);
      return undefined;
    }
    if (!startServer)
      throw new Error(`No game server answers on ${endpoint} (API port ${apiPort})`);
    const handle = new GameServerHandle(this.options.categories, { port, apiPort });
    await handle.start();
    this.io.print(`Started a game server on ports ${port} and ${apiPort}; it stops when you quit.`);
    return handle;
  }

  private async play(): Promise<void> {
    const { name, join, endpoint, apiPort, bots } = this.options;
    const client = new GameClient(endpoint, apiPort);
    const playerId = crypto.randomUUID();
    const room = join
      ? await client.join(join, playerId, name)
      : await client.create(playerId, name, this.options.roomOptions);
    try {
      const code = room.state.roomCode;
      await this.banner(code, join === undefined);
      const player = new TerminalPlayer(room, playerId, this.io);
      this.player = player;
      const playing = player.run();
      if (this.stopped) player.stop();
      const seated = bots > 0 ? this.seatBots(code) : Promise.resolve([]);
      await playing;
      await Promise.all((await seated).map((bot) => bot.leave()));
    } finally {
      await room.leave(true);
    }
  }

  private async seatBots(code: string): Promise<BotPlayer<WitClashState>[]> {
    const { endpoint, apiPort, bots } = this.options;
    const seated = await joinBots({
      ...witClashKit(),
      code,
      count: bots,
      endpoint,
      apiPort,
      bot: this.options.bot,
    });
    for (const bot of seated) this.io.print(`${bot.name} joined.`);
    return seated;
  }

  private async banner(code: string, created: boolean): Promise<void> {
    const { clientUrl } = this.options;
    this.io.print(
      `${created ? "Room" : "Joined room"} ${code}${created ? " (you are the host)" : ""}`,
    );
    if (!created || !(await this.probe.answers(clientUrl))) return;
    this.io.print(`Browser players can join at ${joinUrl(`${clientUrl}/`, code)}`);
    this.io.print(`TV view: ${tvUrl(`${clientUrl}/`, code)}`);
  }
}
