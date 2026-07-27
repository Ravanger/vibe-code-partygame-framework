import { Server } from "@colyseus/core";
import type { GameDefinition } from "@partygame/core";
import type { CategoryRepository } from "../../../games/wit-clash/src/content/CategoryRepository.js";
import { DEFAULT_DURATIONS, GameRoom, type PhaseDurations } from "./rooms/GameRoom.js";
import type { RoomCodeService } from "./services/RoomCodeService.js";

// Re-export for convenience
export {
  DEFAULT_DURATIONS,
  type PhaseDurations,
  TEST_DURATIONS,
} from "./rooms/GameRoom.js";

export interface GameServerDeps<TState = unknown> {
  categories: CategoryRepository;
  roomCodeService?: RoomCodeService;
  durations?: PhaseDurations;
  gameDefinition?: GameDefinition<TState>;
  /**
   * Omit in tests. Vitest runs on Node, where importing @colyseus/bun-websockets
   * throws "Cannot find package 'bun'" (see HELPERS.md section 1c). Passing no transport lets
   * Colyseus use its bundled default, which works under both Node and Bun.
   */
  transport?: unknown;
}

export function createGameServer<TState = unknown>(deps: GameServerDeps<TState>): Server {
  const gameDefinition = deps.gameDefinition;
  // @ts-expect-error - transport type is complex and depends on runtime
  const gameServer = new Server(deps.transport ? { transport: deps.transport } : undefined);

  // Create a room class that uses the game definition
  class WitClashRoom extends GameRoom {
    constructor() {
      super(deps.roomCodeService, deps.categories, deps.durations ?? DEFAULT_DURATIONS);
    }

    onCreate(options: Record<string, unknown>) {
      if (gameDefinition) {
        this.setDefinition(gameDefinition as GameDefinition<unknown>);
      } else {
        // Fallback: try to import WitClashGame dynamically for production
        // This is used when createGameServer is called without gameDefinition (e.g., from index.ts)
        // biome-ignore lint/suspicious/noExplicitAny: dynamic import requires any type
        import("../../../games/wit-clash/index.js").then((mod: any) => {
          this.setDefinition(mod.WitClashGame);
        });
      }
      super.onCreate(options);
    }
  }

  gameServer.define("wit_clash", WitClashRoom);
  return gameServer;
}
