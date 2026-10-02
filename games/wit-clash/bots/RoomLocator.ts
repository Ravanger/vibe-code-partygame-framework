import { ResolveCodeResponseSchema } from "@partygame/shared";

/** Turns a four-letter room code into a room id through the game server's `/api/resolve-code`. */
export class RoomLocator {
  constructor(
    private readonly endpoint: string,
    private readonly apiPort: number,
  ) {}

  async resolve(code: string): Promise<string> {
    const host = new URL(this.endpoint).hostname;
    const response = await fetch(`http://${host}:${this.apiPort}/api/resolve-code?code=${code}`);
    const body = ResolveCodeResponseSchema.safeParse(await response.json());
    if (!body.success) throw new Error("Unexpected reply from the game server");
    if ("roomId" in body.data) return body.data.roomId;
    throw new Error(body.data.error);
  }
}
