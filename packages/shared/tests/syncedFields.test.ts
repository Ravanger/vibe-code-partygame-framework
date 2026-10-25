import { t } from "@colyseus/schema";
import { describe, expect, it } from "vitest";
import { BaseGameState } from "../src/schema/BaseGameState.js";
import { assertSyncedFields } from "../src/schema/syncedFields.js";

const CleanState = BaseGameState.extend(
  { public: t.number().default(0), mine: t.number().default(0).view() },
  "CleanState",
);

const LeakingState = BaseGameState.extend(
  {
    listed: t.number().default(0),
    secret: t.string().default("").view(),
    leakA: t.number().default(0),
    leakB: t.string().default(""),
  },
  "LeakingState",
);

describe("assertSyncedFields", () => {
  it("passes when every own field is allow-listed or .view()-tagged", () => {
    expect(() => assertSyncedFields(CleanState, ["public"])).not.toThrow();
  });

  it("allow-lists the BaseGameState fields without listing them", () => {
    expect(() => assertSyncedFields(BaseGameState, [])).not.toThrow();
  });

  it("throws naming the class and every field that is neither listed nor .view()", () => {
    expect(() => assertSyncedFields(LeakingState, ["listed"])).toThrow(
      /LeakingState[\s\S]*leakA,\s*leakB/,
    );
  });

  it("needs no listing for a class whose own fields are all .view()", () => {
    const ViewOnly = BaseGameState.extend({ mine: t.number().default(0).view() }, "ViewOnly");
    expect(() => assertSyncedFields(ViewOnly, [])).not.toThrow();
  });

  it("checks fields inherited from a non-base parent too", () => {
    const Mid = BaseGameState.extend({ extra: t.number().default(0) }, "MidState");
    const Child = Mid.extend({}, "ChildState");
    expect(() => assertSyncedFields(Child, [])).toThrow(/extra/);
    expect(() => assertSyncedFields(Child, ["extra"])).not.toThrow();
  });
});
