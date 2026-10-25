import { type ActionResult, ClientMessage } from "@partygame/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type TestServer, waitUntil } from "../src/testing/index.js";
import { bootBuzzer, pid, sleep, startedRoom, stateOf } from "./support.js";

let t: TestServer | undefined;
afterEach(async () => {
  await t?.shutdown();
  t = undefined;
});

const rateLimitedResult = (result: ActionResult): boolean =>
  result.ok === false && result.error.code === "RATE_LIMITED";

/** A pushed framework `ERROR` with code RATE_LIMITED, not a game message of the same name. */
const rateLimitedPush = (message: unknown): boolean =>
  typeof message === "object" &&
  message !== null &&
  "code" in message &&
  (message as { code: unknown }).code === "RATE_LIMITED";

describe("GameRoom rate limits", () => {
  it("refuses actions past the burst with RATE_LIMITED, pushed and answered, leaving other players alone", async () => {
    t = await bootBuzzer({ rateLimits: { action: { rate: 1, burst: 3 } } });
    const { p1, p2 } = await startedRoom(t);
    const results: ActionResult[] = [];
    for (let i = 0; i < 5; ++i) {
      results.push(
        await p1.client.request<unknown, ActionResult>(ClientMessage.ACTION, { type: "JUNK" }),
      );
    }
    expect(results.slice(0, 3).every((result) => result.ok === true)).toBe(true);
    expect(results.slice(3).every(rateLimitedResult)).toBe(true);
    await waitUntil(
      () => p1.errors.filter(rateLimitedPush).length === 2,
      "the refusals were pushed as ERROR",
    );
    // a second player has its own bucket
    expect(
      await p2.client.request<unknown, ActionResult>(ClientMessage.ACTION, { type: "JUNK" }),
    ).toEqual({ ok: true });
  });

  it("lets the same player act again after the refill time", async () => {
    t = await bootBuzzer({ rateLimits: { action: { rate: 10, burst: 1 } } });
    const { p1 } = await startedRoom(t);
    expect(
      await p1.client.request<unknown, ActionResult>(ClientMessage.ACTION, { type: "JUNK" }),
    ).toEqual({ ok: true });
    expect(
      rateLimitedResult(
        await p1.client.request<unknown, ActionResult>(ClientMessage.ACTION, { type: "JUNK" }),
      ),
    ).toBe(true);
    await sleep(150); // 10/s refills one token after 100 ms
    expect(
      await p1.client.request<unknown, ActionResult>(ClientMessage.ACTION, { type: "JUNK" }),
    ).toEqual({ ok: true });
  });

  it("keeps the bucket across a reconnect of the same playerId", async () => {
    t = await bootBuzzer({ rateLimits: { action: { rate: 0, burst: 1 } } }); // never refills
    const { room, p1 } = await startedRoom(t);
    expect(
      await p1.client.request<unknown, ActionResult>(ClientMessage.ACTION, { type: "JUNK" }),
    ).toEqual({ ok: true });
    await p1.client.leave(false); // abnormal drop: the seat is held for reconnection
    await waitUntil(
      () => stateOf(room).players.get(pid(1))?.isConnected === false,
      "marked disconnected",
    );
    const back = await t.join(room, { playerId: pid(1) });
    await waitUntil(() => stateOf(room).players.get(pid(1))?.isConnected === true, "reattached");
    expect(
      rateLimitedResult(
        await back.request<unknown, ActionResult>(ClientMessage.ACTION, { type: "JUNK" }),
      ),
    ).toBe(true);
  });

  it("refuses nothing in observe mode and reports each hit through console.warn", async () => {
    t = await bootBuzzer({ rateLimits: { action: { rate: 0, burst: 1 }, mode: "observe" } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { p1 } = await startedRoom(t);
      expect(
        await p1.client.request<unknown, ActionResult>(ClientMessage.ACTION, { type: "JUNK" }),
      ).toEqual({ ok: true });
      expect(
        await p1.client.request<unknown, ActionResult>(ClientMessage.ACTION, { type: "JUNK" }),
      ).toEqual({ ok: true }); // over the limit, but only observed
      expect(warn.mock.calls.some(([message]) => String(message).includes(pid(1)))).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });

  it("throttles SET_NAME on its own bucket and leaves actions alone", async () => {
    t = await bootBuzzer({ rateLimits: { setName: { rate: 0, burst: 2 } } });
    const { room, p1 } = await startedRoom(t); // seat() already spent one of the two tokens
    p1.client.send(ClientMessage.SET_NAME, "A");
    await waitUntil(() => stateOf(room).players.get(pid(1))?.name === "A", "renamed");
    p1.client.send(ClientMessage.SET_NAME, "B");
    await waitUntil(() => p1.errors.some(rateLimitedPush), "the refusal was pushed as ERROR");
    expect(stateOf(room).players.get(pid(1))?.name).toBe("A"); // the refused name did not land
    expect(
      await p1.client.request<unknown, ActionResult>(ClientMessage.ACTION, { type: "JUNK" }),
    ).toEqual({ ok: true });
  });
});
