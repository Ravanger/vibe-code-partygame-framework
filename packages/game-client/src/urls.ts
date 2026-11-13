import { RoomCodeSchema } from "@partygame/shared";

/** Optional host and ports for {@link resolveEndpoints}, e.g. from `VITE_*` env vars; unset means page host, 2567, 3001. */
export interface EndpointOverrides {
  host?: string | undefined;
  gamePort?: string | undefined;
  apiPort?: string | undefined;
  /** Full game server URL (e.g. `wss://proxy.example/game`); returned verbatim and skips the host/port form. */
  endpoint?: string | undefined;
  /** Base URL of the room-code API; the client appends exactly `/api/resolve-code`, so a bare origin reaches an API that answers at `/api/resolve-code`. Returned verbatim and preferred over `apiPort`. */
  apiBase?: string | undefined;
}

/**
 * Server endpoints from the page's own host, so a phone opening http://192.168.1.50:5173 talks to
 * 192.168.1.50:2567 rather than its own localhost. `pageProtocol` (the page's
 * `window.location.protocol`, e.g. `"https:"`) keeps the endpoint on the page's scheme, so an HTTPS
 * page is not stuck with a mixed-content `http://` endpoint.
 */
export function resolveEndpoints(
  overrides: EndpointOverrides,
  pageHost: string,
  pageProtocol: string = "http:",
): { endpoint: string; apiPort: number; apiBase?: string } {
  const host = overrides.host ?? pageHost;
  return {
    endpoint: overrides.endpoint ?? `${pageProtocol}//${host}:${overrides.gamePort ?? "2567"}`,
    apiPort: Number(overrides.apiPort ?? 3001),
    ...(overrides.apiBase === undefined ? {} : { apiBase: overrides.apiBase }),
  };
}

/** The room code in `?<param>=ABCD`, upper-cased, when it is a valid code. */
export function readCodeParam(search: string, param: string): string | undefined {
  const code = new URLSearchParams(search).get(param)?.toUpperCase();
  return RoomCodeSchema.safeParse(code).success ? code : undefined;
}

/** The `VITE_*` keys a game client reads from its build env; unset means page host and the standard ports. */
export interface ClientEnv {
  /** Host of the game server, e.g. `192.168.1.50`. */
  VITE_SERVER_HOST?: string | undefined;
  /** Port of the game server (default 2567). */
  VITE_GAME_PORT?: string | undefined;
  /** Port of the room-code API (default 3001). */
  VITE_API_PORT?: string | undefined;
  /** Full game server URL (e.g. `wss://proxy.example/game`); returned verbatim and skips the host/port form. */
  VITE_SERVER_ENDPOINT?: string | undefined;
  /** Base URL of the room-code API; returned verbatim and preferred over `VITE_API_PORT`. */
  VITE_API_BASE?: string | undefined;
  /** Other build-env keys (e.g. vite's own `MODE`, `BASE_URL`); ignored by the client config. */
  [key: string]: string | undefined;
}

/** The room code in `?code=ABCD`, when the page was opened from a share link. */
export const readUrlCode = (search: string = window.location.search): string | undefined =>
  readCodeParam(search, "code");

/** The room code in `?tv=ABCD`, when the page was opened as a TV display. */
export const readUrlTvCode = (search: string = window.location.search): string | undefined =>
  readCodeParam(search, "tv");

/**
 * Client config for a game's `main.ts`: `resolveEndpoints` from the page origin with the
 * `VITE_*` overrides of `env`, plus {@link readUrlCode} and {@link readUrlTvCode}. Pass
 * `import.meta.env`; its typing stays at the call site.
 */
export function clientConfig(env: ClientEnv = {}): {
  resolveEndpoints: () => { endpoint: string; apiPort: number; apiBase?: string };
  readUrlCode: (search?: string) => string | undefined;
  readUrlTvCode: (search?: string) => string | undefined;
} {
  return {
    resolveEndpoints: () =>
      resolveEndpoints(
        {
          host: env.VITE_SERVER_HOST,
          gamePort: env.VITE_GAME_PORT,
          apiPort: env.VITE_API_PORT,
          endpoint: env.VITE_SERVER_ENDPOINT,
          apiBase: env.VITE_API_BASE,
        },
        window.location.hostname,
        window.location.protocol,
      ),
    readUrlCode,
    readUrlTvCode,
  };
}
