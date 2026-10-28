import { fireEvent } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { SoundPolicy, type SoundStorage } from "../src/SoundPolicy.svelte.js";

const memoryStorage = (): SoundStorage => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
};

const throwingStorage: SoundStorage = {
  getItem: () => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("denied");
  },
};

const policy = (storage: SoundStorage = memoryStorage(), prefix = "g") =>
  new SoundPolicy({ storage, storagePrefix: prefix, target: window });

describe("SoundPolicy", () => {
  it("is off and locked by default", () => {
    const p = policy();
    expect(p.enabled).toBe(false);
    expect(p.unlocked).toBe(false);
    expect(p.canPlay).toBe(false);
  });

  it("can play only once sound is on AND a first gesture has happened", () => {
    const p = policy();
    p.toggle();
    expect([p.enabled, p.unlocked, p.canPlay]).toEqual([true, false, false]);
    fireEvent.pointerDown(window);
    expect([p.enabled, p.unlocked, p.canPlay]).toEqual([true, true, true]);
  });

  it("unlocks on keydown as well", () => {
    const p = policy();
    p.toggle();
    fireEvent.keyDown(window);
    expect(p.canPlay).toBe(true);
  });

  it("stops allowing playback when turned off after unlocking", () => {
    const p = policy();
    p.toggle();
    fireEvent.pointerDown(window);
    p.toggle();
    expect([p.enabled, p.unlocked, p.canPlay]).toEqual([false, true, false]);
  });

  it("persists the toggle across a new instance under the prefixed key", () => {
    const storage = memoryStorage();
    const first = policy(storage);
    first.toggle();
    expect(storage.getItem("g.sound")).toBe("1");
    expect(policy(storage).enabled).toBe(true);
    policy(storage).toggle();
    expect(policy(storage).enabled).toBe(false);
    expect(storage.getItem("g.sound")).toBe("0");
  });

  it("does not share the toggle across prefixes", () => {
    const storage = memoryStorage();
    policy(storage, "g").toggle();
    expect(policy(storage, "h").enabled).toBe(false);
  });

  it("leaves enabled false without error when the storage throws", () => {
    const p = policy(throwingStorage);
    expect(p.enabled).toBe(false);
    expect(() => p.toggle()).not.toThrow();
    expect(p.enabled).toBe(true);
  });
});
