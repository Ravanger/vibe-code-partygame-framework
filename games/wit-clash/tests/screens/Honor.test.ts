import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { BestAnswer } from "../../src/state.js";
import HonorVote from "../../ui/screens/HonorVote.svelte";
import { addMine, connectedClient } from "../helpers/client.js";

const best = (authorId: string, authorName: string, text: string): BestAnswer =>
  Object.assign(new BestAnswer(), { authorId, authorName, text });

function honor(mine: { canVote?: boolean; honorVote?: string }) {
  const c = connectedClient({}, "HonorVote");
  c.state.bestAnswers.push(best("p1", "Ann", "a goose"), best("p2", "Bob", "soup"));
  c.state.votesCast = 1;
  c.state.votesExpected = 3;
  addMine(c.state, c.manager.playerId, mine);
  return c;
}

describe("Honor vote screen", () => {
  it("shows each candidate with their best answer and the turnout", () => {
    render(HonorVote, { manager: honor({ canVote: true }).manager });
    expect(
      screen.getByRole("heading", { name: "Who wrote the funniest answer?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ann/ })).toHaveTextContent("a goose");
    expect(screen.getByRole("button", { name: /Bob/ })).toHaveTextContent("soup");
    expect(screen.getByText("1 of 3 voted")).toBeInTheDocument();
    expect(screen.getByText("Tap the funniest answer")).toBeInTheDocument();
  });

  it("slaps VOTED! on my pick", () => {
    render(HonorVote, { manager: honor({ canVote: true, honorVote: "p1" }).manager });
    expect(screen.getByText("VOTED!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ann/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Bob/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("casts a vote", async () => {
    const c = honor({ canVote: true });
    render(HonorVote, { manager: c.manager });
    await fireEvent.click(screen.getByRole("button", { name: /Bob/ }));
    expect(c.room.requests).toEqual([
      { type: "ACTION", payload: { authorId: "p2", type: "VOTE_HONOR" } },
    ]);
  });

  it("sends a TV to the phones", () => {
    const c = honor({ canVote: true });
    c.state.players.delete(c.manager.playerId);
    render(HonorVote, { manager: c.manager });
    expect(screen.getByText("Cast your votes on your phones.")).toBeInTheDocument();
  });

  it("tells the sole candidate to sit tight and blocks the buttons", () => {
    render(HonorVote, { manager: honor({ canVote: false }).manager });
    expect(screen.getByText(/only one up/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ann/ })).toBeDisabled();
  });

  it("waits when there are no candidates", () => {
    render(HonorVote, { manager: connectedClient({}, "HonorVote").manager });
    expect(screen.getByText("Waiting for the best answers...")).toBeInTheDocument();
  });
});
