import { describe, expect, it } from "vitest";
import { GameStateSchema } from "../src/schema/GameStateSchema.js";
import { CategoryOptionSchema } from "../src/schema/CategoryOptionSchema.js";
import { Encoder, Schema, type, ArraySchema } from "@colyseus/schema";

class TestChildSchema extends Schema {
  @type("string") name = "";
}

class TestParentSchema extends Schema {
  @type([TestChildSchema])
  children: ArraySchema<TestChildSchema>;

  constructor() {
    super();
    this.children = new ArraySchema<TestChildSchema>();
  }
}

describe("Schema serialization", () => {
  it("should serialize a basic GameStateSchema", () => {
    const state = new GameStateSchema();
    state.phase = "Lobby";
    state.roomCode = "ABCD";

    const bytes = new Uint8Array(1024);
    const encoder = new Encoder(state);
    encoder.encode(bytes);
    expect(encoder).toBeDefined();
  });

  it("should serialize with category options", () => {
    const state = new GameStateSchema();
    state.phase = "CategorySelection";

    const opt = new CategoryOptionSchema();
    opt.id = "test";
    opt.name = "Test";
    opt.emoji = "🧪";
    opt.votes = 0;

    state.categoryOptions.push(opt);

    const bytes = new Uint8Array(1024);
    const encoder = new Encoder(state);
    encoder.encode(bytes);
    expect(encoder).toBeDefined();
  });

  it("should serialize a simple parent-child schema", () => {
    const parent = new TestParentSchema();

    const child = new TestChildSchema();
    child.name = "test";
    parent.children.push(child);

    const bytes = new Uint8Array(1024);
    const encoder = new Encoder(parent);
    encoder.encode(bytes);
    expect(encoder).toBeDefined();
  });
});
