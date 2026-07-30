import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import MatchupVote from "../../ui/screens/MatchupVote.svelte";
import { fakeManager, makeFakeRoom, makeFakeState, makePlayer } from "../helpers/fakes.js";

describe("MatchupVote", () => {
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
          index: 0,
          promptText: "Best pizza topping?",
          isRevealed: false,
          answers: [
            { id: "a0", text: "Answer A", votes: 0, authorId: "" },
            { id: "a1", text: "Answer B", votes: 0, authorId: "" },
          ],
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
      answerId: "a0",
    });
  });

  it("marks the voted answer with aria-pressed", () => {
    const manager = makeManager({
      matchups: [
        {
          id: "m0",
          index: 0,
          promptText: "Best pizza topping?",
          isRevealed: false,
          answers: [
            { id: "a0", text: "Answer A", votes: 1, authorId: "" },
            { id: "a1", text: "Answer B", votes: 0, authorId: "" },
          ],
        },
      ],
      answerVotes: new Map([["me", "a0"]]),
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
          index: 0,
          promptText: "Best pizza topping?",
          isRevealed: false,
          answers: [
            { id: "a0", text: "Answer A", votes: 1, authorId: "" },
            { id: "a1", text: "Answer B", votes: 1, authorId: "" },
          ],
        },
      ],
      answerVotes: new Map([
        ["p3", "a0"],
        ["p4", "a1"],
      ]),
    });
    render(MatchupVote, { manager });
    expect(screen.queryByText(/vote/i, { selector: ".votes" })).not.toBeInTheDocument();
  });

  it("shows vote counts and author names on reveal (isRevealing=true)", () => {
    const manager = makeManager({
      isRevealing: true,
      matchups: [
        {
          id: "m0",
          index: 0,
          promptText: "Best pizza topping?",
          isRevealed: true,
          answers: [
            { id: "a0", text: "Answer A", votes: 2, authorId: "p1" },
            { id: "a1", text: "Answer B", votes: 1, authorId: "p2" },
          ],
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
              index: 0,
              promptText: "Best pizza topping?",
              isRevealed: false,
              answers: [
                { id: "a0", text: "Answer A", votes: 0, authorId: "p1" },
                { id: "a1", text: "Answer B", votes: 0, authorId: "p2" },
              ],
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
          index: 0,
          promptText: "Best pizza topping?",
          isRevealed: false,
          answers: [
            { id: "a0", text: "Answer A", votes: 1, authorId: "p1" },
            { id: "a1", text: "Answer B", votes: 1, authorId: "p2" },
          ],
        },
      ],
      answerVotes: new Map([
        ["me", "a0"],
        ["p3", "a1"],
      ]),
    });
    render(MatchupVote, { manager });
    expect(screen.getByText(/2 of 2 voted/i)).toBeInTheDocument();
  });

  it("shows countdown timer", () => {
    const manager = makeManager({
      phaseEndsAt: 1_019_500,
      serverNow: 1_000_000,
    });
    render(MatchupVote, { manager });
    expect(screen.getByText(/20s/i)).toBeInTheDocument();
  });
});
