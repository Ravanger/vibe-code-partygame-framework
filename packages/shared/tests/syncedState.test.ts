import { schema, t } from "@colyseus/schema";
import { describe, expect, it } from "vitest";
import { syncedJsonOf } from "../src/schema/index.js";

const Child = schema(
  {
    label: t.string().default(""),
    hidden: t.number().default(42).view(),
  },
  "SyncedChild",
);

const Root = schema(
  {
    text: t.string().default("a"),
    count: t.number().default(1),
    flag: t.boolean().default(true),
    child: t.ref(Child),
    kids: t.array(Child),
    bag: t.map(Child),
    nums: t.map("number"),
    secret: t.string().default("top-secret").view(),
  },
  "SyncedRoot",
);

const Extended = Root.extend({ extra: t.number().default(7) }, "SyncedExtended");

describe("syncedJsonOf", () => {
  it("serializes synced fields to plain JSON and drops .view() fields at every level", () => {
    const state = new Root();
    state.text = "hello";
    state.count = 3;
    state.flag = false;
    const child = new Child();
    child.label = "c1";
    state.child = child;
    const kid = new Child();
    kid.label = "k1";
    state.kids.push(kid);
    state.bag.set("b", new Child());
    state.nums.set("n", 5);

    expect(syncedJsonOf(state)).toEqual({
      text: "hello",
      count: 3,
      flag: false,
      child: { label: "c1" },
      kids: [{ label: "k1" }],
      bag: { b: { label: "" } },
      nums: { n: 5 },
    });
  });

  it("keeps inherited fields and drops view fields declared at any level of the hierarchy", () => {
    const state = new Extended();
    state.extra = 9;
    const out = syncedJsonOf(state);
    expect(out).toMatchObject({ extra: 9, text: "a", count: 1, flag: true });
    expect(out).not.toHaveProperty("secret");
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });
});
