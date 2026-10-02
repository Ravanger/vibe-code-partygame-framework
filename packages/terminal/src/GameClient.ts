import { Client, type Room } from "@colyseus/sdk";
import { apiBaseOf, type BotKit, claimName } from "@partygame/bots";
import { resolveRoomCode, waitFor } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";

export type GameRoomOf<TState extends BaseGameState> = Room<unknown, TState>;

const STEP_TIMEOUT_MS = 5000;

/** Creates, joins and watches rooms of one game on one game server. */
export class GameClient<TState extends BaseGameState> {
  private readonly client: Client;
  private readonly apiBase: string;

  constructor(
    endpoint: string,
    apiPort: number,
    private readonly game: Pick<BotKit<TState>, "roomName" | "stateClass">,
  ) {
    this.client = new Client(endpoint);
    this.apiBase = apiBaseOf(endpoint, apiPort);
  }

  /** Opens a room and claims `name` in it; `options` are the room's create options. */
  async create(playerId: string, name: string, options: object = {}): Promise<GameRoomOf<TState>> {
    const room = await this.client.create<TState>(
      this.game.roomName,
      { playerId, ...options },
      this.game.stateClass,
    );
    await claimName(room, playerId, name);
    return room;
  }

  /** Joins the room with `code` and claims `name`; rejects for an unknown code or a taken name. */
  async join(code: string, playerId: string, name: string): Promise<GameRoomOf<TState>> {
    const room = await this.enter(code, { playerId });
    await claimName(room, playerId, name);
    return room;
  }

  watch(code: string, playerId: string): Promise<GameRoomOf<TState>> {
    return this.enter(code, { playerId, spectator: true });
  }

  private async enter(code: string, options: object): Promise<GameRoomOf<TState>> {
    const roomId = await resolveRoomCode(this.apiBase, code);
    const room = await this.client.joinById<TState>(roomId, options, this.game.stateClass);
    await waitFor(() => room.state.roomCode !== "", "the room state", STEP_TIMEOUT_MS);
    return room;
  }
}
