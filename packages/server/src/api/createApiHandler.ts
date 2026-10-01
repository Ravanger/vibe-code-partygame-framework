import { RoomCodeSchema } from "@partygame/shared";
import type { RoomCodeService } from "../services/RoomCodeService.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/** `GET /api/resolve-code?code=ABCD` -> `{ roomId }`. Everything else is 404/405; every response carries CORS headers. */
export function createApiHandler(
  roomCodeService: Pick<RoomCodeService, "resolve">,
): (req: Request) => Response {
  return (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    const url = new URL(req.url);
    if (url.pathname !== "/api/resolve-code") return json(404, { error: "Not found" });
    if (req.method !== "GET") return json(405, { error: "Method not allowed" });
    const code = RoomCodeSchema.safeParse(url.searchParams.get("code"));
    if (!code.success) {
      return json(400, { error: "Invalid code format. Must be 4 uppercase letters." });
    }
    const roomId = roomCodeService.resolve(code.data);
    return roomId ? json(200, { roomId }) : json(404, { error: "Game code not found" });
  };
}
