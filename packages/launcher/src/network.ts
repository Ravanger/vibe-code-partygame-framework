import { spawn } from "node:child_process";
import { type NetworkInterfaceInfo, networkInterfaces } from "node:os";

/** What `openBrowser` needs from `child_process.spawn`. */
export type BrowserSpawner = (
  file: string,
  args: string[],
  options: { stdio: "ignore"; detached: true },
) => { on(event: "error", listener: () => void): unknown; unref(): void };

/** `http://<address>:<port>` for every external IPv4 address of this machine. */
export function lanUrls(
  port: number,
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces(),
): string[] {
  return Object.values(interfaces)
    .flatMap((addresses) => addresses ?? [])
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => `http://${address.address}:${port}`);
}

export interface OpenBrowserOptions {
  spawnFn?: BrowserSpawner;
  platform?: NodeJS.Platform;
  /** Called when the opener cannot start. */
  onError?: () => void;
}

export function openBrowser(url: string, options: OpenBrowserOptions = {}): void {
  const { spawnFn = spawn, platform = process.platform, onError } = options;
  const opener =
    platform === "win32"
      ? { file: "cmd", args: ["/c", "start", "", url] }
      : { file: platform === "darwin" ? "open" : "xdg-open", args: [url] };
  const child = spawnFn(opener.file, opener.args, { stdio: "ignore", detached: true });
  child.on("error", () => onError?.());
  child.unref();
}
