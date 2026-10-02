import { describe, expect, it } from "vitest";
import { z } from "zod";
import { OptionFields } from "../src/OptionFields.js";
import { TestOptionsSchema } from "./fixtures/optionsSchema.js";

describe("OptionFields", () => {
  it("lists bounded numbers with their limits and skips strings and unbounded numbers", () => {
    const fields = new OptionFields().from(z.toJSONSchema(TestOptionsSchema));
    expect(fields).toEqual([{ key: "turnSeconds", label: "Turn seconds", min: 5, max: 60 }]);
  });

  it("skips what is not a bounded number", () => {
    const fields = new OptionFields().from({
      properties: {
        flag: { type: "boolean" },
        open: { type: "number" },
        half: { type: "number", minimum: 0 },
        anything: true,
        ratio: { type: "number", minimum: 0, maximum: 1 },
      },
    });
    expect(fields).toEqual([{ key: "ratio", label: "Ratio", min: 0, max: 1 }]);
  });

  it("has no fields for a schema without properties", () => {
    expect(new OptionFields().from({ type: "string" })).toEqual([]);
  });

  it("uses a label override and falls back to the camelCase label", () => {
    const fields = new OptionFields({ turnSeconds: "Seconds per turn" }).from({
      properties: {
        turnSeconds: { type: "integer", minimum: 1, maximum: 9 },
        maxPlayers: { type: "integer", minimum: 1, maximum: 9 },
      },
    });
    expect(fields.map((f) => f.label)).toEqual(["Seconds per turn", "Max players"]);
  });
});
