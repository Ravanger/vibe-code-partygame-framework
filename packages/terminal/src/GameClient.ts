import type { Room } from "@colyseus/sdk";
import { type BotKit, ColyseusConnector } from "@partygame/bots";
import { claimName } from "@partygame/client-utils";
import type { BaseGameState } from "@partygame/shared/schema";

export type GameRoomOf<TState extends BaseGameState> = Room<unknown, TState>;

/** Creates, joins and watches rooms of one game on one game server. */
export class GameClient<TState extends BaseGameState> {
  private readonly connector: ColyseusConnector<TState>;

  constructor(
    endpoint: string,
    apiPort: number,
    game: Pick<BotKit<TState>, "roomName" | "stateClass">,
  ) {
    this.connector = new ColyseusConnector(endpoint, apiPort, game);
  }

  /** Opens a room and claims `name` in it; `options` are the room's create options. */
  async create(playerId: string, name: string, options: object = {}): Promise<GameRoomOf<TState>> {
    const room = await this.connector.create({
      ...options,
      playerId,
      seatSecret: crypto.randomUUID() + crypto.randomUUID(),
    });
    await claimName(room, playerId, name);
    return room;
  }

  /** Joins the room with `code` and claims `name`; rejects for an unknown code or a taken name. */
  async join(code: string, playerId: string, name: string): Promise<GameRoomOf<TState>> {
    return this.connector.join(code, { playerId, name });
  }

  watch(code: string, playerId: string): Promise<GameRoomOf<TState>> {
    return this.connector.join(code, { playerId, spectator: true });
  }
}
