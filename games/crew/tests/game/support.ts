import type { PlayerInfo } from "@partygame/core";
import { TestTable } from "@partygame/core/testing";
import { createCrewGame } from "../../src/game.js";
import { type CrewOptions, CrewOptionsSchema } from "../../src/options.js";
import type { CrewPrivate } from "../../src/private.js";
import { CrewState } from "../../src/state.js";

export interface TableConfig {
  players?: number;
  options?: Partial<CrewOptions>;
  seed?: number;
  seats?: Partial<PlayerInfo>[];
}

/** A room driven through the real runtime and the real state schema, with a manual clock. */
export class Table extends TestTable<CrewState, CrewPrivate, CrewOptions> {
  constructor(config: TableConfig = {}) {
    super({
      definition: createCrewGame(),
      state: new CrewState(),
      options: CrewOptionsSchema.parse(config.options ?? {}),
      players: config.players ?? 4,
      seed: config.seed ?? 1234,
      ...(config.seats !== undefined ? { seats: config.seats } : {}),
    });
  }

  share(playerId: string): void {
    this.act(playerId, "SHARE");
  }

  hold(playerId: string): void {
    this.act(playerId, "HOLD");
  }

  guess(playerId: string, value: number) {
    return this.act(playerId, "GUESS", { value });
  }

  /** The table after START_GAME, in the first Round (roles and signals already dealt). */
  static started(config: TableConfig = {}): Table {
    const table = new Table(config);
    table.start();
    return table;
  }
}

/** Plays the single configured round to the Verdict. */
export const playToVerdict = (t: Table): void => {
  for (const id of t.ids()) t.share(id);
};

/** The public signal of `playerId`, if they have revealed it (by sharing or by leaving). */
export const revealOf = (t: Table, playerId: string): number | undefined =>
  t.state.reveals.find((r) => r.playerId === playerId)?.signal;
