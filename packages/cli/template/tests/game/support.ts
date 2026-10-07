import { TestTable } from "@partygame/core/testing";
import { create__PascalName__Game } from "../../src/game.js";
import { type __PascalName__Options, __PascalName__OptionsSchema } from "../../src/options.js";
import type { __PascalName__Private } from "../../src/private.js";
import { __PascalName__State } from "../../src/state.js";

export interface TableConfig {
  players?: number;
  options?: Partial<__PascalName__Options>;
}

/** A room driven through the real runtime and the real state schema, with a manual clock. */
export class Table extends TestTable<
  __PascalName__State,
  __PascalName__Private,
  __PascalName__Options
> {
  constructor(config: TableConfig = {}) {
    super({
      definition: create__PascalName__Game(),
      state: new __PascalName__State(),
      options: __PascalName__OptionsSchema.parse(config.options ?? {}),
      players: config.players ?? 3,
      seed: 1234,
    });
  }

  wave(playerId: string): void {
    this.act(playerId, "WAVE");
  }
}
