import { schema, t } from "@colyseus/schema";
import { describe, expect, it } from "vitest";
import { syncedJsonOf, syncedStateFromJson } from "../src/schema/index.js";

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

const FillChild = schema(
  {
    label: t.string().default(""),
    hidden: t.number().default(42).view(),
  },
  "FillChild",
);

const FillRoot = schema(
  {
    text: t.string().default("a"),
    count: t.number().default(1),
    flag: t.boolean().default(true),
    kid: t.ref(FillChild),
    kids: t.array(FillChild),
    bag: t.map(FillChild),
    nums: t.map("number"),
    scores: t.array("number"),
    secret: t.string().default("top-secret").view(),
  },
  "FillRoot",
);

const FillExtended = FillRoot.extend({ extra: t.number().default(7) }, "FillExtended");

describe("syncedStateFromJson", () => {
  it("fills primitives, refs, arrays and maps from plain JSON", () => {
    const state = syncedStateFromJson(FillRoot, {
      text: "hello",
      count: 3,
      flag: false,
      kid: { label: "c1" },
      kids: [{ label: "k1" }, { label: "k2" }],
      bag: { b: { label: "b1" } },
      nums: { n: 5 },
      scores: [1, 2],
    });
    expect(state.text).toBe("hello");
    expect(state.count).toBe(3);
    expect(state.flag).toBe(false);
    expect(state.kid.label).toBe("c1");
    expect(state.kids.length).toBe(2);
    expect(state.kids[0]).toBeInstanceOf(FillChild);
    expect(state.kids.map((kid) => kid.label)).toEqual(["k1", "k2"]);
    expect(state.bag.get("b")?.label).toBe("b1");
    expect(state.nums.get("n")).toBe(5);
    expect([...state.scores]).toEqual([1, 2]);
  });

  it("keeps defaults for absent fields and never fills .view() fields", () => {
    const state = syncedStateFromJson(FillRoot, { secret: "leak" });
    expect(state.text).toBe("a");
    expect(state.count).toBe(1);
    expect(state.flag).toBe(true);
    expect(state.kids.length).toBe(0);
    expect(state.secret).toBe("top-secret");
  });

  it("round-trips syncedJsonOf output", () => {
    const state = new FillRoot();
    state.text = "rt";
    const kid = new FillChild();
    kid.label = "rk";
    state.kids.push(kid);
    state.bag.set("x", new FillChild());
    state.nums.set("m", 9);
    state.scores.push(4);
    expect(syncedJsonOf(syncedStateFromJson(FillRoot, syncedJsonOf(state)))).toEqual(
      syncedJsonOf(state),
    );
  });

  it("fills inherited fields too", () => {
    const state = syncedStateFromJson(FillExtended, { extra: 9, text: "e" });
    expect(state.extra).toBe(9);
    expect(state.text).toBe("e");
    expect(state.count).toBe(1);
  });
});
