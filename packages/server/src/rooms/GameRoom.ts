import { buildXStateMachine } from "@partygame/core";
import type { GameDefinition, GameVisibilityConfig } from "@partygame/core";
import { type Client, Room } from "colyseus";
import { type AnyActorRef, createActor } from "xstate";
import { GameStateSchema } from "../schema/GameStateSchema.js";
import type { PlayerSchema } from "../schema/PlayerSchema.js";
import { RoleBasedStateView } from "./RoleBasedStateView.js";

const _CloseCode = {
  CONSENTED: 4000,
  WITH_ERROR: 4001,
} as const;

export class GameRoom<TState = unknown> extends Room {
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
      const state = this.state as GameStateSchema;
      const player = state.players.get(client.sessionId);
      if (!player) return;

      const phase = this.gameDefinition.phases[state.phase];
      if (!phase) return;
      const actionDef = phase.actions[message.name];
      if (!actionDef) return;

      if (actionDef.from !== "player" && player.role !== actionDef.from) {
        client.send("ERROR", { code: "UNAUTHORIZED", message: "Forbidden" });
        return;
      }

      this.machine.send({
        type: "ACTION",
        phase: state.phase,
        name: message.name,
        clientId: client.sessionId,
        role: player.role,
        data: message.data,
        timestamp: Date.now(),
      });
    });
  }

  onJoin(client: Client) {
    const state = this.state as GameStateSchema;
    const player = state.players.get(client.sessionId);
    if (!player) return;

    const visibilityConfig = (this.gameDefinition.visibility ||
      {}) as unknown as GameVisibilityConfig<GameStateSchema, PlayerSchema>;

    client.view = new RoleBasedStateView(state, player, visibilityConfig);
  }
}
