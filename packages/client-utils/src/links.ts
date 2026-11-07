/** Link that joins room `code` from the client at `base` (e.g. `http://192.168.1.5:5173/`). */
export const joinUrl = (base: string, code: string): string => {
  const url = new URL(base);
  url.searchParams.set("code", code);
  return url.toString();
};

/** Link that opens room `code` as a TV display. */
export const tvUrl = (base: string, code: string): string => {
  const url = new URL(base);
  url.searchParams.set("tv", code);
  return url.toString();
};
