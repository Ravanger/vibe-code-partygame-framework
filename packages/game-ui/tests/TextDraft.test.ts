import { connectedClient, type SeatConfig } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { describe, expect, it } from "vitest";
import { TextDraft } from "../src/index.js";

const MAX = 20;

function setup(seat: SeatConfig = {}) {
  const c = connectedClient({ stateClass: BaseGameState, seat });
  let level = "moderate";
  let rejected: number | undefined = 3;
  const drafts = new TextDraft(c.manager, {
    maxLength: MAX,
    filterLevel: () => level,
    rejectedCount: () => rejected,
    noun: "answer",
  });
  return {
    c,
    drafts,
    setLevel: (next: string) => {
      level = next;
    },
    setRejected: (next: number | undefined) => {
      rejected = next;
    },
  };
}

describe("TextDraft", () => {
  it("keeps one draft per key", () => {
    const { drafts } = setup();
    expect(drafts.draft("a")).toBe("");
    drafts.setDraft("a", "hello");
    drafts.setDraft("b", "world");
    expect(drafts.draft("a")).toBe("hello");
    expect(drafts.draft("b")).toBe("world");
  });

  it("counts the remaining characters against the limit", () => {
    const { drafts } = setup();
    expect(drafts.charsRemaining("a")).toBe(MAX);
    drafts.setDraft("a", "abcd");
    expect(drafts.charsRemaining("a")).toBe(MAX - 4);
  });

  it("allows submit only for a non-blank draft within the limit", () => {
    const { drafts } = setup();
    expect(drafts.canSubmit("a")).toBe(false); // empty
    drafts.setDraft("a", "   ");
    expect(drafts.canSubmit("a")).toBe(false); // blank
    drafts.setDraft("a", "ok");
    expect(drafts.canSubmit("a")).toBe(true);
    drafts.setDraft("a", "x".repeat(MAX + 1));
    expect(drafts.canSubmit("a")).toBe(false); // over the limit
    drafts.setDraft("a", "x".repeat(MAX));
    expect(drafts.canSubmit("a")).toBe(true); // exactly at the limit
  });

  it("shows the server's message only for a content rejection", () => {
    const { c, drafts } = setup();
    expect(drafts.rejectionReason).toBe("");
    c.manager.lastServerError = { code: "KICKED", message: "full" };
    expect(drafts.rejectionReason).toBe("");
    c.manager.lastServerError = { code: "CONTENT_REJECTED", message: "Too long" };
    expect(drafts.rejectionReason).toBe("Too long");
  });

  it("shows the moderation line for the host only, with the level and a plural count", () => {
    const { drafts, setLevel, setRejected } = setup({ role: "host" });
    expect(drafts.moderationLine).toBe("3 answers rejected, level moderate");
    setRejected(1);
    expect(drafts.moderationLine).toBe("1 answer rejected, level moderate");
    setLevel("off");
    expect(drafts.moderationLine).toBe("");
  });

  it("hides the moderation line for non-hosts and while state is unsynced", () => {
    const guest = setup();
    expect(guest.drafts.moderationLine).toBe("");
    const host = setup({ role: "host" });
    host.setRejected(undefined);
    expect(host.drafts.moderationLine).toBe("");
  });
});
