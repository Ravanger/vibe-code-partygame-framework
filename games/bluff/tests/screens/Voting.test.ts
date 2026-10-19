import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BluffOption, PlayerPrivate } from "../../src/state.js";
import Voting from "../../ui/screens/Voting.svelte";
import { connectedClient } from "../helpers/client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const addChoice = (c: ReturnType<typeof connectedClient>, id: string, text: string): void => {
  c.state.choices.push(Object.assign(new BluffOption(), { id, text }));
};

describe("Voting screen", () => {
  it("lists every choice and marks the player's own", () => {
    const c = connectedClient({}, "Voting");
    c.state.promptText = "What is the capital of Australia?";
    addChoice(c, "o1", "Canberra");
    addChoice(c, "o2", "Sydney");
    c.state.mine.set(c.me.id, Object.assign(new PlayerPrivate(), { myOptionId: "o1" }));
    render(Voting, { manager: c.manager });

    expect(
      screen.getByRole("heading", { name: "What is the capital of Australia?" }),
    ).toBeInTheDocument();
    const own = screen.getByRole("button", { name: /canberra/i });
    expect(own).toBeDisabled();
    expect(own).toHaveTextContent("yours");
    expect(screen.getByRole("button", { name: /sydney/i })).toBeEnabled();
  });

  it("locks in a vote and stops offering choices", async () => {
    const c = connectedClient({}, "Voting");
    addChoice(c, "o1", "Canberra");
    addChoice(c, "o2", "Sydney");
    render(Voting, { manager: c.manager });

    await fireEvent.click(screen.getByRole("button", { name: /sydney/i }));

    expect(c.room.requests).toContainEqual({
      type: "ACTION",
      payload: { optionId: "o2", type: "CAST_VOTE" },
    });
    expect(await screen.findByText(/vote locked in/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sydney/i })).not.toBeInTheDocument();
  });

  it("shows the running vote count", () => {
    const c = connectedClient({}, "Voting");
    addChoice(c, "o1", "Canberra");
    c.state.votesCast = 2;
    c.state.votesExpected = 4;
    render(Voting, { manager: c.manager });
    expect(screen.getByText("2/4 votes in")).toBeInTheDocument();
  });

  it("gives spectators the count but no choices", () => {
    const c = connectedClient({}, "Voting");
    addChoice(c, "o1", "Canberra");
    c.state.players.delete(c.manager.playerId);
    render(Voting, { manager: c.manager });
    expect(screen.getByText(/watch the votes land/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /canberra/i })).not.toBeInTheDocument();
  });
});
