import { RoomCodeSchema } from "@partygame/shared";

/** Optional host and ports for {@link resolveEndpoints}, e.g. from `VITE_*` env vars; unset means page host, 2567, 3001. */
export interface EndpointOverrides {
  host?: string | undefined;
  gamePort?: string | undefined;
  apiPort?: string | undefined;
}

/**
 * Server endpoints from the page's own host, so a phone opening http://192.168.1.50:5173 talks to
 * 192.168.1.50:2567 rather than its own localhost.
 */
export function resolveEndpoints(
  overrides: EndpointOverrides,
  pageHost: string,
): { endpoint: string; apiPort: number } {
  const host = overrides.host ?? pageHost;
  return {
    endpoint: `http://${host}:${overrides.gamePort ?? "2567"}`,
    apiPort: Number(overrides.apiPort ?? 3001),
  };
}

/** The room code in `?<param>=ABCD`, upper-cased, when it is a valid code. */
export function readCodeParam(search: string, param: string): string | undefined {
  const code = new URLSearchParams(search).get(param)?.toUpperCase();
  return RoomCodeSchema.safeParse(code).success ? code : undefined;
}
