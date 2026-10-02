import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CategoryVote from "../../ui/screens/CategoryVote.svelte";
import MatchupReveal from "../../ui/screens/MatchupReveal.svelte";
import MatchupVote from "../../ui/screens/MatchupVote.svelte";
import Prompting from "../../ui/screens/Prompting.svelte";
import Results from "../../ui/screens/Results.svelte";
import {
  addMine,
  answer,
  connectedClient,
  matchup,
  option,
  prompt,
  scoreRow,
  withoutTyping,
} from "../helpers/client.js";

describe("Category vote screen", () => {
  function categories() {
    const c = connectedClient({}, "CategorySelection");
    c.state.categoryOptions.push(option("a", 1), option("b", 0));
    c.state.roundNumber = 2;
    c.state.totalRounds = 3;
    c.state.votesCast = 1;
    c.state.votesExpected = 4;
    addMine(c.state, c.manager.playerId, { categoryVote: "a" });
    return c;
  }

  it("shows the round, the options with tallies, my choice and the turnout", () => {
    render(CategoryVote, { manager: categories().manager });
    expect(screen.getByText("Round 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /name a/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /name b/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByText("1 vote")).toBeInTheDocument();
    expect(screen.getByText("0 votes")).toBeInTheDocument();
    expect(screen.getByText("1 of 4 voted")).toBeInTheDocument();
  });

  it("marks my pick with a sticker and shows the votes as pips", () => {
    const { container } = render(CategoryVote, { manager: categories().manager });
    expect(screen.getAllByText("MY PICK")).toHaveLength(1);
    expect(container.querySelectorAll(".pips i")).toHaveLength(1);
  });

  it("burns a sparkler for the voting time", () => {
    const { container } = render(CategoryVote, { manager: categories().manager });
    expect(container.querySelector(".sparkler")).toBeInTheDocument();
  });

  it("votes when a card is clicked", async () => {
    const c = categories();
    render(CategoryVote, { manager: c.manager });
    await fireEvent.click(screen.getByRole("button", { name: /name b/i }));
    expect(c.room.requests).toEqual([
      { type: "ACTION", payload: { categoryId: "b", type: "VOTE_CATEGORY" } },
    ]);
  });
});

describe("Prompting screen", () => {
  function writing() {
    const c = connectedClient({}, "Prompting");
    const mine = addMine(c.state, c.manager.playerId);
    mine.prompts.push(prompt("m1", "First prompt"), prompt("m2", "Second prompt"));
    c.state.progress.set(c.manager.playerId, 0);
    c.state.answersPerPlayer = 2;
    c.state.roundNumber = 1;
    c.state.totalRounds = 3;
    return { c, mine };
  }

  it("tells a player who was dealt nothing that they vote this round, then shows prompts", () => {
    const empty = connectedClient({}, "Prompting");
    const { unmount } = render(Prompting, { manager: empty.manager });
    expect(
      screen.getByText("You're sitting this round out — you'll vote on the answers."),
    ).toBeInTheDocument();
    unmount();
    render(Prompting, { manager: writing().c.manager });
    expect(screen.getByRole("heading", { name: "First prompt" })).toBeInTheDocument();
    expect(screen.getByText("Round 1 of 3")).toBeInTheDocument();
  });

  it("names the category that won the vote", () => {
    const { c } = writing();
    c.state.categoryOptions.push(option("a"), option("b"));
    c.state.selectedCategory = "b";
    render(Prompting, { manager: c.manager });
    expect(screen.getByText("E Name b")).toBeInTheDocument();
  });

  it("submits the typed answer and moves to the next prompt", async () => {
    const { c } = writing();
    render(Prompting, { manager: c.manager });
    const submit = screen.getByRole("button", { name: "Submit" });
    expect(submit).toBeDisabled();
    await fireEvent.input(screen.getByLabelText("Your answer"), { target: { value: "Mango" } });
    expect(screen.getByText("195 chars left")).toBeInTheDocument();
    await fireEvent.click(submit);
    await screen.findByRole("heading", { name: "Second prompt" });
    expect(withoutTyping(c)).toEqual([
      {
        type: "ACTION",
        payload: { matchupId: "m1", answer: "Mango", type: "SUBMIT_ANSWER" },
      },
    ]);
  });

  it("submits on Enter and lets Shift+Enter through", async () => {
    const { c } = writing();
    render(Prompting, { manager: c.manager });
    const box = screen.getByLabelText("Your answer");
    await fireEvent.input(box, { target: { value: "Quick" } });
    await fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(withoutTyping(c)).toEqual([]);
    await fireEvent.keyDown(box, { key: "Enter" });
    expect(withoutTyping(c)).toHaveLength(1);
  });

  it("jumps between prompts and ticks the ones the server accepted", async () => {
    const { c, mine } = writing();
    const [first] = mine.prompts;
    if (first) first.submitted = true;
    render(Prompting, { manager: c.manager });
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
    const tab = screen.getByRole("button", { name: "Prompt 1" });
    expect(tab).toHaveAttribute("aria-pressed", "true");
    expect(tab).toHaveTextContent("✓");
    await fireEvent.click(screen.getByRole("button", { name: "Prompt 2" }));
    expect(screen.getByRole("heading", { name: "Second prompt" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("collapses into a done note once everything is in, and reopens to edit", async () => {
    const { c, mine } = writing();
    for (const p of mine.prompts) p.submitted = true;
    render(Prompting, { manager: c.manager });
    expect(screen.getByText(/all answers in/i)).toBeInTheDocument();
    expect(screen.getByText("Waiting for the others: 0 of 2 answers in")).toBeInTheDocument();
    expect(screen.queryByLabelText("Your answer")).not.toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Edit answers" }));
    expect(screen.getByLabelText("Your answer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
  });

  it("shows a TV the count and the strip, without any input", () => {
    const c = connectedClient({}, "Prompting");
    c.state.players.delete(c.manager.playerId);
    c.state.answersPerPlayer = 2;
    c.state.progress.set("zed-12345", 1);
    render(Prompting, { manager: c.manager });
    expect(screen.getByText("1 of 2 answers in")).toBeInTheDocument();
    expect(screen.queryByLabelText("Your answer")).not.toBeInTheDocument();
  });
});

describe("Matchup vote screen", () => {
  function voting(mine: { canVote: boolean; isOwnMatchup: boolean; matchupVote?: string }) {
    const c = connectedClient({}, "MatchupVoting");
    c.state.matchups.push(
      matchup("m1", "Name a fruit", [answer("a1", "Mango"), answer("a2", "Kiwi")]),
    );
    c.state.activeMatchupIndex = 0;
    c.state.votesCast = 1;
    c.state.votesExpected = 3;
    addMine(c.state, c.manager.playerId, mine);
    return c;
  }

  it("shows only the answers and the turnout, and my own vote", () => {
    render(MatchupVote, {
      manager: voting({ canVote: true, isOwnMatchup: false, matchupVote: "a2" }).manager,
    });
    expect(screen.getByRole("heading", { name: "Name a fruit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kiwi" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Mango" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("1 of 3 voted")).toBeInTheDocument();
    expect(screen.getByText("Matchup 1 of 1")).toBeInTheDocument();
    expect(screen.queryByText(/by /)).not.toBeInTheDocument();
  });

  it("slaps VOTED! on my pick and says how to switch", () => {
    render(MatchupVote, {
      manager: voting({ canVote: true, isOwnMatchup: false, matchupVote: "a2" }).manager,
    });
    expect(screen.getByText("VOTED!")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/tap the other one to switch/i);
  });

  it("asks for a vote until one is cast, and sends a TV to the phones", () => {
    const open = render(MatchupVote, {
      manager: voting({ canVote: true, isOwnMatchup: false }).manager,
    });
    expect(screen.getByText("Tap the funnier answer")).toBeInTheDocument();
    expect(screen.queryByText("VOTED!")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    open.unmount();
    const tv = voting({ canVote: false, isOwnMatchup: false });
    tv.state.players.delete(tv.manager.playerId);
    render(MatchupVote, { manager: tv.manager });
    expect(screen.getByText("Cast your votes on your phones.")).toBeInTheDocument();
  });

  it("casts a vote", async () => {
    const c = voting({ canVote: true, isOwnMatchup: false });
    render(MatchupVote, { manager: c.manager });
    await fireEvent.click(screen.getByRole("button", { name: "Mango" }));
    expect(c.room.requests).toEqual([
      { type: "ACTION", payload: { answerId: "a1", type: "CAST_VOTE" } },
    ]);
  });

  it("tells an author to sit tight and blocks the buttons", () => {
    render(MatchupVote, { manager: voting({ canVote: false, isOwnMatchup: true }).manager });
    expect(screen.getByText(/this one is yours/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mango" })).toBeDisabled();
  });

  it("explains a non-voter who is not an author", () => {
    render(MatchupVote, { manager: voting({ canVote: false, isOwnMatchup: false }).manager });
    expect(screen.getByText(/cannot vote on this one/i)).toBeInTheDocument();
  });

  it("says so when a matchup has a single answer and nobody votes", () => {
    const c = voting({ canVote: false, isOwnMatchup: false });
    const [forfeit] = c.state.matchups;
    if (forfeit) forfeit.isForfeit = true;
    render(MatchupVote, { manager: c.manager });
    expect(screen.getByText("Only one answer came in — no vote needed.")).toBeInTheDocument();
    expect(screen.queryByText(/cannot vote on this one/i)).not.toBeInTheDocument();
  });

  it("waits when there is no matchup", () => {
    render(MatchupVote, { manager: connectedClient({}, "MatchupVoting").manager });
    expect(screen.getByText("Waiting for matchup...")).toBeInTheDocument();
  });
});

describe("Matchup reveal screen", () => {
  it("shows authors, counts and the winner", () => {
    const c = connectedClient({}, "MatchupReveal");
    c.state.matchups.push(
      matchup(
        "m1",
        "Name a fruit",
        [
          answer("a1", "Mango", {
            votes: 2,
            authorId: c.manager.playerId,
            authorName: "Me",
            isWinner: true,
          }),
          answer("a2", "Kiwi", { votes: 1, authorId: "zed-12345", authorName: "Zed" }),
        ],
        { isRevealed: true, isClash: true },
      ),
    );
    c.state.activeMatchupIndex = 0;
    render(MatchupReveal, { manager: c.manager });
    expect(screen.getByText("by Me (you)")).toBeInTheDocument();
    expect(screen.getByText("by Zed")).toBeInTheDocument();
    expect(screen.getByText("1 vote")).toBeInTheDocument();
    expect(screen.getByText("2 votes")).toBeInTheDocument();
    expect(screen.getByText("CLASH!")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Winner" })).toBeInTheDocument();
    expect(screen.getByText(/next up in 0s/i)).toBeInTheDocument();
  });

  it("marks the answer I voted for", () => {
    const c = connectedClient({}, "MatchupReveal");
    c.state.matchups.push(
      matchup(
        "m1",
        "Name a fruit",
        [
          answer("a1", "Mango", { authorId: "zed-12345", authorName: "Zed", isWinner: true }),
          answer("a2", "Kiwi", { authorId: "amy-12345", authorName: "Amy" }),
        ],
        { isRevealed: true },
      ),
    );
    c.state.activeMatchupIndex = 0;
    addMine(c.state, c.manager.playerId, { matchupVote: "a2" });
    render(MatchupReveal, { manager: c.manager });
    expect(screen.getAllByText("MY PICK")).toHaveLength(1);
    expect(screen.queryByText("NO SHOW")).not.toBeInTheDocument();
    expect(screen.queryByText("CLASH!")).not.toBeInTheDocument();
  });

  it("shows a forfeit as one, without vote counts", () => {
    const c = connectedClient({}, "MatchupReveal");
    c.state.matchups.push(
      matchup(
        "m1",
        "Name a fruit",
        [
          answer("a1", "Mango", { authorId: "zed-12345", authorName: "Zed", isWinner: true }),
          answer("a2", "(no answer)", { authorId: "amy-12345", authorName: "Amy" }),
        ],
        { isRevealed: true, isForfeit: true },
      ),
    );
    c.state.activeMatchupIndex = 0;
    render(MatchupReveal, { manager: c.manager });
    expect(screen.getByText(/won by forfeit/i)).toBeInTheDocument();
    expect(screen.getByText("NO SHOW")).toBeInTheDocument();
    expect(screen.queryByText(/votes?$/)).not.toBeInTheDocument();
  });

  it("waits until the matchup is revealed", () => {
    render(MatchupReveal, { manager: connectedClient({}, "MatchupReveal").manager });
    expect(screen.getByText("Revealing...")).toBeInTheDocument();
  });
});

describe("Results screen", () => {
  function results(role: "host" | "player", isFinalRound: boolean) {
    const c = connectedClient({ role }, "Results");
    c.state.isFinalRound = isFinalRound;
    c.state.roundNumber = isFinalRound ? 3 : 1;
    c.state.totalRounds = 3;
    c.state.scoreboard.push(
      scoreRow("ann", 500, { name: "Ann", roundPoints: 250, matchupsWon: 1, hadClash: true }),
      scoreRow("bob", 100, { name: "Bob", hasLeft: true }),
    );
    c.state.matchups.push(
      matchup(
        "m1",
        "Name a fruit",
        [answer("a1", "Mango", { authorName: "Ann", isWinner: true })],
        {
          isRevealed: true,
        },
      ),
    );
    return c;
  }

  it("shows the round's recap and the scoreboard to a guest who waits for the host", () => {
    render(Results, { manager: results("player", false).manager });
    expect(screen.getByRole("heading", { name: "Round 1 of 3 Results" })).toBeInTheDocument();
    expect(screen.getByText("Name a fruit")).toBeInTheDocument();
    const rows = screen.getAllByText(/^#\d$/);
    expect(rows).toHaveLength(2);
    expect(screen.getByText("Bob (left)")).toBeInTheDocument();
    expect(screen.getByText("+250")).toBeInTheDocument();
    expect(screen.getByText("CLASH")).toBeInTheDocument();
    expect(screen.getByText("Waiting for host to continue...")).toBeInTheDocument();
  });

  it("lets the host start the next round", async () => {
    const c = results("host", false);
    render(Results, { manager: c.manager });
    await fireEvent.click(screen.getByRole("button", { name: "Next Round" }));
    expect(c.room.requests).toEqual([{ type: "ACTION", payload: { type: "NEXT_ROUND" } }]);
  });

  it("announces the winner after the final round and lets the host play again", async () => {
    const c = results("host", true);
    render(Results, { manager: c.manager });
    expect(screen.getByRole("heading", { name: "Game Over!" })).toBeInTheDocument();
    expect(within(screen.getByText(/wins with/i)).getByText(/Ann/)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Play Again" }));
    expect(c.room.requests).toEqual([{ type: "ACTION", payload: { type: "PLAY_AGAIN" } }]);
  });

  it("names joint winners, and waits for the host to restart", () => {
    const c = results("player", true);
    c.state.scoreboard.push(scoreRow("cy", 500, { name: "Cy" }));
    c.state.scoreboard.sort((a, b) => b.score - a.score);
    render(Results, { manager: c.manager });
    expect(screen.getByText(/Ann & Cy win with 500 points/)).toBeInTheDocument();
    expect(screen.getByText("Waiting for host to start a new game...")).toBeInTheDocument();
  });

  it("shows no banner when nobody has scored", () => {
    const c = connectedClient({}, "Results");
    c.state.isFinalRound = true;
    render(Results, { manager: c.manager });
    expect(screen.queryByText(/wins with/i)).not.toBeInTheDocument();
  });
});
