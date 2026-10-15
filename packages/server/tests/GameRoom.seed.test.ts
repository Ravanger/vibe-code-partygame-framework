import { required, type Seed, sfc32 } from "@partygame/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TestServer } from "../src/testing/index.js";
import { bootBuzzer, startedRoom, stateOf } from "./support.js";

const seedOf = (draw: Uint32Array | undefined): Seed => {
  const view = new DataView(required(draw, "seed draw").buffer);
  const word = (i: number): number => view.getUint32(i * 4, true);
  return [word(0), word(1), word(2), word(3)];
};

let t: TestServer | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  await t?.shutdown();
  t = undefined;
});

describe("GameRoom seed", () => {
  it("draws a fresh 128-bit seed per room and drives the room rng from it", async () => {
    t = await bootBuzzer();
    const spy = vi.spyOn(globalThis.crypto, "getRandomValues");
    const { room } = await startedRoom(t);
    await t.createRoom("buzzer");
    const seeds = spy.mock.results
      .map((r) => r.value)
      .filter((v): v is Uint32Array => v instanceof Uint32Array && v.length === 4);
    expect(seeds).toHaveLength(2);
    expect(seedOf(seeds[1])).not.toEqual(seedOf(seeds[0]));
    expect(stateOf(room).lucky).toBe(Math.floor(sfc32(seedOf(seeds[0]))() * 1000));
  });
});
