import { describe, expect, it } from "vitest";
import { z } from "zod";
import { OptionFields } from "../src/OptionFields.js";
import { TestOptionsSchema } from "./fixtures/optionsSchema.js";

describe("OptionFields", () => {
  it("lists bounded numbers with their limits and skips strings and unbounded numbers", () => {
    const fields = new OptionFields().from(z.toJSONSchema(TestOptionsSchema));
    expect(fields).toEqual([{ key: "turnSeconds", label: "Turn seconds", min: 5, max: 60 }]);
  });

  it("lists a string enum as an option field with its choices", () => {
    const fields = new OptionFields().from({
      properties: {
        filterLevel: { type: "string", enum: ["off", "moderate", "strict"] },
        text: { type: "string" },
        mixed: { type: "string", enum: ["a", 1] },
      },
    });
    expect(fields).toEqual([
      { key: "filterLevel", label: "Filter level", options: ["off", "moderate", "strict"] },
    ]);
  });

  it("labels an option field from the override", () => {
    const fields = new OptionFields({ filterLevel: "Language filter" }).from({
      properties: { filterLevel: { type: "string", enum: ["off", "on"] } },
    });
    expect(fields).toEqual([
      { key: "filterLevel", label: "Language filter", options: ["off", "on"] },
    ]);
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
