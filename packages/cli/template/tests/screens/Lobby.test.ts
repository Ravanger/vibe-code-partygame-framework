import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import Lobby from "../../ui/screens/Lobby.svelte";
import { addSeat, connectedClient } from "../helpers/client.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Waiting room", () => {
  function lobby(role: "host" | "player", others = 2) {
    const c = connectedClient({ role, name: "Me" });
    c.state.canStart = others + 1 >= c.state.minPlayers;
    for (let i = 0; i < others; ++i) addSeat(c.state, `friend-${i}-1234`, { name: `Friend ${i}` });
    return c;
  }

  it("shows the players and tells a named guest to wait for the host", () => {
    const c = lobby("player");
    render(Lobby, { manager: c.manager });
    expect(screen.getByText("Friend 0")).toBeInTheDocument();
    expect(screen.getByText("(You)")).toBeInTheDocument();
    expect(screen.getByText(/waiting for the host/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start/i })).not.toBeInTheDocument();
    expect(screen.queryByText("ABCD", { selector: ".room-code" })).not.toBeInTheDocument();
  });

  it("marks the host, the disconnected and the unnamed, and shows the share link", () => {
    const c = connectedClient({ role: "host" });
    addSeat(c.state, "away-1234", { name: "Away", isConnected: false });
    addSeat(c.state, "new-12345", { name: "", isReady: false });
    render(Lobby, { manager: c.manager });
    expect(screen.getByText("Host")).toBeInTheDocument();
    expect(screen.getByText("(Disconnected)")).toBeInTheDocument();
    expect(screen.getByText("Choosing a name...")).toBeInTheDocument();
    expect(screen.getByText("ABCD", { selector: ".room-code" })).toBeInTheDocument();
    expect(screen.getByText(/\?code=ABCD/)).toBeInTheDocument();
  });

  it("lets the host start once enough players are ready", async () => {
    const short = lobby("host", 0);
    const { unmount } = render(Lobby, { manager: short.manager });
    expect(screen.getByRole("button", { name: /start/i })).toBeDisabled();
    unmount();

    const full = lobby("host", 1);
    render(Lobby, { manager: full.manager });
    await fireEvent.click(screen.getByRole("button", { name: /start/i }));
    expect(full.room.requests).toEqual([{ type: "ACTION", payload: { type: "START_GAME" } }]);
  });

  it("sends the name after typing pauses", async () => {
    vi.useFakeTimers();
    const c = lobby("player");
    render(Lobby, { manager: c.manager });
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
    render(Lobby, { manager: c.manager });
    expect(screen.getByText("The host ended the game.")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Leave game" }));
    expect(leave).toHaveBeenCalledOnce();
  });

  it("shows no notice when nothing ended the game", () => {
    render(Lobby, { manager: lobby("player").manager });
    expect(screen.queryByText(/ended the game/i)).not.toBeInTheDocument();
  });

  it("gives a spectator the room code but no name input", () => {
    const c = connectedClient({ role: "host" });
    c.state.players.delete(c.manager.playerId);
    render(Lobby, { manager: c.manager });
    expect(screen.getByText("ABCD", { selector: ".room-code" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
  });
});
