import { describe, expect, it } from "vitest";
import { z } from "zod";
import { WitClashOptionsSchema } from "../src/options.js";
import { optionFields } from "../ui/optionFields.js";

describe("optionFields", () => {
  it("lists every option of the game with the limits of its schema", () => {
    const fields = optionFields(z.toJSONSchema(WitClashOptionsSchema));
    expect(fields.map((f) => f.key)).toEqual(Object.keys(WitClashOptionsSchema.shape));
    expect(fields[0]).toEqual({ key: "totalRounds", label: "Total rounds", min: 1, max: 10 });
    expect(fields.find((f) => f.key === "voteSeconds")).toMatchObject({ min: 5, max: 120 });
  });

  it("skips what is not a bounded number", () => {
    const fields = optionFields({
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
    expect(optionFields({ type: "string" })).toEqual([]);
  });
});
