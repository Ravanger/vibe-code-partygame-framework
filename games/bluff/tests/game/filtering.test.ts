import { CLIENT_MESSAGES } from "@partygame/shared";
import { describe, expect, it } from "vitest";
import { Table } from "./support.js";

const PROFANE = "what the fuck";
const MILD = "you ass";

const submit = (t: Table, playerId: string, text: string) =>
  t.act(playerId, "SUBMIT_FAKE", { text });

describe("fake filtering", () => {
  it("refuses a profane fake at the default moderate level and stores nothing", () => {
    const t = Table.started();
    const error = submit(t, "p1", PROFANE);
    expect(error).toEqual({
      code: "CONTENT_REJECTED",
      message: CLIENT_MESSAGES.CONTENT_REJECTED,
      action: "SUBMIT_FAKE",
    });
    expect(t.errors("p1")).toContainEqual(error);
    expect(t.priv.fakes.has("p1")).toBe(false);
  });

  it("accepts the same fake when filtering is off", () => {
    const t = Table.started({ options: { filterLevel: "off" } });
    expect(submit(t, "p1", PROFANE)).toBeUndefined();
    expect(t.errors("p1")).toEqual([]);
    expect([...(t.priv.fakes.get("p1")?.values() ?? [])]).toEqual([PROFANE]);
  });

  it("passes a mild term at moderate and refuses it at strict", () => {
    const t = Table.started();
    expect(submit(t, "p1", MILD)).toBeUndefined();
    expect(t.errors("p1")).toEqual([]);

    const s = Table.started({ options: { filterLevel: "strict" } });
    expect(submit(s, "p1", MILD)).toEqual({
      code: "CONTENT_REJECTED",
      message: CLIENT_MESSAGES.CONTENT_REJECTED,
      action: "SUBMIT_FAKE",
    });
  });

  it("counts each refused fake so the host sees how many were rejected", () => {
    const t = Table.started();
    submit(t, "p1", PROFANE);
    submit(t, "p2", PROFANE);
    expect(t.state.rejectedTexts).toBe(2);
  });

  it("clears the count when the game returns to the lobby", () => {
    const t = Table.started();
    submit(t, "p1", PROFANE);
    expect(t.state.rejectedTexts).toBe(1);
    t.act("p1", "END_GAME");
    expect(t.phase).toBe("Lobby");
    expect(t.state.rejectedTexts).toBe(0);
  });
});
