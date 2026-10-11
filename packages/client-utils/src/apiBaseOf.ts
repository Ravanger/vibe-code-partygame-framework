/** `http(s)://host:apiPort` for a game server endpoint (`ws:` maps to `http:`, `wss:` to `https:`). */
export const apiBaseOf = (endpoint: string, apiPort: number): string => {
  const url = new URL(endpoint);
  return `${url.protocol === "wss:" ? "https" : "http"}://${url.hostname}:${apiPort}`;
};
