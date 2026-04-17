import { assign, createMachine } from "xstate";
import type { GameDefinition } from "./types.js";

export function buildXStateMachine<TState>(gameDef: GameDefinition<TState>) {
  return createMachine({
    id: "game",
    initial: "Lobby",
    context: {
      currentPhase: "Lobby",
      gameState: gameDef.initialState(),
    },
    on: {
      ACTION: {
        actions: [
          assign(({ context, event }) => {
            const phaseDef = gameDef.phases[context.currentPhase];
            if (!phaseDef) return context;

            const actionDef = phaseDef.actions[event.name];
            if (!actionDef) return context;

            // Clone state to avoid direct mutation if needed,
            // but here we might want to mutate it if it's already a proxy or similar.
            // For now, let's assume we can mutate it as it's part of context.
            const nextState = { ...context.gameState };
            actionDef.handler({
              state: nextState,
              clientId: event.clientId,
              data: event.data,
            });

            // If the handler changed the phase in the state, we should reflect it in currentPhase
            // Wait, WitClashState has a 'phase' property. Let's see if we can use it.
            let nextPhase = context.currentPhase;
            const stateWithPhase = nextState as { phase?: string };
            if (stateWithPhase.phase && stateWithPhase.phase !== context.currentPhase) {
              nextPhase = stateWithPhase.phase;
            }

            return {
              gameState: nextState,
              currentPhase: nextPhase,
            };
          }),
        ],
        target: ".checkPhase",
      },
    },
    states: {
      Lobby: {},
      CategorySelection: {},
      Prompting: {},
      Voting: {},
      Results: {},
      checkPhase: {
        always: [
          { target: "Lobby", guard: ({ context }) => context.currentPhase === "Lobby" },
          {
            target: "CategorySelection",
            guard: ({ context }) => context.currentPhase === "CategorySelection",
          },
          { target: "Prompting", guard: ({ context }) => context.currentPhase === "Prompting" },
          { target: "Voting", guard: ({ context }) => context.currentPhase === "Voting" },
          { target: "Results", guard: ({ context }) => context.currentPhase === "Results" },
        ],
      },
    },
  });
}
