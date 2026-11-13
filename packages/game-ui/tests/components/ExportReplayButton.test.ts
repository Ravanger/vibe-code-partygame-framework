import { connectedClient } from "@partygame/game-client/testing";
import { ErrorCode } from "@partygame/shared";
import { BaseGameState } from "@partygame/shared/schema";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportReplayButton } from "../../src/components/index.js";
import { expectNoViolations } from "../support/a11y.js";

class TestURL extends URL {
  static createObjectURL = vi.fn((_blob: unknown) => "blob:test");
  static revokeObjectURL = vi.fn((_url: string) => {});
}

/** Spies on anchor clicks and returns the anchors that were clicked. */
function clickedAnchors(): HTMLAnchorElement[] {
  const anchors: HTMLAnchorElement[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    anchors.push(this);
  });
  return anchors;
}

const host = () => connectedClient({ stateClass: BaseGameState, seat: { role: "host" } });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  TestURL.createObjectURL.mockReset();
  TestURL.revokeObjectURL.mockReset();
});

describe("ExportReplayButton", () => {
  it("downloads the bundle as a JSON file named after the game", async () => {
    const c = host();
    c.room.reply = { bundleVersion: 1, name: "TestGame", snapshots: [] };
    const anchors = clickedAnchors();
    vi.stubGlobal("URL", TestURL);
    const { container } = render(ExportReplayButton, { manager: c.manager });
    await fireEvent.click(screen.getByRole("button", { name: "Export replay" }));
    expect(c.room.requests).toEqual([{ type: "EXPORT_REPLAY", payload: undefined }]);
    expect(TestURL.createObjectURL).toHaveBeenCalledOnce();
    const blob = TestURL.createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(JSON.parse(await blob.text())).toMatchObject({ name: "TestGame" });
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.download).toBe("testgame-replay.json");
    expect(TestURL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
    await expectNoViolations(container, "ExportReplayButton");
  });

  it("downloads nothing for a refusal and remembers the error", async () => {
    const c = host();
    c.room.reply = {
      ok: false,
      error: { code: ErrorCode.UNAUTHORIZED, message: "only the host can export" },
    };
    const anchors = clickedAnchors();
    vi.stubGlobal("URL", TestURL);
    render(ExportReplayButton, { manager: c.manager });
    await fireEvent.click(screen.getByRole("button", { name: "Export replay" }));
    expect(TestURL.createObjectURL).not.toHaveBeenCalled();
    expect(anchors).toHaveLength(0);
    expect(c.manager.lastServerError).toEqual({
      code: ErrorCode.UNAUTHORIZED,
      message: "only the host can export",
    });
  });
});
