import { CLIENT_MESSAGES } from "@partygame/shared";
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import CategoryVote from "../../ui/screens/CategoryVote.svelte";
import MatchupVote from "../../ui/screens/MatchupVote.svelte";
import Prompting from "../../ui/screens/Prompting.svelte";
import WaitingRoom from "../../ui/screens/WaitingRoom.svelte";
import Welcome from "../../ui/screens/Welcome.svelte";
import { addSeat, answer, connectedClient, matchup, option } from "../helpers/client.js";

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

function lobby(role: "host" | "player") {
  const c = connectedClient({ role, name: "Me" });
  addSeat(c.state, "bob-12345", { name: "Bob" });
  return c;
}

describe("Welcome screen TV mode", () => {
  it("watches on a TV only with a complete code", async () => {
    const { manager } = connectedClient();
    manager.dispose();
    const watch = vi.spyOn(manager, "joinAsSpectator").mockResolvedValue();
    render(Welcome, { manager });
    const button = screen.getByRole("button", { name: "Watch on a TV" });
    expect(button).toBeDisabled();
    await fireEvent.input(screen.getByLabelText("Game code"), { target: { value: "wxyz" } });
    await fireEvent.click(button);
    expect(watch).toHaveBeenCalledWith("WXYZ");
  });

  it("watches straight away from a TV link", async () => {
    window.history.replaceState({}, "", "/?tv=qrst");
    const { manager } = connectedClient();
    manager.dispose();
    const watch = vi.spyOn(manager, "joinAsSpectator").mockRejectedValue(new Error("No such room"));
    render(Welcome, { manager });
    expect(await screen.findByRole("alert")).toHaveTextContent(CLIENT_MESSAGES.CONNECTION_LOST);
    expect(watch).toHaveBeenCalledExactlyOnceWith("QRST");
  });
});

describe("Waiting room settings", () => {
  it("lets the host change every option within the schema limits", async () => {
    const c = lobby("host");
    render(WaitingRoom, { manager: c.manager });
    const rounds = screen.getByLabelText("Total rounds");
    expect(rounds).toHaveValue(3);
    expect(rounds).toHaveAttribute("min", "1");
    expect(rounds).toHaveAttribute("max", "10");
    expect(screen.getByLabelText("Reveal seconds")).toHaveAttribute("max", "30");
    expect(screen.getAllByRole("spinbutton")).toHaveLength(5);
    await fireEvent.input(rounds, { target: { value: "5" } });
    await fireEvent.change(rounds);
    expect(c.room.requests).toEqual([
      { type: "ACTION", payload: { totalRounds: 5, type: "SET_OPTIONS" } },
    ]);
  });
});

describe("Screens on a TV (no seat)", () => {
  function tv(phase: string) {
    const c = connectedClient({}, phase);
    c.state.players.delete(c.manager.playerId);
    return c;
  }

  it("shows the category tallies without letting anyone vote", () => {
    const c = tv("CategorySelection");
    c.state.categoryOptions.push(option("a", 2), option("b"));
    render(CategoryVote, { manager: c.manager });
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(screen.getByText("2 votes")).toBeInTheDocument();
  });

  it("shows how many answers are in while players write", () => {
    const c = tv("Prompting");
    c.state.progress.set("a", 2);
    c.state.progress.set("b", 1);
    c.state.answersPerPlayer = 2;
    render(Prompting, { manager: c.manager });
    expect(screen.getByText("3 of 4 answers in")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows the matchup being voted on, with the votes left to the phones", () => {
    const c = tv("MatchupVoting");
    c.state.matchups.push(
      matchup("m1", "Worst superpower", [answer("a", "Itch"), answer("b", "Yawn")]),
    );
    c.state.activeMatchupIndex = 0;
    const { container } = render(MatchupVote, { manager: c.manager });
    expect(screen.getByText("Worst superpower")).toBeInTheDocument();
    expect(screen.getByText("Cast your votes on your phones.")).toBeInTheDocument();
    for (const button of within(container).getAllByRole("button")) expect(button).toBeDisabled();
  });
});
