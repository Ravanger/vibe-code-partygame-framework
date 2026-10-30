import { Client, type Room } from "@colyseus/sdk";
import {
  claimName,
  type RoomConnector,
  type RoomCreateOptions,
  type RoomJoinOptions,
  waitFor,
} from "@partygame/client-utils";
import { PROTOCOL_VERSION } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";
import type { BotKit } from "./types.js";

const DEFAULT_TIMEOUT_MS = 5000;

/** `RoomConnector` over a real game server: one Colyseus client for every room it opens. */
export class ColyseusConnector<TState extends BaseGameState> implements RoomConnector<TState> {
  private readonly client: Client;

  constructor(
    endpoint: string,
    /** The game's room name and state class; `roomName` is only needed to create rooms. */
    private readonly game: Pick<BotKit<TState>, "stateClass"> & { roomName?: string },
  ) {
    this.client = new Client(endpoint);
  }

  async create(options: RoomCreateOptions): Promise<Room<unknown, TState>> {
    const roomName = this.game.roomName;
    if (roomName === undefined) throw new Error("ColyseusConnector.create needs a roomName");
    return this.client.create<TState>(
      roomName,
      { ...options, protocolVersion: PROTOCOL_VERSION },
      this.game.stateClass,
    );
  }

  async join(roomId: string, options: RoomJoinOptions): Promise<Room<unknown, TState>> {
    const { playerId, name, timeoutMs, ...joinOptions } = options;
    const room = await this.client.joinById<TState>(
      roomId,
      {
        ...joinOptions,
        playerId,
        seatSecret: crypto.randomUUID() + crypto.randomUUID(),
        protocolVersion: PROTOCOL_VERSION,
      },
      this.game.stateClass,
    );
    // The SDK leaves room.state undefined until the first sync lands; poll it as if absent.
    await waitFor(
      () => (room.state?.roomCode ?? "") !== "",
      "the room state",
      timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    if (name !== undefined) await claimName(room, playerId, name);
    return room;
  }
}
