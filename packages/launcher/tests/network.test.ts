import { EventEmitter } from "node:events";
import type { NetworkInterfaceInfo } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { type BrowserSpawner, lanUrls, openBrowser } from "../src/network.js";

const spawned = vi.hoisted(() => {
  const calls: string[][] = [];
  return { calls };
});
vi.mock("node:child_process", () => ({
  spawn: (file: string, args: string[]) => {
    spawned.calls.push([file, ...args]);
    return { on: () => undefined, unref: () => undefined };
  },
}));

const address = (
  value: string,
  family: "IPv4" | "IPv6",
  internal: boolean,
): NetworkInterfaceInfo => ({
  address: value,
  netmask: "255.255.255.0",
  family,
  mac: "00:00:00:00:00:00",
  internal,
  cidr: null,
  scopeid: 0,
});

describe("lanUrls", () => {
  it("lists external IPv4 addresses only", () => {
    const urls = lanUrls(5173, {
      lo: [address("127.0.0.1", "IPv4", true)],
      eth0: [address("192.168.1.5", "IPv4", false), address("fe80::1", "IPv6", false)],
      down: undefined,
    });
    expect(urls).toEqual(["http://192.168.1.5:5173"]);
  });

  it("reads the machine's interfaces by default", () => {
    expect(Array.isArray(lanUrls(1))).toBe(true);
  });
});

class FakeChild extends EventEmitter {
  unreffed = false;
  unref(): void {
    this.unreffed = true;
  }
}

const fakeSpawn = () => {
  const calls: Array<{ file: string; args: string[] }> = [];
  const child = new FakeChild();
  const spawnFn: BrowserSpawner = (file, args) => {
    calls.push({ file, args });
    return child;
  };
  return { calls, child, spawnFn };
};

describe("openBrowser", () => {
  it.each([
    ["win32", "cmd", ["/c", "start", "", "http://x"]],
    ["darwin", "open", ["http://x"]],
    ["linux", "xdg-open", ["http://x"]],
  ] as const)("opens the URL on %s", (platform, file, args) => {
    const fake = fakeSpawn();
    openBrowser("http://x", { spawnFn: fake.spawnFn, platform });
    expect(fake.calls).toEqual([{ file, args }]);
    expect(fake.child.unreffed).toBe(true);
  });

  it("ignores a missing opener when nobody listens", () => {
    const fake = fakeSpawn();
    openBrowser("http://x", { spawnFn: fake.spawnFn });
    expect(() => fake.child.emit("error", new Error("ENOENT"))).not.toThrow();
  });

  it("reports a missing opener to onError", () => {
    const fake = fakeSpawn();
    const errors: string[] = [];
    openBrowser("http://x", { spawnFn: fake.spawnFn, onError: () => errors.push("failed") });
    fake.child.emit("error", new Error("ENOENT"));
    expect(errors).toEqual(["failed"]);
  });

  it("uses child_process.spawn by default", () => {
    openBrowser("http://x", { platform: "linux" });
    expect(spawned.calls).toEqual([["xdg-open", "http://x"]]);
  });
});
