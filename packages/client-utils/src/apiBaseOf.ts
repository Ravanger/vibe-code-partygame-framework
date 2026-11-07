/** `http(s)://host:apiPort` for a game server endpoint: `wss:` and `https:` map to `https`, `ws:` and `http:` to `http`. */
export const apiBaseOf = (endpoint: string, apiPort: number): string => {
  const url = new URL(endpoint);
  const scheme = url.protocol === "wss:" || url.protocol === "https:" ? "https" : "http";
  return `${scheme}://${url.hostname}:${apiPort}`;
};
