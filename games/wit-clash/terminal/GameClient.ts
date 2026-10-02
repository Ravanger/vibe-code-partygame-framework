import { Client, type Room } from "@colyseus/sdk";
import { ClientMessage, isServerError, ServerMessage, waitFor } from "@partygame/shared";
import { RoomLocator } from "../bots/RoomLocator.js";
import type { WitClashOptions } from "../src/options.js";
import { ROOM_NAME } from "../src/roomName.js";
import { WitClashState } from "../src/state.js";

const STEP_TIMEOUT_MS = 5000;

/** The part of a room that choosing a name needs. */
export interface SeatRoom {
  readonly state: WitClashState;
  onMessage(type: string, callback: (payload: unknown) => void): unknown;
  send(type: string, payload?: unknown): void;
}

/** Creates, joins and watches WitClash rooms on one game server. */
export class GameClient {
  private readonly client: Client;
  private readonly locator: RoomLocator;

  constructor(endpoint: string, apiPort: number) {
    this.client = new Client(endpoint);
    this.locator = new RoomLocator(endpoint, apiPort);
  }

  async create(
    playerId: string,
    name: string,
    options: Partial<WitClashOptions> & { seats?: string[] } = {},
  ): Promise<Room<WitClashState>> {
    const room = await this.client.create<WitClashState>(
      ROOM_NAME,
      { playerId, ...options },
      WitClashState,
    );
    await this.claimName(room, playerId, name);
    return room;
  }

  async join(code: string, playerId: string, name: string): Promise<Room<WitClashState>> {
    const room = await this.enter(code, { playerId });
    await this.claimName(room, playerId, name);
    return room;
  }

  watch(code: string, playerId: string): Promise<Room<WitClashState>> {
    return this.enter(code, { playerId, spectator: true });
  }

  private async enter(code: string, options: object): Promise<Room<WitClashState>> {
    const roomId = await this.locator.resolve(code);
    const room = await this.client.joinById<WitClashState>(roomId, options, WitClashState);
    await waitFor(() => room.state.roomCode !== "", "the room state", STEP_TIMEOUT_MS);
    return room;
  }

  /** Sends `SET_NAME` and waits until the seat carries it; throws the server's reason when refused. */
  async claimName(room: SeatRoom, playerId: string, name: string): Promise<void> {
    await waitFor(() => room.state.roomCode !== "", "the room state", STEP_TIMEOUT_MS);
    let refusal = "";
    room.onMessage(ServerMessage.ERROR, (payload: unknown) => {
      if (isServerError(payload)) refusal = payload.message;
    });
    room.send(ClientMessage.SET_NAME, name);
    await waitFor(
      () => refusal !== "" || room.state.players.get(playerId)?.name === name,
      "your name to be accepted",
      STEP_TIMEOUT_MS,
    );
    if (refusal !== "") throw new Error(refusal);
  }
}
