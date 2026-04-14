import { Room, type Client } from "colyseus";
import { createActor, type AnyActorRef } from "xstate";
import { GameStateSchema } from "../schema/GameStateSchema.js";
import { buildXStateMachine } from "@partygame/core";

export class GameRoom extends Room<GameStateSchema> {
  private machine!: AnyActorRef;

  onCreate() {
    this.setState(new GameStateSchema());
    
    // Minimal mock for now to get integration going
    const machine = buildXStateMachine({
        name: "test",
        minPlayers: 1,
        maxPlayers: 2,
        initialState: () => ({}),
        phases: {}
    });

    this.machine = createActor(machine);
    this.machine.subscribe((snapshot) => {
        const ctx = snapshot.context as { currentPhase: string };
        this.state.phase = ctx.currentPhase;
    });
    this.machine.start();
  }
}
