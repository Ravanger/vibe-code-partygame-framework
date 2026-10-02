import { resolveRoomCode } from "@partygame/shared";

/** Turns a four-letter room code into a room id through the game server's `/api/resolve-code`. */
export class RoomLocator {
  constructor(
    private readonly endpoint: string,
    private readonly apiPort: number,
  ) {}

  async resolve(code: string): Promise<string> {
    return resolveRoomCode(`http://${new URL(this.endpoint).hostname}:${this.apiPort}`, code);
  }
}
