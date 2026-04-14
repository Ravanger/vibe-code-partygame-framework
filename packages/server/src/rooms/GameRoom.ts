import { RoleBasedStateView } from "./RoleBasedStateView.js";
import { type AnyActorRef, createActor } from "xstate";
import { GameStateSchema } from "../schema/GameStateSchema.js";
import { buildXStateMachine } from "@partygame/core";
import { type GameDefinition } from "@partygame/core";
import { type Client, Room } from "colyseus";

export class GameRoom<TState = unknown> extends Room<GameStateSchema> {
  private machine!: AnyActorRef;
  private gameDefinition!: GameDefinition<TState>;

  setDefinition(def: GameDefinition<TState>) {
    this.gameDefinition = def;
  }

  onCreate() {
    this.setState(new GameStateSchema());

    this.machine = createActor(buildXStateMachine(this.gameDefinition));
    this.machine.start();

    this.onMessage("ACTION", (client, message: { name: string; data: unknown }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const phase = this.gameDefinition.phases[this.state.phase];
      if (!phase) return;
      const actionDef = phase.actions[message.name];
      if (!actionDef) return;

      if (actionDef.from !== "player" && player.role !== actionDef.from) {
        client.send("ERROR", { code: "UNAUTHORIZED", message: "Forbidden" });
        return;
      }

      this.machine.send({
        type: "ACTION",
        phase: this.state.phase,
        name: message.name,
        clientId: client.sessionId,
        role: player.role,
        data: message.data,
        timestamp: Date.now(),
      });
    });
  }

  onJoin(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    
    client.view = new RoleBasedStateView(this.state, player, this.gameDefinition.visibility || {});
  }
}
