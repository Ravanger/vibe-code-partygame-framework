import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import TieBreakerPrompting from "../../ui/screens/TieBreakerPrompting.svelte";
import TieBreakerReveal from "../../ui/screens/TieBreakerReveal.svelte";
import TieBreakerVote from "../../ui/screens/TieBreakerVote.svelte";
import {
  addMine,
  addSeat,
  answer,
  connectedClient,
  matchup,
  prompt,
  withoutTyping,
} from "../helpers/client.js";

function tieBreaker(phase: string, contender = true) {
  const c = connectedClient({ name: "Me" }, phase);
  addSeat(c.state, "zed-12345", { name: "Zed" });
  c.state.tieBreakers.push(matchup("tb1", "Name a bird", []));
  if (contender) c.state.tieBreakerContenders.push(c.manager.playerId);
  c.state.tieBreakerContenders.push("zed-12345");
  return c;
}

describe("Tie-breaker answering screen", () => {
  it("lets a contender answer", async () => {
    const c = tieBreaker("TieBreakerPrompting");
    addMine(c.state, c.manager.playerId).prompts.push(prompt("tb1", "Name a bird"));
    render(TieBreakerPrompting, { manager: c.manager });
    expect(screen.getByRole("heading", { name: "Name a bird" })).toBeInTheDocument();
    expect(screen.getByText("Tied for the lead: Me, Zed")).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Submit" });
    expect(submit).toBeDisabled();
    await fireEvent.input(screen.getByLabelText("Your answer"), { target: { value: "Pigeon" } });
    expect(screen.getByText("194 chars left")).toBeInTheDocument();
    await fireEvent.click(submit);
    expect(withoutTyping(c)).toEqual([
      { type: "ACTION", payload: { matchupId: "tb1", answer: "Pigeon", type: "SUBMIT_ANSWER" } },
    ]);
  });

  it("offers an update once the answer is in", () => {
    const c = tieBreaker("TieBreakerPrompting");
    addMine(c.state, c.manager.playerId).prompts.push(prompt("tb1", "Name a bird", true));
    render(TieBreakerPrompting, { manager: c.manager });
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
  });

  it("asks everyone else to wait", () => {
    render(TieBreakerPrompting, { manager: tieBreaker("TieBreakerPrompting", false).manager });
    expect(screen.getByText(/sit tight while the tied players answer/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Your answer")).not.toBeInTheDocument();
  });
});

describe("Tie-breaker vote screen", () => {
  function voting(contender: boolean, mine: { canVote: boolean }) {
    const c = tieBreaker("TieBreakerVoting", contender);
    c.state.tieBreakers[0]?.answers.push(answer("a1", "Pigeon"), answer("a2", "Heron"));
    c.state.votesCast = 1;
    c.state.votesExpected = 3;
    addMine(c.state, c.manager.playerId, mine);
    return c;
  }

  it("casts a vote", async () => {
    const c = voting(false, { canVote: true });
    render(TieBreakerVote, { manager: c.manager });
    expect(screen.getByRole("heading", { name: "Name a bird" })).toBeInTheDocument();
    expect(screen.getByText("1 of 3 voted")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Heron" }));
    expect(c.room.requests).toEqual([
      { type: "ACTION", payload: { answerId: "a2", type: "CAST_VOTE" } },
    ]);
  });

  it("tells anyone who cannot vote to wait", () => {
    render(TieBreakerVote, { manager: voting(true, { canVote: false }).manager });
    expect(screen.getByText(/sit tight while the others vote/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Heron" })).toBeDisabled();
  });
});

describe("Tie-breaker reveal screen", () => {
  it("shows the answers with authors and votes", () => {
    const c = tieBreaker("TieBreakerReveal");
    const current = c.state.tieBreakers[0];
    current?.answers.push(
      answer("a1", "Pigeon", {
        votes: 2,
        authorId: c.manager.playerId,
        authorName: "Me",
        isWinner: true,
      }),
      answer("a2", "Heron", { votes: 1, authorId: "zed-12345", authorName: "Zed" }),
    );
    if (current) current.isRevealed = true;
    render(TieBreakerReveal, { manager: c.manager });
    expect(screen.getByText("by Me (you)")).toBeInTheDocument();
    expect(screen.getByText("2 votes")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Winner" })).toBeInTheDocument();
    expect(screen.getByText(/next up in/i)).toBeInTheDocument();
  });

  it("waits until it is revealed", () => {
    render(TieBreakerReveal, { manager: tieBreaker("TieBreakerReveal").manager });
    expect(screen.getByText("Revealing...")).toBeInTheDocument();
  });
});
