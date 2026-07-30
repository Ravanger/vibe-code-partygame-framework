// TODO: Svelte component rendering tests are skipped due to Bun + @testing-library/svelte incompatibility
// See tests/App.test.ts for details.

import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CategoryVote from "../../ui/screens/CategoryVote.svelte";
import { fakeManager, makeFakeRoom, makeFakeState } from "../helpers/fakes.js";

describe("CategoryVote", () => {
  function makeManager(stateOverrides = {}) {
    const state = makeFakeState({
      phase: "CategorySelection",
      phaseEndsAt: 1_060_000,
      serverNow: 1_000_000,
      categoryOptions: [
        { id: "a", name: "Category A", emoji: "🅰️", votes: 0 },
        { id: "b", name: "Category B", emoji: "🅱️", votes: 0 },
        { id: "c", name: "Category C", emoji: "🇨", votes: 0 },
      ],
      categoryVotes: new Map(),
      players: new Map([
        [
          "me",
          { id: "me", playerId: "me", name: "Me", role: "host", isConnected: true, isReady: true },
        ],
        [
          "p2",
          { id: "p2", playerId: "p2", name: "P2", role: "guest", isConnected: true, isReady: true },
        ],
        [
          "p3",
          { id: "p3", playerId: "p3", name: "P3", role: "guest", isConnected: true, isReady: true },
        ],
      ]),
      ...stateOverrides,
    });
    return fakeManager({
      connectionStatus: "connected",
      stateVersion: 1,
      room: makeFakeRoom({ state, sessionId: "me" }),
    });
  }

  it("renders three category cards", () => {
    const manager = makeManager();
    render(CategoryVote, { manager });
    expect(screen.getByRole("button", { name: /🅰️ Category A/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /🅱️ Category B/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /🇨 Category C/i })).toBeInTheDocument();
  });

  it("shows the countdown", () => {
    const manager = makeManager();
    render(CategoryVote, { manager });
    expect(screen.getByText(/60s/i)).toBeInTheDocument();
  });

  it("clicking a card sends the vote action", () => {
    const manager = makeManager();
    render(CategoryVote, { manager });
    const card = screen.getByRole("button", { name: /🅰️ Category A/i });
    fireEvent.click(card);
    expect(manager.room?.send).toHaveBeenCalledWith("ACTION", {
      type: "VOTE_CATEGORY",
      categoryId: "a",
    });
  });

  it("marks the chosen card with aria-pressed", () => {
    const manager = makeManager({
      categoryVotes: new Map([["me", "b"]]),
    });
    render(CategoryVote, { manager });
    expect(screen.getByRole("button", { name: /🅰️ Category A/i })).not.toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /🅱️ Category B/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /🇨 Category C/i })).not.toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("renders vote counts", () => {
    const manager = makeManager({
      categoryOptions: [
        { id: "a", name: "Category A", emoji: "🅰️", votes: 2 },
        { id: "b", name: "Category B", emoji: "🅱️", votes: 1 },
        { id: "c", name: "Category C", emoji: "🇨", votes: 0 },
      ],
    });
    render(CategoryVote, { manager });
    expect(screen.getByText(/2 votes/i)).toBeInTheDocument();
    expect(screen.getByText(/1 vote/i)).toBeInTheDocument();
  });

  it("shows the urgent class under 10 seconds", () => {
    const manager = makeManager({
      phaseEndsAt: 1_000_005,
      serverNow: 1_000_000,
    });
    const { container } = render(CategoryVote, { manager });
    const timer = container.querySelector(".timer");
    expect(timer).toHaveClass("urgent");
  });

  it("shows vote progress in footer", () => {
    const manager = makeManager({
      categoryVotes: new Map([
        ["me", "a"],
        ["p2", "a"],
      ]),
      categoryOptions: [
        { id: "a", name: "Category A", emoji: "🅰️", votes: 2 },
        { id: "b", name: "Category B", emoji: "🅱️", votes: 0 },
        { id: "c", name: "Category C", emoji: "🇨", votes: 0 },
      ],
    });
    render(CategoryVote, { manager });
    expect(screen.getByText(/2 of 3 voted/i)).toBeInTheDocument();
  });
});
