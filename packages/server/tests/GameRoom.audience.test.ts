import { MatchMakeError } from "@colyseus/sdk";
import {
  type ActionResult,
  CLIENT_MESSAGES,
  ClientMessage,
  ErrorCode,
  ServerMessage,
} from "@partygame/shared";
import { afterEach, describe, expect, it } from "vitest";
import { collectMessages, type TestServer, waitUntil } from "../src/testing/index.js";
import { bootPoll, pollStateOf, startedPoll } from "./support.js";

let t: TestServer | undefined;
afterEach(async () => {
  await t?.shutdown();
  t = undefined;
});

const spectatorError: ActionResult = {
  ok: false,
  error: { code: ErrorCode.UNAUTHORIZED, message: CLIENT_MESSAGES.UNAUTHORIZED },
};

describe("GameRoom audience actions", () => {
  it("counts a spectator's vote in the synced state", async () => {
    t = await bootPoll();
    const { room } = await startedPoll(t);
    const spec = await t.join(room, { playerId: "aud-0001", spectator: true });
    expect(
      await spec.request<unknown, ActionResult>(ClientMessage.ACTION, {
        type: "VOTE",
        option: "a",
      }),
    ).toEqual({ ok: true });
    await waitUntil(() => pollStateOf(room).votesA === 1, "the vote was counted");
    expect(pollStateOf(room).votesB).toBe(0);
  });

  it("refuses a repeat vote for the same join playerId, even after a reconnect", async () => {
    t = await bootPoll();
    const { room } = await startedPoll(t);
    const spec = await t.join(room, { playerId: "aud-0001", spectator: true });
    expect(
      await spec.request<unknown, ActionResult>(ClientMessage.ACTION, {
        type: "VOTE",
        option: "a",
      }),
    ).toEqual({ ok: true });
    const errors = collectMessages(spec, ServerMessage.ERROR);
    expect(
      await spec.request<unknown, ActionResult>(ClientMessage.ACTION, {
        type: "VOTE",
        option: "a",
      }),
    ).toMatchObject({ ok: false, error: { code: ErrorCode.NOT_ALLOWED } });
    await waitUntil(() => errors.length === 1, "the refusal was pushed");
    expect(errors[0]).toMatchObject({ code: ErrorCode.NOT_ALLOWED, action: "VOTE" });
    // a reconnect with the same join playerId keeps the used scope within the phase
    await spec.leave();
    const back = await t.join(room, { playerId: "aud-0001", spectator: true });
    expect(
      await back.request<unknown, ActionResult>(ClientMessage.ACTION, {
        type: "VOTE",
        option: "a",
      }),
    ).toMatchObject({ ok: false, error: { code: ErrorCode.NOT_ALLOWED } });
    expect(pollStateOf(room).votesA).toBe(1);
  });

  it("clears the used scopes when the phase changes", async () => {
    t = await bootPoll();
    const { room, p1 } = await startedPoll(t);
    const spec = await t.join(room, { playerId: "aud-0001", spectator: true });
    expect(
      await spec.request<unknown, ActionResult>(ClientMessage.ACTION, {
        type: "VOTE",
        option: "a",
      }),
    ).toEqual({ ok: true });
    p1.client.send(ClientMessage.ACTION, { type: "TALLY" });
    await waitUntil(() => pollStateOf(room).phase === "Tally", "tallied");
    p1.client.send(ClientMessage.ACTION, { type: "REOPEN" });
    await waitUntil(() => pollStateOf(room).phase === "Play", "reopened");
    expect(
      await spec.request<unknown, ActionResult>(ClientMessage.ACTION, {
        type: "VOTE",
        option: "a",
      }),
    ).toEqual({ ok: true });
    expect(pollStateOf(room).votesA).toBe(2);
  });

  it("still refuses a player action and a malformed envelope with the spectator error", async () => {
    t = await bootPoll();
    const { room } = await startedPoll(t);
    const spec = await t.join(room, { playerId: "aud-0001", spectator: true });
    const errors = collectMessages(spec, ServerMessage.ERROR);
    expect(
      await spec.request<unknown, ActionResult>(ClientMessage.ACTION, { type: "TAP" }),
    ).toEqual(spectatorError);
    expect(
      await spec.request<unknown, ActionResult>(ClientMessage.ACTION, { noType: true }),
    ).toEqual(spectatorError);
    await waitUntil(() => errors.length === 2, "both refusals were pushed");
    expect(pollStateOf(room).taps).toBe(0);
  });

  it("rejects a spectator join once the audience slots are full", async () => {
    t = await bootPoll({ audienceSlots: 2 });
    const { room } = await startedPoll(t); // the single seat
    await t.join(room, { playerId: "aud-0001", spectator: true });
    await t.join(room, { playerId: "aud-0002", spectator: true });
    let rejection: unknown;
    try {
      await t.join(room, { playerId: "aud-0003", spectator: true });
    } catch (error) {
      rejection = error;
    }
    expect(rejection).toBeInstanceOf(MatchMakeError);
    const full = rejection as MatchMakeError;
    // Colyseus locks a room's listing the moment it reaches maxClients, so a full audience
    // surfaces as a matchmake refusal (522 MATCHMAKE_INVALID_ROOM_ID), not a join close code.
    expect(full.message).toMatch(/is locked$/);
    expect(full.code).toBe(522);
    expect(pollStateOf(room).spectatorCount).toBe(2);
  });

  it("rate-limits a spectator's actions on its own per-connection bucket", async () => {
    t = await bootPoll({ rateLimits: { action: { rate: 1, burst: 2 } } });
    const { room } = await startedPoll(t);
    const spec = await t.join(room, { playerId: "aud-0001", spectator: true });
    expect(
      await spec.request<unknown, ActionResult>(ClientMessage.ACTION, {
        type: "VOTE",
        option: "a",
      }),
    ).toEqual({ ok: true });
    expect(
      await spec.request<unknown, ActionResult>(ClientMessage.ACTION, {
        type: "VOTE",
        option: "b",
      }),
    ).toEqual({ ok: true });
    const errors = collectMessages(spec, ServerMessage.ERROR);
    expect(
      await spec.request<unknown, ActionResult>(ClientMessage.ACTION, {
        type: "VOTE",
        option: "a",
      }),
    ).toMatchObject({ ok: false, error: { code: ErrorCode.RATE_LIMITED } });
    await waitUntil(
      () => errors.some((message) => (message as { code?: unknown })?.code === "RATE_LIMITED"),
      "the refusal was pushed",
    );
    // a second spectator has its own bucket
    const other = await t.join(room, { playerId: "aud-0002", spectator: true });
    expect(
      await other.request<unknown, ActionResult>(ClientMessage.ACTION, {
        type: "VOTE",
        option: "a",
      }),
    ).toEqual({ ok: true });
  });

  it("answers a throwing audience action with the fixed failure result", async () => {
    t = await bootPoll();
    const { room } = await startedPoll(t);
    const spec = await t.join(room, { playerId: "aud-0001", spectator: true });
    expect(
      await spec.request<unknown, ActionResult>(ClientMessage.ACTION, { type: "BOOM" }),
    ).toEqual({
      ok: false,
      error: { code: ErrorCode.INTERNAL, message: CLIENT_MESSAGES.INTERNAL },
    });
  });
});
