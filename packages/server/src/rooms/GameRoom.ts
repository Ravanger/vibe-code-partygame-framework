import type { GameDefinition } from "@partygame/core";
import { buildXStateMachine } from "@partygame/core";
import { GameActionSchema } from "@partygame/shared";
import { type Client, Room } from "colyseus";
import { type AnyActorRef, createActor } from "xstate";
import { GameStateSchema } from "../schema/GameStateSchema.js";
import { PlayerSchema } from "../schema/PlayerSchema.js";
import type { RoomCodeService } from "../services/RoomCodeService.js";

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
  private roomCodeService: RoomCodeService | undefined;

  constructor(roomCodeService?: RoomCodeService) {
    super();
    this.roomCodeService = roomCodeService;
  }

  setDefinition(def: GameDefinition<TState>) {
    this.gameDefinition = def;
  }

  onCreate() {
    logger.info("onCreate called");
    const state = new GameStateSchema();

    // Generate and register room code
    if (this.roomCodeService) {
      const code = this.roomCodeService.generateAndRegister(this.roomId);
      state.roomCode = code;
      logger.debug("Generated room code:", code);
    } else {
      // Fallback for backward compatibility
      state.roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    }

    this.setState(state);
    logger.debug("Room code generated:", state.roomCode);

    if (!this.gameDefinition) {
      logger.error("gameDefinition is undefined in onCreate!");
      throw new Error(
        "GameDefinition must be set before onCreate completes. Call setDefinition() in your room class constructor or onCreate().",
      );
    }
    logger.debug("gameDefinition set:", this.gameDefinition.name);

    this.machine = createActor(buildXStateMachine(this.gameDefinition));
    this.machine.subscribe((snapshot) => {
      logger.debug("Machine state changed:", snapshot.value);
      const state = this.state as GameStateSchema;
      state.phase = snapshot.context.currentPhase;
      state.publicData = JSON.stringify(snapshot.context.gameState);
    });
    this.machine.start();

    this.onMessage("SET_NAME", (client, name: string) => {
      logger.debug(`Received SET_NAME from ${client.sessionId}:`, name);
      const state = this.state as GameStateSchema;
      const player = state.players.get(client.sessionId);
      if (player) {
        player.name = name;
        player.isReady = true;
        logger.info(`Player ${client.sessionId} name set to ${name}`);
      }
    });

    this.onMessage("ACTION", (client, message: unknown) => {
      logger.debug(`Received ACTION from ${client.sessionId}:`, message);
      const parsedAction = GameActionSchema.safeParse(message);
      if (!parsedAction.success) {
        logger.error(`Invalid action format from ${client.sessionId}:`, parsedAction.error);
        client.send("ERROR", { code: "INVALID_ACTION", message: "Invalid action format" });
        return;
      }

      const state = this.state as GameStateSchema;
      const player = state.players.get(client.sessionId);
      if (!player) {
        logger.error(`Player not found for ${client.sessionId}`);
        return;
      }

      const phase = this.gameDefinition.phases[state.phase];
      if (!phase) {
        logger.error(`Phase ${state.phase} not found in game definition`);
        return;
      }
      const actionDef = phase.actions[parsedAction.data.type];
      if (!actionDef) {
        logger.error(`Action ${parsedAction.data.type} not found in phase ${state.phase}`);
        return;
      }

      if (actionDef.from !== "player" && player.role !== actionDef.from) {
        logger.error(`Unauthorized action ${parsedAction.data.type} from ${client.sessionId}`);
        client.send("ERROR", { code: "UNAUTHORIZED", message: "Forbidden" });
        return;
      }

      logger.debug(`Sending action to machine: ${parsedAction.data.type}`);
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

  onJoin(client: Client, options?: Record<string, unknown>) {
    logger.info(`onJoin called for client: ${client.sessionId}`);
    logger.debug(`Options: ${JSON.stringify(options)}`);

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
    player.name = (options?.name as string) || `Player ${client.sessionId.slice(0, 4)}`;
    player.role = state.players.size === 0 ? "host" : "player";
    state.players.set(client.sessionId, player);

    logger.debug(`Player created: id=${player.id}, name=${player.name}, role=${player.role}`);
    logger.debug(`Total players after join: ${state.players.size}`);

    logger.info(`Client ${client.sessionId} joined as ${player.name}`);
  }

  onDispose() {
    logger.info(`OnDispose called for room ${this.roomId}`);
    if (this.roomCodeService) {
      const state = this.state as GameStateSchema;
      this.roomCodeService.unregister(state.roomCode);
    }
  }
}
