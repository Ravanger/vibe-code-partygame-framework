import { RoomCodeSchema } from "@partygame/shared";
import type { RoomCodeService } from "../services/RoomCodeService.js";

/** Origins allowed to read the API by default: loopback on any port (the dev client). */
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:*", "http://127.0.0.1:*", "http://[::1]:*"];

/** CORS headers shared by every response that carries them. */
const CORS_METHODS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** True when `origin` matches `allowed`: exactly, or against a `scheme://host:*` pattern (any port). `"*"` allows everything. */
function originAllowed(origin: string, allowed: string[] | "*"): boolean {
  if (allowed === "*") return true;
  return allowed.some((pattern) => {
    if (pattern === origin) return true;
    const prefix = pattern.endsWith(":*") ? pattern.slice(0, -1) : undefined;
    return prefix !== undefined && origin.startsWith(prefix);
  });
}

/** CORS headers for one request: the allowed origin echoed with `Vary`, `*`, or none. */
function corsHeadersFor(
  origin: string | null,
  allowedOrigins: string[] | "*",
): Record<string, string> {
  if (origin === null || !originAllowed(origin, allowedOrigins)) return {};
  const allowOrigin = allowedOrigins === "*" ? "*" : origin;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    ...(allowedOrigins === "*" ? {} : { Vary: "Origin" }),
    ...CORS_METHODS_HEADERS,
  };
}

function json(status: number, body: unknown, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** What the HTTP entries pass alongside the request; the resolve-code throttle keys on the address. */
export interface ApiRequestInfo {
  /** Remote address of the caller (an IPv4/IPv6 literal). */
  remoteAddress?: string;
}

/** Options for {@link createApiHandler}. */
export interface ApiHandlerOptions {
  /**
   * Origins allowed to read the API: exact origins or `scheme://host:*` patterns, `"*"` for all.
   * Defaults to loopback only. A disallowed origin gets no CORS headers (the browser blocks it).
   */
  allowedOrigins?: string[] | "*";
}

/** `GET /api/resolve-code?code=ABCD` -> `{ roomId }`. Everything else is 404/405; CORS headers go out only for allowed origins. */
export function createApiHandler(
  roomCodeService: Pick<RoomCodeService, "resolve">,
  options: ApiHandlerOptions = {},
): (req: Request, info?: ApiRequestInfo) => Response {
  const allowedOrigins = options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
  return (req) => {
    const corsHeaders = corsHeadersFor(req.headers.get("origin"), allowedOrigins);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    const url = new URL(req.url);
    if (url.pathname !== "/api/resolve-code") return json(404, { error: "Not found" }, corsHeaders);
    if (req.method !== "GET") return json(405, { error: "Method not allowed" }, corsHeaders);
    const code = RoomCodeSchema.safeParse(url.searchParams.get("code"));
    if (!code.success) {
      return json(400, { error: "Invalid code format. Must be 4 uppercase letters." }, corsHeaders);
    }
    const roomId = roomCodeService.resolve(code.data);
    return roomId
      ? json(200, { roomId }, corsHeaders)
      : json(404, { error: "Game code not found" }, corsHeaders);
  };
}
