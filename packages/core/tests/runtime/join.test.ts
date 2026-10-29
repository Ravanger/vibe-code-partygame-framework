import { describe, expect, it } from "vitest";
import { evaluateJoin } from "../../src/index.js";
import type { CanJoinInput, CanJoinResult, PlayerInfo } from "../../src/runtime/types.js";

const roster = (): PlayerInfo[] => [
  { id: "p1", name: "Ada", role: "host", isConnected: true, isReady: true, isActive: true },
];

const input = (over: Partial<CanJoinInput> = {}): CanJoinInput => ({
  playerId: "p2",
  spectator: false,
  joinData: {},
  roster: roster(),
  ...over,
});

describe("evaluateJoin", () => {
  it("accepts when the definition has no canJoin hook", () => {
    expect(evaluateJoin({}, input())).toEqual({ ok: true });
  });

  it("yields the refusal a rejecting hook returns", () => {
    const definition = {
      canJoin: (_input: CanJoinInput): CanJoinResult => ({
        ok: false,
        code: "ROOM_LOCKED",
        message: "The room is locked",
      }),
    };
    expect(evaluateJoin(definition, input())).toEqual({
      ok: false,
      code: "ROOM_LOCKED",
      message: "The room is locked",
    });
  });

  it("accepts when the hook says so, including for spectators", () => {
    const definition = { canJoin: (_input: CanJoinInput): CanJoinResult => ({ ok: true }) };
    expect(evaluateJoin(definition, input({ spectator: true }))).toEqual({ ok: true });
  });

  it("hands joinData, roster and the spectator flag to the hook", () => {
    let seen: CanJoinInput | undefined;
    const definition = {
      canJoin: (i: CanJoinInput): CanJoinResult => {
        seen = i;
        return { ok: true };
      },
    };
    const joinData = { invite: "abc", seats: 3, vip: true };
    evaluateJoin(definition, input({ playerId: "p9", name: "Bo", spectator: true, joinData }));
    expect(seen).toEqual({
      playerId: "p9",
      name: "Bo",
      spectator: true,
      joinData,
      roster: roster(),
    });
  });

  it("converts a throwing hook to the generic refusal without crashing", () => {
    const definition = {
      canJoin: (_input: CanJoinInput): CanJoinResult => {
        throw new Error("boom");
      },
    };
    expect(evaluateJoin(definition, input())).toEqual({
      ok: false,
      code: "JOIN_REFUSED",
      message: "You cannot join this room.",
    });
  });

  it("falls back to the generic message when a refusal message is whitespace-only", () => {
    const definition = {
      canJoin: (_input: CanJoinInput): CanJoinResult => ({
        ok: false,
        code: "ROOM_LOCKED",
        message: " \t\n ",
      }),
    };
    expect(evaluateJoin(definition, input())).toEqual({
      ok: false,
      code: "ROOM_LOCKED",
      message: "You cannot join this room.",
    });
  });

  it("trims and caps a refusal message at 200 characters", () => {
    const long = "x".repeat(250);
    const definition = {
      canJoin: (_input: CanJoinInput): CanJoinResult => ({
        ok: false,
        code: "NOT_INVITED",
        message: `  ${long}  `,
      }),
    };
    expect(evaluateJoin(definition, input())).toEqual({
      ok: false,
      code: "NOT_INVITED",
      message: "x".repeat(200),
    });
  });
});
