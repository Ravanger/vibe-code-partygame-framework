import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { BluffOption, RevealEntry } from "../../src/state.js";
import Reveal from "../../ui/screens/Reveal.svelte";
import { connectedClient } from "../helpers/client.js";

describe("Reveal screen", () => {
  it("highlights the truth and shows authors, votes and the round's points", () => {
    const c = connectedClient({}, "Reveal");
    c.state.roundNumber = 1;
    c.state.totalRounds = 3;
    c.state.truthRevealedId = "o1";
    c.state.choices.push(
      Object.assign(new BluffOption(), {
        id: "o1",
        text: "Canberra",
        authorName: "The game",
        votes: 2,
      }),
      Object.assign(new BluffOption(), { id: "o2", text: "Sydney", authorName: "Ann", votes: 1 }),
    );
    c.state.results.push(
      Object.assign(new RevealEntry(), {
        playerId: "ann-12345",
        name: "Ann",
        roundPoints: 3,
        fooledCount: 0,
        guessedTruth: true,
      }),
      Object.assign(new RevealEntry(), {
        playerId: c.me.id,
        name: "Me",
        roundPoints: 2,
        fooledCount: 2,
        guessedTruth: false,
      }),
    );
    render(Reveal, { manager: c.manager });

    expect(screen.getByText("Round 1 of 3")).toBeInTheDocument();
    const truth = screen.getByText("Canberra").closest("li");
    expect(truth).toHaveClass("truth");
    expect(screen.getByText("the truth")).toBeInTheDocument();
    expect(screen.getByText(/The game · 2 votes/)).toBeInTheDocument();
    expect(screen.getByText(/Ann · 1 vote/)).toBeInTheDocument();

    expect(screen.getByText("+3")).toBeInTheDocument();
    expect(screen.getByText("guessed the truth")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText("2 fooled")).toBeInTheDocument();
  });
});
