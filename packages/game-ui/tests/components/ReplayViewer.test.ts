import { BaseGameState } from "@partygame/shared/schema";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReplayViewer } from "../../src/components/index.js";
import ReplayScreenFixture from "../fixtures/ReplayScreenFixture.svelte";
import { expectNoViolations } from "../support/a11y.js";

const SCREENS = {
  Reveal: { component: ReplayScreenFixture },
  Vote: { component: ReplayScreenFixture },
};

const bundleText = (snapshots: unknown) => JSON.stringify({ bundleVersion: 1, snapshots });

const twoSnapshots = [
  { seq: 1, phase: "Vote", state: { phase: "Play" } },
  { seq: 5, phase: "Reveal", state: { phase: "Done" } },
];

// Three snapshots so one auto-advance tick still leaves the player mid-bundle.
const threeSnapshots = [...twoSnapshots, { seq: 9, phase: "Vote", state: { phase: "Again" } }];

/** Puts `text` in the file input and fires its change event. */
function openBundle(text: string): void {
  const input = screen.getByLabelText("Open replay bundle");
  Object.defineProperty(input, "files", {
    value: [new File([text], "bundle.json", { type: "application/json" })],
  });
  void fireEvent.change(input);
}

const renderViewer = () =>
  render(ReplayViewer, { screens: SCREENS, stateClass: BaseGameState, title: "Test replay" });

afterEach(() => vi.useRealTimers());

describe("ReplayViewer", () => {
  it("asks for a bundle before showing anything else", async () => {
    const { container } = renderViewer();
    expect(screen.getByLabelText("Open replay bundle")).toBeInTheDocument();
    expect(screen.getByText("Test replay", { selector: ".wordmark" })).toBeInTheDocument();
    expect(screen.getByText(/open a replay bundle/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    await expectNoViolations(container, "ReplayViewer");
  });

  it("ignores an empty file selection", async () => {
    renderViewer();
    const input = screen.getByLabelText("Open replay bundle");
    Object.defineProperty(input, "files", { value: [] });
    await fireEvent.change(input);
    expect(screen.getByText(/open a replay bundle/i)).toBeInTheDocument();
  });

  it("opens at the first snapshot with the controls ready and clears the file input", async () => {
    const { container } = renderViewer();
    openBundle(bundleText(twoSnapshots));
    expect(await screen.findByText("Play screen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    // A cleared input re-fires change when the same file is picked again.
    expect((screen.getByLabelText("Open replay bundle") as HTMLInputElement).value).toBe("");
    await expectNoViolations(container, "ReplayViewer");
  });

  it("steps forward to the next snapshot's screen and back again", async () => {
    renderViewer();
    openBundle(bundleText(twoSnapshots));
    await screen.findByText("Play screen");
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Done screen")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Play screen")).toBeInTheDocument();
  });

  it("disables next and play at the end", async () => {
    renderViewer();
    openBundle(bundleText(twoSnapshots));
    await screen.findByText("Play screen");
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Done screen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /play/i })).toBeDisabled();
  });

  it("jumps to a snapshot with the scrubber", async () => {
    renderViewer();
    openBundle(bundleText(twoSnapshots));
    await screen.findByText("Play screen");
    const scrubber = screen.getByLabelText("Replay position") as HTMLInputElement;
    await fireEvent.input(scrubber, { target: { value: "1" } });
    expect(await screen.findByText("Done screen")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("auto-advances while playing and stops on pause", async () => {
    vi.useFakeTimers();
    renderViewer();
    openBundle(bundleText(threeSnapshots));
    await screen.findByText("Play screen");
    const play = screen.getByRole("button", { name: "Play" });
    expect(play).toHaveAttribute("aria-pressed", "false");
    await fireEvent.click(play);
    expect(screen.getByRole("button", { name: "Pause" })).toHaveAttribute("aria-pressed", "true");
    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await vi.advanceTimersByTimeAsync(3000);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("shows an error for a malformed file and keeps the controls away", async () => {
    const { container } = renderViewer();
    openBundle("not valid json");
    expect(await screen.findByRole("alert")).toHaveTextContent("not valid JSON");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    await expectNoViolations(container, "ReplayViewer");
  });

  it("shows an error for a bundle with no snapshots", async () => {
    renderViewer();
    openBundle(bundleText([]));
    expect(await screen.findByRole("alert")).toHaveTextContent("no snapshots");
  });

  it("falls back to a message for a phase with no screen", async () => {
    renderViewer();
    openBundle(bundleText([{ seq: 0, phase: "Mystery", state: {} }]));
    expect(await screen.findByText(/Mystery/)).toBeInTheDocument();
  });
});
