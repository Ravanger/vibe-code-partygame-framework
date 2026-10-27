import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReplayApp from "../../ui/ReplayApp.svelte";
import BUNDLE_TEXT from "../fixtures/replay-bundle.json?raw";

const BUNDLE = JSON.parse(BUNDLE_TEXT) as {
  snapshots: Array<{ phase: string; state: Record<string, unknown> }>;
};

/** Puts `text` in the file input and fires its change event. */
function openBundle(text: string): void {
  const input = screen.getByLabelText("Open replay bundle");
  Object.defineProperty(input, "files", {
    value: [new File([text], "bundle.json", { type: "application/json" })],
  });
  void fireEvent.change(input);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Replay viewer", () => {
  it("asks for a bundle before showing anything else", () => {
    render(ReplayApp);
    expect(screen.getByLabelText("Open replay bundle")).toBeInTheDocument();
    expect(screen.getByText(/open a replay bundle/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("ignores an empty file selection", async () => {
    render(ReplayApp);
    const input = screen.getByLabelText("Open replay bundle");
    Object.defineProperty(input, "files", { value: [] });
    await fireEvent.change(input);
    expect(screen.getByText(/open a replay bundle/i)).toBeInTheDocument();
  });

  it("opens at the first snapshot with the controls ready", async () => {
    render(ReplayApp);
    openBundle(BUNDLE_TEXT);
    // The first recorded phase is the lobby; its screen shows the seated players.
    expect(await screen.findByText("Bot 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(screen.getByText(`1 / ${BUNDLE.snapshots.length}`)).toBeInTheDocument();
  });

  it("steps forward to the next phase's screen and back again", async () => {
    render(ReplayApp);
    openBundle(BUNDLE_TEXT);
    await screen.findByText("Bot 1");
    expect(BUNDLE.snapshots[1]?.phase).toBe("CategorySelection");
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Pick a category")).toBeInTheDocument();
    expect(screen.getByText(`2 / ${BUNDLE.snapshots.length}`)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Leave game")).toBeInTheDocument();
  });

  it("steps through every snapshot and disables next at the end", async () => {
    render(ReplayApp);
    openBundle(BUNDLE_TEXT);
    await screen.findByText("Bot 1");
    const next = screen.getByRole("button", { name: "Next" }) as HTMLButtonElement;
    while (next.disabled === false) {
      await fireEvent.click(next);
    }
    // The last recorded phase is the final round's honor vote, fully cast.
    expect(await screen.findByText("Who wrote the funniest answer?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /play/i })).toBeDisabled();
    expect(
      screen.getByText(`${BUNDLE.snapshots.length} / ${BUNDLE.snapshots.length}`),
    ).toBeInTheDocument();
  });

  it("jumps to a snapshot with the scrubber", async () => {
    render(ReplayApp);
    openBundle(BUNDLE_TEXT);
    await screen.findByText("Bot 1");
    const resultsIndex = BUNDLE.snapshots.findIndex((snap) => snap.phase === "Results");
    expect(resultsIndex).toBeGreaterThan(0);
    const scrubber = screen.getByLabelText("Replay position") as HTMLInputElement;
    await fireEvent.change(scrubber, { target: { value: String(resultsIndex) } });
    expect(await screen.findByText(`Round 1 of 2 Results`)).toBeInTheDocument();
    expect(
      screen.getByText(`${resultsIndex + 1} / ${BUNDLE.snapshots.length}`),
    ).toBeInTheDocument();
  });

  it("auto-advances while playing and stops on pause", async () => {
    vi.useFakeTimers();
    render(ReplayApp);
    openBundle(BUNDLE_TEXT);
    await screen.findByText("Bot 1");
    const play = screen.getByRole("button", { name: "Play" });
    expect(play).toHaveAttribute("aria-pressed", "false");
    await fireEvent.click(play);
    expect(screen.getByRole("button", { name: "Pause" })).toHaveAttribute("aria-pressed", "true");
    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByText(`2 / ${BUNDLE.snapshots.length}`)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await vi.advanceTimersByTimeAsync(3000);
    expect(screen.getByText(`2 / ${BUNDLE.snapshots.length}`)).toBeInTheDocument();
  });

  it("shows an error for a malformed file and keeps the controls away", async () => {
    render(ReplayApp);
    openBundle("not valid json");
    expect(await screen.findByRole("alert")).toHaveTextContent("not valid JSON");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("shows an error for a bundle with no snapshots", async () => {
    render(ReplayApp);
    openBundle(JSON.stringify({ bundleVersion: 1, snapshots: [] }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no snapshots");
  });

  it("falls back to a message for a phase with no screen", async () => {
    render(ReplayApp);
    openBundle(
      JSON.stringify({ bundleVersion: 1, snapshots: [{ seq: 0, phase: "Mystery", state: {} }] }),
    );
    expect(await screen.findByText(/Mystery/)).toBeInTheDocument();
  });

  it("lets the lobby's leave button go quietly in replay mode", async () => {
    render(ReplayApp);
    openBundle(BUNDLE_TEXT);
    await screen.findByText("Bot 1");
    await fireEvent.click(screen.getByRole("button", { name: "Leave game" }));
    expect(screen.getByText("Bot 1")).toBeInTheDocument();
  });
});
