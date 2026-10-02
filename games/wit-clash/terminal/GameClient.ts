import { Client, type Room } from "@colyseus/sdk";
import { apiBaseOf, claimName } from "@partygame/bots";
import { resolveRoomCode, waitFor } from "@partygame/shared";
import type { WitClashOptions } from "../src/options.js";
import { ROOM_NAME } from "../src/roomName.js";
import { WitClashState } from "../src/state.js";

const STEP_TIMEOUT_MS = 5000;

/** Creates, joins and watches WitClash rooms on one game server. */
export class GameClient {
  private readonly client: Client;
  private readonly apiBase: string;

  constructor(endpoint: string, apiPort: number) {
    this.client = new Client(endpoint);
    this.apiBase = apiBaseOf(endpoint, apiPort);
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
    await claimName(room, playerId, name);
    return room;
  }

  async join(code: string, playerId: string, name: string): Promise<Room<WitClashState>> {
    const room = await this.enter(code, { playerId });
    await claimName(room, playerId, name);
    return room;
  }

  watch(code: string, playerId: string): Promise<Room<WitClashState>> {
    return this.enter(code, { playerId, spectator: true });
  }

  private async enter(code: string, options: object): Promise<Room<WitClashState>> {
    const roomId = await resolveRoomCode(this.apiBase, code);
    const room = await this.client.joinById<WitClashState>(roomId, options, WitClashState);
    await waitFor(() => room.state.roomCode !== "", "the room state", STEP_TIMEOUT_MS);
    return room;
  }
}
