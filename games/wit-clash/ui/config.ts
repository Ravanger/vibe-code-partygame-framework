/**
 * Resolve server endpoints from the page's own origin so that a phone opening
 * http://192.168.1.50:5173 talks to 192.168.1.50:2567 rather than its own localhost.
 * Override with VITE_SERVER_HOST / VITE_GAME_PORT / VITE_API_PORT.
 */
export function resolveEndpoints(): { endpoint: string; apiPort: number } {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  const host = env.VITE_SERVER_HOST ?? window.location.hostname;
  const gamePort = env.VITE_GAME_PORT ?? "2567";
  const apiPort = Number(env.VITE_API_PORT ?? 3001);
  return { endpoint: `http://${host}:${gamePort}`, apiPort };
}
