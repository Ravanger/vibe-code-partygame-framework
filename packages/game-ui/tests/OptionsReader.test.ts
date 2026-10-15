import { connectedClient } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { OptionsReader } from "../src/OptionsReader.svelte.js";
import { TestOptionsSchema } from "./fixtures/optionsSchema.js";

const client = () => connectedClient({ stateClass: BaseGameState });

describe("OptionsReader", () => {
  it("returns the parsed options, applying schema defaults to missing fields", () => {
    const c = client();
    c.state.options = JSON.stringify({ turnSeconds: 45 });
    const reader = new OptionsReader(c.manager, TestOptionsSchema);
    expect(reader.current).toEqual({ turnSeconds: 45, label: "x", loose: 1 });
  });

  it("returns the defaults for malformed JSON", () => {
    const c = client();
    c.state.options = "{not json";
    const reader = new OptionsReader(c.manager, TestOptionsSchema);
    expect(reader.current).toEqual(TestOptionsSchema.parse({}));
  });

  it("returns the defaults for schema-invalid JSON", () => {
    const c = client();
    c.state.options = JSON.stringify({ turnSeconds: 99 });
    const reader = new OptionsReader(c.manager, TestOptionsSchema);
    expect(reader.current).toEqual(TestOptionsSchema.parse({}));
  });

  it("returns the defaults when there is no state", () => {
    const c = client();
    const reader = new OptionsReader(c.manager, TestOptionsSchema);
    c.manager.dispose();
    expect(reader.current).toEqual(TestOptionsSchema.parse({}));
  });

  it("prefers explicit defaults over the schema's when the published options are unusable", () => {
    const c = client();
    c.state.options = "{not json";
    const reader = new OptionsReader(c.manager, TestOptionsSchema, {
      turnSeconds: 11,
      label: "y",
      loose: 2,
    });
    expect(reader.current).toEqual({ turnSeconds: 11, label: "y", loose: 2 });
  });

  it("throws when no defaults are given and the schema has none of its own", () => {
    const c = client();
    expect(() => new OptionsReader(c.manager, z.number())).toThrow();
  });

  it("parses once for many reads and again after the string changes", () => {
    const c = client();
    c.state.options = JSON.stringify({ turnSeconds: 45 });
    const reader = new OptionsReader(c.manager, TestOptionsSchema);
    const parse = vi.spyOn(JSON, "parse");
    expect(reader.current).toEqual({ turnSeconds: 45, label: "x", loose: 1 });
    expect(reader.current).toEqual({ turnSeconds: 45, label: "x", loose: 1 });
    expect(parse).toHaveBeenCalledTimes(1);
    c.state.options = JSON.stringify({ turnSeconds: 50 });
    c.room.patch();
    expect(reader.current.turnSeconds).toBe(50);
    expect(parse).toHaveBeenCalledTimes(2);
    parse.mockRestore();
  });
});
