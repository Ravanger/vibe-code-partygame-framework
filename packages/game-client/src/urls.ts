import { RoomCodeSchema } from "@partygame/shared";

/** Optional host and ports for {@link resolveEndpoints}, e.g. from `VITE_*` env vars; unset means page host, 2567, 3001. */
export interface EndpointOverrides {
  host?: string | undefined;
  gamePort?: string | undefined;
  apiPort?: string | undefined;
  /** Full game server URL (e.g. `wss://proxy.example/game`); returned verbatim and skips the host/port form. */
  endpoint?: string | undefined;
  /** Base URL of the `/api/resolve-code` API (protocol + host, plus any path prefix); returned verbatim and preferred over `apiPort`. */
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
