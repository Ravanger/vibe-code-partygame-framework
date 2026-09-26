import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import Results from "../ui/screens/Results.svelte";
import { fakeManager, makeFakeRoom, makeFakeState, makePlayer } from "./helpers/fakes.js";

describe("Results.svelte", () => {
  function makeManager(stateOverrides = {}) {
    const state = makeFakeState({
      phase: "Results",
      roundNumber: 1,
      totalRounds: 3,
      isFinalRound: false,
      matchups: [],
      players: new Map([
        ["p1", makePlayer({ id: "p1", name: "Alice", role: "host" })],
        ["p2", makePlayer({ id: "p2", name: "Bob", role: "guest" })],
      ]),
      scoreboard: [
        {
          playerId: "p1",
          name: "Alice",
          score: 300,
          roundPoints: 100,
          matchupsWon: 1,
          hadClash: false,
        },
        {
          playerId: "p2",
          name: "Bob",
          score: 200,
          roundPoints: 50,
          matchupsWon: 0,
          hadClash: false,
        },
      ],
      ...stateOverrides,
    });
    return fakeManager({
      connectionStatus: "connected",
      stateVersion: 1,
      room: makeFakeRoom({ state, sessionId: "p1" }),
    });
  }

  it("should display Final Scores title", () => {
    const manager = makeManager({ isFinalRound: true });
    render(Results, { manager });
    expect(screen.getByText(/game over/i)).toBeInTheDocument();
  });

  it("should display scoreboard with scores", () => {
    const manager = makeManager();
    render(Results, { manager });
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("should show Play Again button on the final round for the host", async () => {
    const manager = makeManager({ isFinalRound: true });
    render(Results, { manager });
    const playAgainBtn = screen.getByRole("button", { name: /play again/i });
    expect(playAgainBtn).toBeInTheDocument();
    await fireEvent.click(playAgainBtn);
    expect(manager.room?.send).toHaveBeenCalledWith("ACTION", { type: "PLAY_AGAIN" });
  });

  it("should show no scores message when empty", () => {
    const manager = makeManager({ scoreboard: [] });
    render(Results, { manager });
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
  });

  it("does not show CLASH! when only one voter cast a vote", () => {
    const manager = makeManager({
      matchups: [
        {
          id: "m1",
          index: 0,
          promptText: "Worst breakfast food",
          isRevealed: true,
          answers: [
            { id: "a1", text: "Eggs", votes: 1, authorId: "p2" },
            { id: "a2", text: "Cereal", votes: 0, authorId: "p1" },
          ],
        },
      ],
    });
    render(Results, { manager });
    expect(screen.queryByText("CLASH!")).not.toBeInTheDocument();
  });

  it("shows CLASH! when every voter (>= 2) picked the same answer", () => {
    const manager = makeManager({
      matchups: [
        {
          id: "m1",
          index: 0,
          promptText: "Worst breakfast food",
          isRevealed: true,
          answers: [
            { id: "a1", text: "Eggs", votes: 2, authorId: "p2" },
            { id: "a2", text: "Cereal", votes: 0, authorId: "p1" },
          ],
        },
      ],
    });
    render(Results, { manager });
    expect(screen.getByText("CLASH!")).toBeInTheDocument();
  });
});
