import { readCodeParam, resolveEndpoints as resolveFrom } from "@partygame/game-client";

/** Endpoints from the page origin; override with VITE_SERVER_HOST / VITE_GAME_PORT / VITE_API_PORT. */
export function resolveEndpoints(env: Partial<ImportMetaEnv> = import.meta.env): {
  endpoint: string;
  apiPort: number;
} {
  return resolveFrom(
    { host: env.VITE_SERVER_HOST, gamePort: env.VITE_GAME_PORT, apiPort: env.VITE_API_PORT },
    window.location.hostname,
  );
}

/** The room code in `?code=ABCD`, when the page was opened from a share link. */
export const readUrlCode = (search: string = window.location.search): string | undefined =>
  readCodeParam(search, "code");

/** The room code in `?tv=ABCD`, when the page was opened as a TV display. */
export const readUrlTvCode = (search: string = window.location.search): string | undefined =>
  readCodeParam(search, "tv");
