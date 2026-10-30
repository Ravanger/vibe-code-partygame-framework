import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { OptionFields } from "../src/OptionFields.js";
import { TestOptionsSchema } from "./fixtures/optionsSchema.js";

describe("OptionFields", () => {
  it("builds one field per option kind, with limits and step for numbers", () => {
    const fields = new OptionFields().from(z.toJSONSchema(TestOptionsSchema));
    expect(fields).toEqual([
      { key: "turnSeconds", label: "Turn seconds", kind: "number", min: 5, max: 60, step: 1 },
      { key: "tolerance", label: "Tolerance", kind: "number", min: 0, max: 1, step: 0.1 },
      { key: "soundOn", label: "Sound on", kind: "boolean" },
      { key: "level", label: "Level", kind: "select", choices: ["off", "moderate", "strict"] },
      { key: "label", label: "Label", kind: "text", maxLength: 24 },
    ]);
  });

  it("uses step 1 for integers and 'any' for a plain bounded number", () => {
    const fields = new OptionFields().from({
      properties: {
        whole: { type: "integer", minimum: 0, maximum: 9 },
        ratio: { type: "number", minimum: 0, maximum: 1 },
      },
    });
    expect(fields).toEqual([
      { key: "whole", label: "Whole", kind: "number", min: 0, max: 9, step: 1 },
      { key: "ratio", label: "Ratio", kind: "number", min: 0, max: 1, step: "any" },
    ]);
  });

  it("renders a plain string as text without maxLength", () => {
    const fields = new OptionFields().from({
      properties: { note: { type: "string" } },
    });
    expect(fields).toEqual([{ key: "note", label: "Note", kind: "text" }]);
  });

  it("labels a field from the override and falls back to the camelCase key", () => {
    const fields = new OptionFields({ turnSeconds: "Seconds per turn" }).from({
      properties: {
        turnSeconds: { type: "integer", minimum: 1, maximum: 9 },
        maxPlayers: { type: "integer", minimum: 1, maximum: 9 },
      },
    });
    expect(fields.map((f) => f.label)).toEqual(["Seconds per turn", "Max players"]);
  });

  it("reports every unsupported option through the callback and renders none of them", () => {
    const seen: Array<[string, string]> = [];
    const fields = new OptionFields(undefined, (key, reason) => seen.push([key, reason])).from({
      properties: {
        tags: { type: "array" },
        nested: { type: "object" },
        open: { type: "number" },
        mixed: { type: "string", enum: ["a", 1] },
        empty: { type: "string", enum: [] },
        anything: true,
        weird: {},
      },
    });
    expect(fields).toEqual([]);
    expect(seen).toEqual([
      ["tags", 'unsupported type "array"'],
      ["nested", 'unsupported type "object"'],
      ["open", "unbounded numbers need a minimum and maximum"],
      ["mixed", "enum choices must all be strings"],
      ["empty", "enum choices must all be strings"],
      ["weird", 'unsupported type "unknown"'],
    ]);
  });

  it("warns once per key per instance by default", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const a = new OptionFields();
      const b = new OptionFields();
      a.from({ properties: { tags: { type: "array" } } });
      b.from({ properties: { tags: { type: "object" } } });
      expect(warn).toHaveBeenCalledTimes(2); // each instance warns once for the same key
      expect(warn.mock.calls[0]?.[0]).toContain("tags");
      a.from({ properties: { tags: { type: "array" } } });
      expect(warn).toHaveBeenCalledTimes(2); // a second call on the same instance does not warn again
    } finally {
      warn.mockRestore();
    }
  });

  it("has no fields for a schema without properties", () => {
    expect(new OptionFields().from({ type: "string" })).toEqual([]);
  });
});
