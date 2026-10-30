import { readCodeParam, resolveEndpoints as resolveFrom } from "@partygame/game-client";

/** Endpoints from the page origin; override with VITE_SERVER_HOST / VITE_GAME_PORT / VITE_API_PORT, or for HTTPS and reverse-proxy deployments with VITE_SERVER_ENDPOINT / VITE_API_BASE. */
export function resolveEndpoints(env: Partial<ImportMetaEnv> = import.meta.env): {
  endpoint: string;
  apiPort: number;
  apiBase?: string;
} {
  return resolveFrom(
    {
      host: env.VITE_SERVER_HOST,
      gamePort: env.VITE_GAME_PORT,
      apiPort: env.VITE_API_PORT,
      endpoint: env.VITE_SERVER_ENDPOINT,
      apiBase: env.VITE_API_BASE,
    },
    window.location.hostname,
    window.location.protocol,
  );
}

/** The room code in `?code=ABCD`, when the page was opened from a share link. */
export const readUrlCode = (search: string = window.location.search): string | undefined =>
  readCodeParam(search, "code");

/** The room code in `?tv=ABCD`, when the page was opened as a TV display. */
export const readUrlTvCode = (search: string = window.location.search): string | undefined =>
  readCodeParam(search, "tv");
