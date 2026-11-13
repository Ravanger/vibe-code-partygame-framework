import { required } from "@partygame/core";
import { ReplayViewer } from "@partygame/game-ui/components";
import { syncedJsonOf } from "@partygame/shared/schema";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { WitClashState } from "../../src/state.js";
import { PHASE_SCREENS } from "../../ui/screens/index.js";
import BUNDLE_TEXT from "../fixtures/replay-bundle.json?raw";
import { makeCategories, nth, Table } from "../game/support.js";

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

/** Drives a one-round game through its final tie-breaker and records the final state of each
 * tie phase, in the same shape the server's exporter writes. */
function tieBreakerBundleText(): string {
  const t = new Table({
    players: 4,
    categories: makeCategories(4, 8, 3),
    options: { totalRounds: 1 },
  });
  const snapshots: Array<{ seq: number; phase: string; state: Record<string, unknown> }> = [];
  let seq = 0;
  const record = (): void => {
    if (t.phase.startsWith("TieBreaker")) {
      snapshots.push({ seq: ++seq, phase: t.phase, state: syncedJsonOf(t.state) });
    }
  };
  t.toVoting();
  for (;;) {
    if (t.phase === "MatchupVoting") {
      t.voteFor(nth(t.authors(), 0));
    } else if (t.phase === "MatchupReveal") {
      // Force a two-way tie for the lead when the last matchup is revealed.
      if (t.state.activeMatchupIndex + 1 === t.state.matchups.length) {
        t.priv.scores = { p1: 500, p2: 500, p3: 100, p4: 0 };
      }
      t.tick(5000);
    } else break;
  }
  record(); // TieBreakerPrompting: the tied players face the prompt
  for (const id of ["p1", "p2"]) {
    t.act(id, "SUBMIT_ANSWER", {
      matchupId: nth([...t.mine(id).prompts], 0).matchupId,
      answer: `${id} tie-breaker answer`,
    });
  }
  record(); // TieBreakerVoting: the answers are in, the votes are out
  const tie = required(t.state.tieBreakers[t.state.tieBreakers.length - 1], "tie-breaker");
  for (const voter of ["p3", "p4"]) {
    t.act(voter, "CAST_VOTE", { answerId: nth([...tie.answers], 0).id });
  }
  record(); // TieBreakerReveal: the verdict is in
  return JSON.stringify({ bundleVersion: 1, snapshots });
}

const renderViewer = () =>
  render(ReplayViewer, {
    screens: PHASE_SCREENS,
    stateClass: WitClashState,
    title: "WitClash replay",
  });

describe("Replay viewer", () => {
  it("renders the recorded lobby with the game's own screens", async () => {
    renderViewer();
    openBundle(BUNDLE_TEXT);
    // The first recorded phase is the lobby; its screen shows the seated players.
    expect(await screen.findByText("Bot 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByText(`1 / ${BUNDLE.snapshots.length}`)).toBeInTheDocument();
  });

  it("steps through the tie-breaker screens of a recorded game", async () => {
    renderViewer();
    openBundle(tieBreakerBundleText());
    expect(await screen.findByText("Sit tight while the tied players answer.")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Sit tight while the others vote.")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // The reveal is the only tie phase that shows authors, so it proves the verdict rendered.
    expect(await screen.findByText("by p1")).toBeInTheDocument();
  });

  it("lets the lobby's leave button go quietly in replay mode", async () => {
    renderViewer();
    openBundle(BUNDLE_TEXT);
    await screen.findByText("Bot 1");
    await fireEvent.click(screen.getByRole("button", { name: "Leave game" }));
    expect(screen.getByText("Bot 1")).toBeInTheDocument();
  });
});
