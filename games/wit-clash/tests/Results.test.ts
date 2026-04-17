import type { GameConnectionManager } from "@partygame/client/src/connection.svelte.js";
import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import Results from "../ui/Results.svelte";

describe("Results.svelte", () => {
  const createMockManager = (scores: Record<string, number>) =>
    ({
      connectionStatus: "connected",
      room: {
        state: {
          phase: "Results",
          publicData: JSON.stringify({ scores }),
        },
        sessionId: "test-session",
        send: () => {},
      },
    }) as unknown as GameConnectionManager;

  it("should display Final Scores title", () => {
    render(Results, { manager: createMockManager({}) });
    expect(screen.getByText("Final Scores")).toBeInTheDocument();
  });

  it("should display scoreboard with scores", () => {
    const scores = { player1: 5, player2: 3, player3: 7 };
    render(Results, { manager: createMockManager(scores) });

    expect(screen.getByText("player1")).toBeInTheDocument();
    expect(screen.getByText("5 pts")).toBeInTheDocument();
    expect(screen.getByText("player3")).toBeInTheDocument();
    expect(screen.getByText("7 pts")).toBeInTheDocument();
  });

  it("should show Play Again button", () => {
    render(Results, { manager: createMockManager({}) });
    expect(screen.getByText("Play Again")).toBeInTheDocument();
  });

  it("should show no scores message when empty", () => {
    render(Results, { manager: createMockManager({}) });
    expect(screen.getByText("No scores yet. Finish a round to see results!")).toBeInTheDocument();
  });
});
