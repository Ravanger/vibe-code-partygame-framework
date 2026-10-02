import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import JoinNextRound from "../../ui/screens/JoinNextRound.svelte";
import WaitingRoom from "../../ui/screens/WaitingRoom.svelte";
import Welcome from "../../ui/screens/Welcome.svelte";
import { addSeat, connectedClient, scoreRow, stubFetch } from "../helpers/client.js";

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
    expect(await screen.findByRole("alert")).toHaveTextContent(/server down/i);
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
    expect(await screen.findByRole("alert")).toHaveTextContent("Game code not found");
    await fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("joins straight away from a share link", async () => {
    window.history.replaceState({}, "", "/?code=qrst");
    const network = stubFetch({ error: "Game code not found" });
    const { manager } = connectedClient();
    manager.dispose();
    render(Welcome, { manager });
    expect(await screen.findByRole("alert")).toHaveTextContent("Game code not found");
    expect(network.urls).toEqual([expect.stringContaining("code=QRST")]);
  });
});

describe("Waiting room", () => {
  function lobby(role: "host" | "player", others = 2) {
    const c = connectedClient({ role, name: "Me" });
    c.state.canStart = others + 1 >= c.state.minPlayers;
    for (let i = 0; i < others; ++i) addSeat(c.state, `friend-${i}-1234`, { name: `Friend ${i}` });
    return c;
  }

  it("shows the players and the round count for a named player", () => {
    const { manager } = lobby("player");
    render(WaitingRoom, { manager });
    expect(screen.getByText("Friend 0")).toBeInTheDocument();
    expect(screen.getByText("(You)")).toBeInTheDocument();
    expect(screen.getByText("Total rounds")).toBeInTheDocument();
    expect(screen.getByText(/waiting for the host/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start game/i })).not.toBeInTheDocument();
  });

  it("marks the host, the disconnected and the unnamed", () => {
    const c = connectedClient({ role: "host" });
    addSeat(c.state, "away-1234", { name: "Away", isConnected: false });
    addSeat(c.state, "new-12345", { name: "", isReady: false });
    render(WaitingRoom, { manager: c.manager });
    expect(screen.getByText("Host")).toBeInTheDocument();
    expect(screen.getByText("(Disconnected)")).toBeInTheDocument();
    expect(screen.getByText("Choosing a name...")).toBeInTheDocument();
  });

  it("lets the host start once enough players are ready", async () => {
    const short = lobby("host", 1);
    const { unmount } = render(WaitingRoom, { manager: short.manager });
    expect(screen.getByRole("button", { name: /start game/i })).toBeDisabled();
    expect(screen.getByText(/at least 3 players/i)).toBeInTheDocument();
    unmount();

    const full = lobby("host", 2);
    render(WaitingRoom, { manager: full.manager });
    await fireEvent.click(screen.getByRole("button", { name: /start game/i }));
    expect(full.room.requests).toEqual([{ type: "ACTION", payload: { type: "START_GAME" } }]);
  });

  it("sends the name after typing pauses", async () => {
    vi.useFakeTimers();
    const c = lobby("player");
    render(WaitingRoom, { manager: c.manager });
    const input = screen.getByLabelText("Your name");
    expect(input).toHaveValue("Me");
    await fireEvent.input(input, { target: { value: "Maya" } });
    vi.advanceTimersByTime(300);
    expect(c.room.sent).toEqual([{ type: "SET_NAME", payload: "Maya" }]);
  });

  it("shows why the game ended and lets anyone leave", async () => {
    const c = lobby("player");
    c.state.notice = "The host ended the game.";
    const leave = vi.spyOn(c.manager, "leave").mockResolvedValue();
    render(WaitingRoom, { manager: c.manager });
    expect(screen.getByRole("status")).toHaveTextContent("The host ended the game.");
    await fireEvent.click(screen.getByRole("button", { name: "Leave game" }));
    expect(leave).toHaveBeenCalledOnce();
  });

  it("shows no notice when nothing ended the game", () => {
    render(WaitingRoom, { manager: lobby("player").manager });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("copies the room code", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(WaitingRoom, { manager: lobby("host").manager });
    await fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("ABCD");
    vi.unstubAllGlobals();
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
