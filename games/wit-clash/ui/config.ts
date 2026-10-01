import { RoomCodeSchema } from "@partygame/shared";

/**
 * Resolve server endpoints from the page's own origin so that a phone opening
 * http://192.168.1.50:5173 talks to 192.168.1.50:2567 rather than its own localhost.
 * Override with VITE_SERVER_HOST / VITE_GAME_PORT / VITE_API_PORT.
 */
export function resolveEndpoints(env: Partial<ImportMetaEnv> = import.meta.env): {
  endpoint: string;
  apiPort: number;
} {
  const host = env.VITE_SERVER_HOST ?? window.location.hostname;
  const gamePort = env.VITE_GAME_PORT ?? "2567";
  const apiPort = Number(env.VITE_API_PORT ?? 3001);
  return { endpoint: `http://${host}:${gamePort}`, apiPort };
}

function readCode(param: string, search: string): string | undefined {
  const code = new URLSearchParams(search).get(param)?.toUpperCase();
  return RoomCodeSchema.safeParse(code).success ? code : undefined;
}

/** The room code in `?code=ABCD`, when the page was opened from a share link. */
export function readUrlCode(search: string = window.location.search): string | undefined {
  return readCode("code", search);
}

/** The room code in `?tv=ABCD`, when the page was opened as a TV display. */
export function readUrlTvCode(search: string = window.location.search): string | undefined {
  return readCode("tv", search);
}
