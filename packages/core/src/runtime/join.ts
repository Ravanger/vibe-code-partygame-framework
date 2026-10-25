import type { CanJoinInput, CanJoinResult } from "./types.js";

const JOIN_REFUSED_CODE = "JOIN_REFUSED";
const JOIN_REFUSED_MESSAGE = "You cannot join this room.";
/** Refusal messages are trimmed and capped at this many characters. */
const MESSAGE_MAX_LENGTH = 200;

/** The part of a game definition that gates joins: its optional synchronous `canJoin` hook. */
export interface JoinGate {
  canJoin?(input: CanJoinInput): CanJoinResult;
}

/**
 * Runs the definition's `canJoin` hook over one join attempt and normalises the outcome: no hook
 * accepts; a refusal message is trimmed and capped at 200 characters; a throwing hook yields the
 * generic `JOIN_REFUSED` refusal instead of crashing the join. Pure and synchronous, so replays
 * and tests see the same decision.
 */
export function evaluateJoin(definition: JoinGate, input: CanJoinInput): CanJoinResult {
  const hook = definition.canJoin;
  if (hook === undefined) return { ok: true };
  let result: CanJoinResult;
  try {
    result = hook(input);
  } catch {
    return { ok: false, code: JOIN_REFUSED_CODE, message: JOIN_REFUSED_MESSAGE };
  }
  if (result.ok) return { ok: true };
  return {
    ok: false,
    code: result.code,
    message: result.message.trim().slice(0, MESSAGE_MAX_LENGTH),
  };
}
