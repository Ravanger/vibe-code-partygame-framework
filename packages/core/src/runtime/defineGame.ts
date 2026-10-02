import {
  ACTION_NAME_PATTERN,
  END_GAME,
  KICK_PLAYER,
  LOBBY_PHASE,
  SET_OPTIONS,
  START_GAME,
} from "@partygame/shared";
import type { ActionDefinition, GameDefinition, PhaseState } from "./types.js";

const PHASE_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const RESERVED_ACTIONS: readonly string[] = [START_GAME, KICK_PLAYER, SET_OPTIONS, END_GAME];

/** Thrown by {@link defineGame}; the message lists every problem found. */
export class GameDefinitionError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid game definition:\n- ${problems.join("\n- ")}`);
    this.name = "GameDefinitionError";
  }
}

/**
 * Validates a game definition and returns it unchanged, typed.
 * @throws {GameDefinitionError} listing every problem.
 */
export function defineGame<
  TState extends PhaseState,
  TPrivate = Record<string, never>,
  TOptions = Record<string, unknown>,
>(spec: GameDefinition<TState, TPrivate, TOptions>): GameDefinition<TState, TPrivate, TOptions> {
  const problems: string[] = [];
  if (!spec.name) problems.push("name must not be empty");
  if (!Number.isInteger(spec.minPlayers) || spec.minPlayers < 1) {
    problems.push("minPlayers must be an integer >= 1");
  }
  if (spec.maxPlayers < spec.minPlayers) problems.push("maxPlayers must be >= minPlayers");
  if (!(spec.startPhase in spec.phases)) {
    problems.push(`startPhase "${spec.startPhase}" is not a declared phase`);
  }
  for (const [name, phase] of Object.entries(spec.phases)) {
    if (name === LOBBY_PHASE) problems.push(`"${LOBBY_PHASE}" is reserved and built in`);
    else if (!PHASE_NAME.test(name)) problems.push(`phase name "${name}" is invalid`);
    if (phase.duration !== undefined && !phase.onTimeout) {
      problems.push(`phase "${name}" has a duration but no onTimeout`);
    }
    for (const action of Object.keys(phase.actions ?? {})) {
      if (RESERVED_ACTIONS.includes(action)) problems.push(`${action} is reserved and built in`);
      else if (!ACTION_NAME_PATTERN.test(action))
        problems.push(`action name "${action}" is invalid`);
    }
  }
  if (problems.length > 0) throw new GameDefinitionError(problems);
  return spec;
}

/**
 * Binds the state, private-state and options types once so each action infers its payload from its zod schema.
 * @example const action = actionFactory<State, Priv, Options>();
 */
export function actionFactory<TState extends PhaseState, TPrivate, TOptions>() {
  return <TPayload>(
    spec: ActionDefinition<TState, TPrivate, TOptions, TPayload>,
  ): ActionDefinition<TState, TPrivate, TOptions, TPayload> => spec;
}
