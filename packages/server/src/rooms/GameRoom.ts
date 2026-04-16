import type { GameDefinition, GameVisibilityConfig } from "@partygame/core";
import { buildXStateMachine } from "@partygame/core";
import { GameActionSchema } from "@partygame/shared";
import { type Client, Room } from "colyseus";
import { type AnyActorRef, createActor } from "xstate";
import { GameStateSchema } from "../schema/GameStateSchema.js";
import { PlayerSchema } from "../schema/PlayerSchema.js";
import { RoleBasedStateView } from "./RoleBasedStateView.js";

const logger = {
  info: (message: string, ...args: unknown[]) =>
    console.log(`[GameRoom] INFO: ${message}`, ...args),
  error: (message: string, ...args: unknown[]) =>
    console.error(`[GameRoom] ERROR: ${message}`, ...args),
  debug: (message: string, ...args: unknown[]) =>
    console.debug(`[GameRoom] DEBUG: ${message}`, ...args),
};

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
    logger.info("onCreate called");
    this.setState(new GameStateSchema());

    if (!this.gameDefinition) {
      logger.error("gameDefinition is undefined in onCreate!");
      throw new Error(
        "GameDefinition must be set before onCreate completes. Call setDefinition() in your room class constructor or onCreate().",
      );
    }
    logger.debug("gameDefinition set:", this.gameDefinition.name);

    this.machine = createActor(buildXStateMachine(this.gameDefinition));
    this.machine.start();

    this.onMessage("ACTION", (client, message: unknown) => {
      const parsedAction = GameActionSchema.safeParse(message);
      if (!parsedAction.success) {
        client.send("ERROR", { code: "INVALID_ACTION", message: "Invalid action format" });
        return;
      }

      const state = this.state as GameStateSchema;
      const player = state.players.get(client.sessionId);
      if (!player) return;

      const phase = this.gameDefinition.phases[state.phase];
      if (!phase) return;
      const actionDef = phase.actions[parsedAction.data.type];
      if (!actionDef) return;

      if (actionDef.from !== "player" && player.role !== actionDef.from) {
        client.send("ERROR", { code: "UNAUTHORIZED", message: "Forbidden" });
        return;
      }

      this.machine.send({
        type: "ACTION",
        phase: state.phase,
        name: parsedAction.data.type,
        clientId: client.sessionId,
        role: player.role,
        data: parsedAction.data,
        timestamp: Date.now(),
      });
    });
  }

  onJoin(client: Client) {
    logger.info(`onJoin called for client: ${client.sessionId}`);

    if (!this.gameDefinition) {
      logger.error("gameDefinition is undefined in onJoin!");
      throw new Error(
        "GameDefinition must be set before clients can join. Call setDefinition() in your room class.",
      );
    }

    const state = this.state as GameStateSchema;
    logger.debug(`Current players before join: ${state.players.size}`);

    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.name = `Player ${client.sessionId.slice(0, 4)}`;
    state.players.set(client.sessionId, player);

    logger.debug(`Player created: id=${player.id}, name=${player.name}`);
    logger.debug(`Total players after join: ${state.players.size}`);

    const visibilityConfig = (this.gameDefinition.visibility ||
      {}) as unknown as GameVisibilityConfig<GameStateSchema, PlayerSchema>;

    client.view = new RoleBasedStateView(state, player, visibilityConfig);
    logger.info(`Client ${client.sessionId} joined with view set`);
  }
}
