import { type Component, mount } from "svelte";

/**
 * Saves the answer to `manager.exportReplay()` as a JSON file download: a refusal (`ok: false`)
 * sends nothing; otherwise the bundle is downloaded as `<name>-replay.json`, where `<name>` is the
 * bundle's game name lower-cased, or `replay` when it has none. Pass a document to redirect the
 * download (tests); the global one is used by default.
 */
export function downloadReplay(response: Record<string, unknown>, doc: Document = document): void {
  if (response.ok === false) return;
  const name = typeof response.name === "string" ? response.name : "replay";
  const blob = new Blob([JSON.stringify(response)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = `${name.toLowerCase()}-replay.json`;
  doc.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Mounts `viewer` on `target` when the current URL carries a `?replay` parameter (the offline
 * viewer route), so a game's entry point no longer inlines the query check. Returns whether it
 * mounted; without the parameter the target is left alone and the caller mounts its app instead.
 */
export function mountReplayIfRequested<TProps extends Record<string, unknown>>(
  viewer: Component<TProps>,
  target: HTMLElement,
  props: TProps,
): boolean {
  if (!new URLSearchParams(window.location.search).has("replay")) return false;
  mount(viewer, { target, props });
  return true;
}
