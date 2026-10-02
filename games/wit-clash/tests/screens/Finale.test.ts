import { render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BestAnswer } from "../../src/state.js";
import Prompting from "../../ui/screens/Prompting.svelte";
import Results from "../../ui/screens/Results.svelte";
import TieBreakerPrompting from "../../ui/screens/TieBreakerPrompting.svelte";
import { addMine, addSeat, connectedClient, matchup, prompt, scoreRow } from "../helpers/client.js";

describe("Results podium and awards", () => {
  function finale() {
    const c = connectedClient({ name: "Ann" }, "Results");
    c.state.isFinalRound = true;
    c.state.scoreboard.push(
      scoreRow(c.manager.playerId, 500, { name: "Ann", wonTieBreaker: true }),
      scoreRow("cy", 300, { name: "Cy" }),
      scoreRow("bob", 900, { name: "Bob", hasLeft: true }),
    );
    return c;
  }

  it("shows the top seated places, skips leavers and shows the tie-breaker winner", () => {
    render(Results, { manager: finale().manager });
    const podium = within(screen.getByLabelText("Podium"));
    expect(podium.getByText("1st")).toBeInTheDocument();
    expect(podium.getByText("2nd")).toBeInTheDocument();
    expect(podium.queryByText("3rd")).not.toBeInTheDocument();
    expect(podium.getByText("Ann")).toBeInTheDocument();
    expect(podium.getByText("Cy")).toBeInTheDocument();
    expect(podium.queryByText("Bob")).not.toBeInTheDocument();
    expect(podium.queryByText("left")).not.toBeInTheDocument();
    expect(podium.getByText("Won the tie-breaker")).toBeInTheDocument();
    expect(screen.getByText("TIE-BREAKER")).toBeInTheDocument();
    expect(screen.getByText("Bob (left)")).toBeInTheDocument();
  });

  it("hides the podium and the award when there is nothing to show", () => {
    render(Results, { manager: connectedClient({}, "Results").manager });
    expect(screen.queryByLabelText("Podium")).not.toBeInTheDocument();
    expect(screen.queryByText(/best answer/i)).not.toBeInTheDocument();
  });

  it("gives tied players one step and the next tier the next step", () => {
    const c = connectedClient({ name: "Ann" }, "Results");
    c.state.scoreboard.push(
      scoreRow("a", 300, { name: "Ann" }),
      scoreRow("b", 300, { name: "Bea" }),
      scoreRow("c", 100, { name: "Cy" }),
    );
    render(Results, { manager: c.manager });
    const podium = within(screen.getByLabelText("Podium"));
    expect(podium.getAllByRole("listitem")).toHaveLength(2);
    expect(podium.getByText("1st")).toBeInTheDocument();
    expect(podium.getByText("2nd")).toBeInTheDocument();
    expect(podium.queryByText("3rd")).not.toBeInTheDocument();
  });

  it("rains confetti only once the game is over", () => {
    const final = render(Results, { manager: finale().manager });
    expect(final.container.querySelectorAll(".confetti i")).toHaveLength(40);
    expect(final.container.querySelector(".confetti")).toHaveAttribute("aria-hidden", "true");
    final.unmount();
    const round = render(Results, { manager: connectedClient({}, "Results").manager });
    expect(round.container.querySelector(".confetti")).not.toBeInTheDocument();
  });

  it("folds the recap after the scoreboard", () => {
    const c = finale();
    c.state.matchups.push(matchup("m1", "Name a fruit", [], { isRevealed: true }));
    render(Results, { manager: c.manager });
    const recap = screen.getByText("Matchup recap");
    expect(recap.closest("details")).not.toHaveAttribute("open");
    expect(within(screen.getByLabelText("Scoreboard")).getByText("Cy")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Scoreboard").compareDocumentPosition(recap) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  function award(text: string, authorId: string, authorName: string, votes: number) {
    return Object.assign(new BestAnswer(), {
      text,
      authorId,
      authorName,
      promptText: "Name a fruit",
      votes,
    });
  }

  it("shows the best answer with prompt, author and votes", () => {
    const c = finale();
    c.state.bestAnswers.push(award("Mango", c.manager.playerId, "Ann", 1));
    render(Results, { manager: c.manager });
    expect(screen.getByRole("heading", { name: "Best answer" })).toBeInTheDocument();
    expect(screen.getByText("Mango")).toBeInTheDocument();
    expect(screen.getByText("Name a fruit")).toBeInTheDocument();
    expect(screen.getByText("by Ann (you)")).toBeInTheDocument();
    expect(screen.getByText("1 vote")).toBeInTheDocument();
  });

  it("shows a shared best answer", () => {
    const c = finale();
    c.state.bestAnswers.push(
      award("Mango", c.manager.playerId, "Ann", 3),
      award("Kiwi", "bob", "Bob", 3),
    );
    render(Results, { manager: c.manager });
    expect(screen.getByRole("heading", { name: "Shared best answer" })).toBeInTheDocument();
    expect(screen.getByText("by Bob")).toBeInTheDocument();
    expect(screen.getAllByText("3 votes")).toHaveLength(2);
  });
});

describe("Results on a TV", () => {
  afterEach(() => vi.useRealTimers());

  function tvFinale(bestCount: number) {
    vi.useFakeTimers();
    const c = connectedClient({}, "Results");
    c.state.players.delete(c.manager.playerId);
    c.state.isFinalRound = true;
    c.state.scoreboard.push(scoreRow("ann", 500, { name: "Ann" }));
    for (let i = 0; i < bestCount; ++i) {
      c.state.bestAnswers.push(
        Object.assign(new BestAnswer(), {
          text: `Answer ${i}`,
          authorId: "ann",
          authorName: "Ann",
        }),
      );
    }
    return c;
  }

  it("takes turns showing the podium and the best answers instead of scrolling", async () => {
    const { container } = render(Results, { manager: tvFinale(2).manager });
    const podium = container.querySelector(".podium-panel");
    const best = screen.getByLabelText("Shared best answer");
    expect(podium).not.toHaveClass("faded");
    expect(best).toHaveClass("faded");
    await vi.advanceTimersByTimeAsync(8000);
    expect(podium).toHaveClass("faded");
    expect(best).not.toHaveClass("faded");
  });

  it("keeps the podium in view when there is no best answer", async () => {
    const { container } = render(Results, { manager: tvFinale(0).manager });
    await vi.advanceTimersByTimeAsync(8000);
    expect(container.querySelector(".podium-panel")).not.toHaveClass("faded");
  });

  it("shows phones everything at once", async () => {
    vi.useFakeTimers();
    const c = connectedClient({ name: "Ann" }, "Results");
    c.state.bestAnswers.push(Object.assign(new BestAnswer(), { text: "Mango", authorId: "x" }));
    const { container } = render(Results, { manager: c.manager });
    await vi.advanceTimersByTimeAsync(8000);
    expect(container.querySelectorAll(".faded")).toHaveLength(0);
  });
});

describe("Answer progress and typing", () => {
  it("shows every player's progress, a done tick and who is typing while prompting", () => {
    const c = connectedClient({ name: "Me" }, "Prompting");
    addSeat(c.state, "zed-12345", { name: "Zed" });
    addSeat(c.state, "amy-12345", { name: "Amy" });
    addMine(c.state, c.manager.playerId).prompts.push(prompt("m1", "Q"));
    c.state.answersPerPlayer = 2;
    c.state.progress.set(c.manager.playerId, 1);
    c.state.progress.set("zed-12345", 2);
    c.state.progress.set("amy-12345", 0);
    c.state.typing.set("amy-12345", true);
    render(Prompting, { manager: c.manager });
    const list = within(screen.getByLabelText("Answer progress"));
    expect(list.getByText("1/2")).toBeInTheDocument();
    expect(list.getByText("2/2")).toBeInTheDocument();
    expect(list.getByRole("img", { name: "Done" })).toBeInTheDocument();
    expect(list.getAllByText("typing…")).toHaveLength(1);
  });

  it("shows it to a TV without a seat, and nothing before anyone is answering", () => {
    const c = connectedClient({}, "Prompting");
    const { unmount } = render(Prompting, { manager: c.manager });
    expect(screen.queryByLabelText("Answer progress")).not.toBeInTheDocument();
    unmount();
    c.state.progress.set("zed-12345", 0);
    c.state.answersPerPlayer = 2;
    c.state.players.delete(c.manager.playerId);
    render(Prompting, { manager: c.manager });
    expect(screen.getByLabelText("Answer progress")).toBeInTheDocument();
  });

  it("shows the contenders' progress during the tie-breaker", () => {
    const c = connectedClient({ name: "Me" }, "TieBreakerPrompting");
    c.state.tieBreakers.push(matchup("tb1", "Name a bird", []));
    c.state.tieBreakerContenders.push(c.manager.playerId);
    c.state.answersPerPlayer = 1;
    c.state.progress.set(c.manager.playerId, 0);
    c.state.typing.set(c.manager.playerId, true);
    render(TieBreakerPrompting, { manager: c.manager });
    const list = within(screen.getByLabelText("Answer progress"));
    expect(list.getByText("0/1")).toBeInTheDocument();
    expect(list.getByText("typing…")).toBeInTheDocument();
  });
});
