import { type BotKit, type BotOptions, type BotPlayer, joinBots } from "@partygame/bots";
import type { HostedGame } from "@partygame/server";
import { type NodeServerHandle, ServerProbe, startNodeServer } from "@partygame/server/node";
import { joinUrl, tvUrl } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";
import { GameClient, type GameRoomOf } from "./GameClient.js";
import type { Prompter } from "./Prompter.js";

/** One human at a terminal. `run` resolves when they quit or the room goes away. */
export interface SessionPlayer {
  run(): Promise<void>;
  stop(): void;
}

export interface PlaySessionOptions<TState extends BaseGameState> {
  name: string;
  /** Bots to seat once the room exists; 0 for none. */
  bots: number;
  /** Room code to join; a new room is created when omitted. */
  join: string | undefined;
  endpoint: string;
  apiPort: number;
  /** Start a game server on `endpoint`'s port when none answers there. */
  startServer: boolean;
  /** Where the browser client runs; join and TV links are printed only when it answers. */
  clientUrl: string;
  kit: BotKit<TState>;
  /** Hosted by the server this session starts. */
  games: HostedGame[];
  /** Builds the player for the room this session is in. */
  player: (room: GameRoomOf<TState>, playerId: string, io: Prompter) => SessionPlayer;
  /** Create options for a room this session opens; the game's defaults when omitted. */
  roomOptions?: object;
  bot?: BotOptions;
}

/** One terminal player's evening: find or start a server, create or join a room, seat bots, play. */
export class PlaySession<TState extends BaseGameState> {
  private player: SessionPlayer | undefined;
  private stopped = false;

  constructor(
    private readonly options: PlaySessionOptions<TState>,
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

  private async server(): Promise<NodeServerHandle | undefined> {
    const { endpoint, apiPort, startServer, games } = this.options;
    const port = Number(new URL(endpoint).port);
    if (await this.probe.isGameServer(port, apiPort)) {
      this.io.print(`Using the game server on ${endpoint} (API port ${apiPort}).`);
      return undefined;
    }
    if (!startServer)
      throw new Error(`No game server answers on ${endpoint} (API port ${apiPort})`);
    const handle = await startNodeServer({ games, port, apiPort });
    this.io.print(`Started a game server on ports ${port} and ${apiPort}; it stops when you quit.`);
    return handle;
  }

  private async play(): Promise<void> {
    const { name, join, endpoint, apiPort, bots, kit } = this.options;
    const client = new GameClient(endpoint, apiPort, kit);
    const playerId = crypto.randomUUID();
    const room = join
      ? await client.join(join, playerId, name)
      : await client.create(playerId, name, this.options.roomOptions);
    let seated: Promise<BotPlayer<TState>[]> = Promise.resolve([]);
    try {
      const code = room.state.roomCode;
      await this.banner(code, join === undefined);
      const player = this.options.player(room, playerId, this.io);
      this.player = player;
      const playing = player.run();
      if (this.stopped) player.stop();
      if (bots > 0) {
        seated = this.seatBots(code);
        seated.catch(() => undefined);
      }
      await playing;
      await seated;
    } finally {
      const [outcome] = await Promise.allSettled([seated]);
      if (outcome.status === "fulfilled") {
        await Promise.allSettled(outcome.value.map((bot) => bot.leave()));
      }
      await room.leave(true);
    }
  }

  private async seatBots(code: string): Promise<BotPlayer<TState>[]> {
    const { endpoint, apiPort, bots, kit, bot } = this.options;
    const seated = await joinBots({
      stateClass: kit.stateClass,
      strategy: kit.strategy,
      code,
      count: bots,
      endpoint,
      apiPort,
      ...(bot ? { bot } : {}),
    });
    for (const each of seated) this.io.print(`${each.name} joined.`);
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
