import { screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadReplay, mountReplayIfRequested } from "../src/replayDownload.js";
import ReplayMountFixture from "./fixtures/ReplayMountFixture.svelte";

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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  TestURL.createObjectURL.mockReset();
  TestURL.revokeObjectURL.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("downloadReplay", () => {
  it("sends nothing for a refusal", () => {
    const anchors = clickedAnchors();
    vi.stubGlobal("URL", TestURL);
    downloadReplay({ ok: false, error: { code: "UNAUTHORIZED", message: "no" } });
    expect(TestURL.createObjectURL).not.toHaveBeenCalled();
    expect(anchors).toHaveLength(0);
  });

  it("downloads the bundle as a JSON file named after the game", async () => {
    const anchors = clickedAnchors();
    vi.stubGlobal("URL", TestURL);
    const response = { bundleVersion: 1, name: "TestGame", snapshots: [] };
    downloadReplay(response);
    expect(TestURL.createObjectURL).toHaveBeenCalledOnce();
    const blob = TestURL.createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(JSON.parse(await blob.text())).toEqual(response);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.download).toBe("testgame-replay.json");
    expect(TestURL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });

  it("downloads under a generic name when the bundle has no game name", () => {
    const anchors = clickedAnchors();
    vi.stubGlobal("URL", TestURL);
    downloadReplay({ bundleVersion: 1, snapshots: [] });
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.download).toBe("replay-replay.json");
  });

  it("uses the injected document", () => {
    const anchors = clickedAnchors();
    vi.stubGlobal("URL", TestURL);
    downloadReplay({ bundleVersion: 1, name: "T", snapshots: [] }, document);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.download).toBe("t-replay.json");
  });
});

describe("mountReplayIfRequested", () => {
  function target(): HTMLDivElement {
    const div = document.createElement("div");
    document.body.appendChild(div);
    return div;
  }

  it("mounts the viewer when the URL asks for a replay", () => {
    window.history.replaceState(null, "", "/?replay");
    const t = target();
    const mounted = mountReplayIfRequested(ReplayMountFixture, t, { title: "T" });
    expect(mounted).toBe(true);
    expect(screen.getByText("T")).toBeInTheDocument();
    t.remove();
  });

  it("leaves the target alone without the query", () => {
    const t = target();
    const mounted = mountReplayIfRequested(ReplayMountFixture, t, { title: "T" });
    expect(mounted).toBe(false);
    expect(screen.queryByText("T")).not.toBeInTheDocument();
    t.remove();
  });
});
