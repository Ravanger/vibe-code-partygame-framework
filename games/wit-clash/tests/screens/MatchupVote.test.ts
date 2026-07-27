import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import MatchupVote from "../../ui/screens/MatchupVote.svelte";
import { fakeManager, makeFakeRoom, makeFakeState, makePlayer } from "../helpers/fakes.js";

describe.skip("MatchupVote", () => {
  function makeManager(stateOverrides = {}) {
    const state = makeFakeState({
      phase: "Voting",
      activeMatchupIndex: 0,
      isRevealing: false,
      phaseEndsAt: 1_020_000,
      serverNow: 1_000_000,
      matchups: [
        {
          id: "m0",
          answers: ["Answer A", "Answer B"],
          authorIds: ["p1", "p2"],
          votes: new Map(),
        },
      ],
      players: new Map([
        ["me", makePlayer({ id: "me", name: "You", role: "guest" })],
        ["p1", makePlayer({ id: "p1", name: "Alice", role: "guest" })],
        ["p2", makePlayer({ id: "p2", name: "Bob", role: "guest" })],
        ["p3", makePlayer({ id: "p3", name: "Charlie", role: "guest" })],
      ]),
      ...stateOverrides,
    });
    return fakeManager({
      connectionStatus: "connected",
      stateVersion: 1,
      room: makeFakeRoom({ state, sessionId: "me" }),
    });
  }

  it("renders two answer buttons", () => {
    const manager = makeManager();
    render(MatchupVote, { manager });
    expect(screen.getByRole("button", { name: /answer a/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /answer b/i })).toBeInTheDocument();
  });

  it("clicking an answer sends CAST_VOTE action", async () => {
    const manager = makeManager();
    render(MatchupVote, { manager });
    const answerBtn = screen.getByRole("button", { name: /answer a/i });
    await fireEvent.click(answerBtn);
    expect(manager.room?.send).toHaveBeenCalledWith("ACTION", {
      type: "CAST_VOTE",
      answerIndex: 0,
    });
  });

  it("marks the voted answer with aria-pressed", () => {
    const manager = makeManager({
      matchups: [
        {
          id: "m0",
          answers: ["Answer A", "Answer B"],
          authorIds: ["p1", "p2"],
          votes: new Map([["me", 0]]),
        },
      ],
    });
    render(MatchupVote, { manager });
    expect(screen.getByRole("button", { name: /answer a/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /answer b/i })).not.toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("hides vote counts while voting (isRevealing=false)", () => {
    const manager = makeManager({
      isRevealing: false,
      matchups: [
        {
          id: "m0",
          answers: ["Answer A", "Answer B"],
          authorIds: ["p1", "p2"],
          votes: new Map([
            ["p3", 0],
            ["p4", 0],
          ]),
        },
      ],
    });
    render(MatchupVote, { manager });
    expect(screen.queryByText(/votes/i)).not.toBeInTheDocument();
  });

  it("shows vote counts and author names on reveal (isRevealing=true)", () => {
    const manager = makeManager({
      isRevealing: true,
      matchups: [
        {
          id: "m0",
          answers: ["Answer A", "Answer B"],
          authorIds: ["p1", "p2"],
          votes: new Map([
            ["p3", 0],
            ["p4", 1],
          ]),
        },
      ],
    });
    render(MatchupVote, { manager });
    expect(screen.getByText(/alice/i)).toBeInTheDocument();
    expect(screen.getByText(/bob/i)).toBeInTheDocument();
    expect(screen.getByText(/2 votes/i)).toBeInTheDocument();
    expect(screen.getByText(/1 vote/i)).toBeInTheDocument();
  });

  it("disables answer buttons for the authors", () => {
    // Re-create manager as the author
    const authorManager = fakeManager({
      connectionStatus: "connected",
      stateVersion: 1,
      room: makeFakeRoom({
        state: makeFakeState({
          phase: "Voting",
          activeMatchupIndex: 0,
          isRevealing: false,
          matchups: [
            {
              id: "m0",
              answers: ["Answer A", "Answer B"],
              authorIds: ["p1", "p2"],
              votes: new Map(),
            },
          ],
          players: new Map([
            ["p1", makePlayer({ id: "p1", name: "You", role: "guest" })],
            ["p2", makePlayer({ id: "p2", name: "Bob", role: "guest" })],
          ]),
        }),
        sessionId: "p1",
      }),
    });
    render(MatchupVote, { manager: authorManager });
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeDisabled();
  });

  it("shows progress 'Matchup N of M'", () => {
    const manager = makeManager();
    render(MatchupVote, { manager });
    expect(screen.getByText(/matchup 1 of 1/i)).toBeInTheDocument();
  });

  it("shows vote progress in footer", () => {
    const manager = makeManager({
      matchups: [
        {
          id: "m0",
          answers: ["Answer A", "Answer B"],
          authorIds: ["p1", "p2"],
          votes: new Map([
            ["me", 0],
            ["p3", 1],
          ]),
        },
      ],
    });
    render(MatchupVote, { manager });
    expect(screen.getByText(/2 of 2 voted/i)).toBeInTheDocument();
  });

  it("shows countdown timer", () => {
    const manager = makeManager({
      phaseEndsAt: 1_020_000,
      serverNow: 1_000_000,
    });
    render(MatchupVote, { manager });
    expect(screen.getByText(/20s/i)).toBeInTheDocument();
  });
});
