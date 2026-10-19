import type { PlayerInfo } from "@partygame/core";
import { TestTable } from "@partygame/core/testing";
import { type Prompt, promptsFromArray } from "../../src/content/PromptRepository.js";
import { createBluffGame } from "../../src/game.js";
import { type BluffOptions, BluffOptionsSchema } from "../../src/options.js";
import type { BluffPrivate } from "../../src/private.js";
import { BluffState } from "../../src/state.js";

const FIXTURE_PROMPTS: Prompt[] = [
  { id: "p1", question: "What is the capital of Australia?", truth: "Canberra" },
  { id: "p2", question: "Which ocean is the largest on Earth?", truth: "Pacific Ocean" },
  { id: "p3", question: "How many bones are in the adult human body?", truth: "206" },
  { id: "p4", question: "In which year did the first crewed Moon landing happen?", truth: "1969" },
];

export interface TableConfig {
  players?: number;
  options?: Partial<BluffOptions>;
  seed?: number;
  seats?: Partial<PlayerInfo>[];
}

/** A room driven through the real runtime and the real state schema, with a manual clock. */
export class Table extends TestTable<BluffState, BluffPrivate, BluffOptions> {
  constructor(config: TableConfig = {}) {
    super({
      definition: createBluffGame({ prompts: promptsFromArray(FIXTURE_PROMPTS) }),
      state: new BluffState(),
      options: BluffOptionsSchema.parse(config.options ?? {}),
      players: config.players ?? 4,
      seed: config.seed ?? 1234,
      ...(config.seats !== undefined ? { seats: config.seats } : {}),
    });
  }

  submitFake(playerId: string, text: string): void {
    this.act(playerId, "SUBMIT_FAKE", { text });
  }

  optionId(index: number): string {
    const option = this.state.choices[index];
    if (option === undefined) throw new Error(`No option at index ${index}`);
    return option.id;
  }

  voteFor(playerId: string, index: number): void {
    this.act(playerId, "CAST_VOTE", { optionId: this.optionId(index) });
  }

  /** The table after START_GAME, in the Writing phase. */
  static started(config: TableConfig = {}): Table {
    const table = new Table(config);
    table.start();
    return table;
  }
}
