import { describe, expect, it } from "vitest";
import {
  ACTION_NAME_PATTERN,
  ActionEnvelopeSchema,
  ClientMessage,
  ErrorCode,
  isActionResult,
  isServerError,
  JoinOptionsSchema,
  KICK_PLAYER,
  LOBBY_PHASE,
  PlayerIdSchema,
  ResolveCodeResponseSchema,
  RoomCodeSchema,
  SET_OPTIONS,
  ServerMessage,
  SetNameSchema,
  START_GAME,
} from "../src/index.js";

describe("protocol constants", () => {
  it("exposes message names, lobby phase and start action", () => {
    expect(ClientMessage).toEqual({ SET_NAME: "SET_NAME", ACTION: "ACTION" });
    expect(ServerMessage).toEqual({ ERROR: "ERROR" });
    expect(LOBBY_PHASE).toBe("Lobby");
    expect(START_GAME).toBe("START_GAME");
    expect(KICK_PLAYER).toBe("KICK_PLAYER");
    expect(SET_OPTIONS).toBe("SET_OPTIONS");
  });

  it("lists every error code as its own name", () => {
    for (const [key, value] of Object.entries(ErrorCode)) expect(value).toBe(key);
    expect(Object.keys(ErrorCode).sort()).toEqual(
      [
        "INTERNAL",
        "INVALID_ACTION",
        "KICKED",
        "NAME_TAKEN",
        "NOT_ACTIVE",
        "NOT_ALLOWED",
        "NOT_ENOUGH_PLAYERS",
        "UNAUTHORIZED",
        "UNKNOWN_ACTION",
        "WRONG_PHASE",
      ].sort(),
    );
  });
});

describe("ACTION_NAME_PATTERN", () => {
  it("accepts SCREAMING_SNAKE_CASE up to 64 characters", () => {
    expect(ACTION_NAME_PATTERN.test("CAST_VOTE_2")).toBe(true);
    expect(ACTION_NAME_PATTERN.test(`A${"B".repeat(63)}`)).toBe(true);
    expect(ACTION_NAME_PATTERN.test(`A${"B".repeat(64)}`)).toBe(false);
    expect(ACTION_NAME_PATTERN.test("castVote")).toBe(false);
    expect(ACTION_NAME_PATTERN.test("2FAST")).toBe(false);
  });
});

describe("ActionEnvelopeSchema", () => {
  it("accepts SCREAMING_SNAKE_CASE types and keeps extra fields", () => {
    const parsed = ActionEnvelopeSchema.parse({ type: "CAST_VOTE", answerId: "a1" });
    expect(parsed).toEqual({ type: "CAST_VOTE", answerId: "a1" });
  });

  it.each(["", "lower", "1ABC", "A-B", "A".repeat(65)])("rejects type %j", (type) => {
    expect(ActionEnvelopeSchema.safeParse({ type }).success).toBe(false);
  });

  it("rejects a missing type", () => {
    expect(ActionEnvelopeSchema.safeParse({}).success).toBe(false);
  });
});

describe("SetNameSchema", () => {
  it("trims", () => expect(SetNameSchema.parse("  Ada  ")).toBe("Ada"));
  it("rejects blank", () => expect(SetNameSchema.safeParse("   ").success).toBe(false));
  it("rejects too long", () => expect(SetNameSchema.safeParse("x".repeat(21)).success).toBe(false));
});

describe("RoomCodeSchema", () => {
  it("accepts four capital letters", () =>
    expect(RoomCodeSchema.safeParse("ABCD").success).toBe(true));
  it.each(["ABC", "abcd", "AB1D", "ABCDE"])("rejects %j", (code) => {
    expect(RoomCodeSchema.safeParse(code).success).toBe(false);
  });
});

describe("PlayerIdSchema", () => {
  it("accepts 8 to 64 characters", () => {
    expect(PlayerIdSchema.safeParse("a".repeat(8)).success).toBe(true);
    expect(PlayerIdSchema.safeParse("a".repeat(64)).success).toBe(true);
  });
  it("rejects outside the range", () => {
    expect(PlayerIdSchema.safeParse("a".repeat(7)).success).toBe(false);
    expect(PlayerIdSchema.safeParse("a".repeat(65)).success).toBe(false);
  });
});

describe("JoinOptionsSchema", () => {
  it("requires a valid playerId and allows optional name and spectator", () => {
    expect(JoinOptionsSchema.safeParse({ playerId: "a".repeat(8) }).success).toBe(true);
    expect(
      JoinOptionsSchema.parse({ playerId: "a".repeat(8), name: "Ada", spectator: true }),
    ).toEqual({ playerId: "a".repeat(8), name: "Ada", spectator: true });
    expect(JoinOptionsSchema.safeParse({}).success).toBe(false);
    expect(JoinOptionsSchema.safeParse({ playerId: "short" }).success).toBe(false);
  });
});

describe("isServerError", () => {
  it("accepts a code and message, with or without an action", () => {
    expect(isServerError({ code: "WRONG_PHASE", message: "no" })).toBe(true);
    expect(isServerError({ code: "KICKED", message: "bye", action: "X" })).toBe(true);
  });
  it("rejects anything else", () => {
    for (const bad of [
      null,
      "x",
      {},
      { code: "WRONG_PHASE" },
      { code: "NOPE", message: "m" },
      { code: 4, message: "m" },
      { code: "WRONG_PHASE", message: 4 },
      { code: "WRONG_PHASE", message: "m", action: 4 },
    ]) {
      expect(isServerError(bad)).toBe(false);
    }
  });
});

describe("isActionResult", () => {
  it("accepts both outcomes", () => {
    expect(isActionResult({ ok: true })).toBe(true);
    expect(isActionResult({ ok: false, error: { code: "INTERNAL", message: "m" } })).toBe(true);
  });
  it("rejects anything else", () => {
    for (const bad of [null, 1, {}, { ok: "yes" }, { ok: false }, { ok: false, error: {} }]) {
      expect(isActionResult(bad)).toBe(false);
    }
  });
});

describe("ResolveCodeResponseSchema", () => {
  it("is a room id or an error message", () => {
    expect(ResolveCodeResponseSchema.parse({ roomId: "r1" })).toEqual({ roomId: "r1" });
    expect(ResolveCodeResponseSchema.parse({ error: "nope" })).toEqual({ error: "nope" });
    expect(ResolveCodeResponseSchema.safeParse({ other: 1 }).success).toBe(false);
  });
});
