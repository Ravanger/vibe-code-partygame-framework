import type { GameDefinition } from "@partygame/core";
import { TestTable } from "@partygame/core/testing";
import { createRushGame } from "../../src/game.js";
import { type RushOptions, RushOptionsSchema } from "../../src/options.js";
import type { RushPrivate } from "../../src/private.js";
import { RushState } from "../../src/state.js";

export interface TableConfig {
  players?: number;
  options?: Partial<RushOptions>;
  seed?: number;
  definition?: GameDefinition<RushState, RushPrivate, RushOptions>;
}

/** A room driven through the real runtime and the real state schema, with a manual clock. */
export class Table extends TestTable<RushState, RushPrivate, RushOptions> {
  constructor(config: TableConfig = {}) {
    super({
      definition: config.definition ?? createRushGame(),
      state: new RushState(),
      options: RushOptionsSchema.parse(config.options ?? {}),
      players: config.players ?? 4,
      seed: config.seed ?? 1234,
    });
  }

  /** Sends the player's TAP; it is always accepted while the Race runs. */
  tap(playerId: string): void {
    this.act(playerId, "TAP");
  }

  /** The table after START_GAME, in the Race with the target already dealt. */
  static started(config: TableConfig = {}): Table {
    const table = new Table(config);
    table.start();
    return table;
  }
}
