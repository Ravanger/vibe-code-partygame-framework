/**
 * Resolve server endpoints from the page's own origin so that a phone opening
 * http://192.168.1.50:5173 talks to 192.168.1.50:2567 rather than its own localhost.
 * Override with VITE_SERVER_HOST / VITE_GAME_PORT / VITE_API_PORT.
 *
 * @param env - Environment variables (defaults to import.meta.env). Parameterized for testability.
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

/**
 * Read minPlayers from VITE_MIN_PLAYERS (default 3).
 * Standalone so it can be called once and injected into WaitingRoomViewModel
 * rather than read inline from import.meta.env (which is untestable).
 *
 * @param env - Environment variables (defaults to import.meta.env). Parameterized for testability.
 */
export function readMinPlayers(env: Partial<ImportMetaEnv> = import.meta.env): number {
  const parsed = Number(env.VITE_MIN_PLAYERS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}
