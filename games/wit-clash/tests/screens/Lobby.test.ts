import { CLIENT_MESSAGES } from "@partygame/shared";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import JoinNextRound from "../../ui/screens/JoinNextRound.svelte";
import Welcome from "../../ui/screens/Welcome.svelte";
import { connectedClient, scoreRow, stubFetch } from "../helpers/client.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("Welcome screen", () => {
  it("hosts a game", async () => {
    const network = stubFetch(new Error("Server down"));
    const { manager } = connectedClient();
    manager.dispose();
    render(Welcome, { manager });
    await fireEvent.click(screen.getByRole("button", { name: /host game/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(CLIENT_MESSAGES.CONNECTION_LOST);
    expect(network.urls.some((url) => url.includes("/matchmake/create/"))).toBe(true);
  });

  it("joins only with a complete code", async () => {
    const network = stubFetch({ error: "Game code not found" });
    const { manager } = connectedClient();
    manager.dispose();
    render(Welcome, { manager });
    const joinButton = screen.getByRole("button", { name: "Join" });
    expect(joinButton).toBeDisabled();
    await fireEvent.input(screen.getByLabelText("Game code"), { target: { value: "ab" } });
    expect(joinButton).toBeDisabled();
    await fireEvent.input(screen.getByLabelText("Game code"), { target: { value: "wxyz" } });
    expect(joinButton).toBeEnabled();
    await fireEvent.click(joinButton);
    await screen.findByRole("alert");
    expect(network.urls).toEqual([expect.stringContaining("code=WXYZ")]);
  });

  it("shows why joining failed and lets the player dismiss it", async () => {
    stubFetch({ error: "Game code not found" });
    const { manager } = connectedClient();
    manager.dispose();
    render(Welcome, { manager });
    await fireEvent.input(screen.getByLabelText("Game code"), { target: { value: "wxyz" } });
    await fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(CLIENT_MESSAGES.ROOM_NOT_FOUND);
    await fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("joins straight away from a share link", async () => {
    window.history.replaceState({}, "", "/?code=qrst");
    const network = stubFetch({ error: "Game code not found" });
    const { manager } = connectedClient();
    manager.dispose();
    render(Welcome, { manager });
    expect(await screen.findByRole("alert")).toHaveTextContent(CLIENT_MESSAGES.ROOM_NOT_FOUND);
    expect(network.urls).toEqual([expect.stringContaining("code=QRST")]);
  });
});

describe("You'll join next round screen", () => {
  it("shows the phase in progress and the read-only scoreboard", () => {
    const c = connectedClient({ isActive: false }, "Prompting");
    c.state.roundNumber = 1;
    c.state.scoreboard.push(scoreRow("ann", 300, { name: "Ann", roundPoints: 300 }));
    render(JoinNextRound, { manager: c.manager });
    expect(screen.getByRole("heading", { name: /join next round/i })).toBeInTheDocument();
    expect(screen.getByText("Everyone is writing answers.")).toBeInTheDocument();
    expect(screen.getByText("Round 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Ann")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
  });

  it("asks a player without a name to pick one, and sends it", async () => {
    vi.useFakeTimers();
    const c = connectedClient({ isActive: false, isReady: false, name: "" }, "Prompting");
    render(JoinNextRound, { manager: c.manager });
    expect(screen.getByRole("heading", { name: "Pick a name to join" })).toBeInTheDocument();
    expect(screen.getByText("You need a name before you can play.")).toBeInTheDocument();
    await fireEvent.input(screen.getByLabelText("Your name"), { target: { value: "Maya" } });
    vi.advanceTimersByTime(300);
    expect(c.room.sent).toEqual([{ type: "SET_NAME", payload: "Maya" }]);
  });

  it("tells a player waiting during the final round that a new game is next", () => {
    const c = connectedClient({ isActive: false }, "Results");
    c.state.roundNumber = 3;
    c.state.totalRounds = 3;
    render(JoinNextRound, { manager: c.manager });
    expect(screen.getByRole("heading", { name: "You'll join the next game" })).toBeInTheDocument();
    expect(screen.getByText("You'll join when the host starts a new game.")).toBeInTheDocument();
  });

  it("omits the scoreboard and the round before anything was scored", () => {
    const c = connectedClient({ isActive: false }, "CategorySelection");
    render(JoinNextRound, { manager: c.manager });
    expect(screen.queryByText(/round \d/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/#1/)).not.toBeInTheDocument();
  });
});
