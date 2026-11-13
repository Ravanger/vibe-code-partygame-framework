import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import Lobby from "../../ui/screens/Lobby.svelte";
import { addSeat, connectedClient } from "../helpers/client.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Waiting room", () => {
  function lobby(role: "host" | "player", others = 1) {
    const c = connectedClient({ role, name: "Me" });
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

  it("shows the host the code, the QR code and the share link, and starts once ready", async () => {
    const c = lobby("host");
    c.state.canStart = true;
    render(Lobby, { manager: c.manager });
    expect(screen.getByText("ABCD", { selector: ".room-code" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /qr code/i })).toBeInTheDocument();
    expect(screen.getByText(/\?code=ABCD/)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: /start/i }));
    expect(c.room.requests).toEqual([{ type: "ACTION", payload: { type: "START_GAME" } }]);
  });

  it("gives a spectator the room code but no name input", () => {
    const c = connectedClient({ role: "host" });
    c.state.players.delete(c.manager.playerId);
    render(Lobby, { manager: c.manager });
    expect(screen.getByText("ABCD", { selector: ".room-code" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
  });

  it("asks twice before removing a player, then sends the kick", async () => {
    const c = connectedClient({ role: "host" });
    addSeat(c.state, "bob-12345", { name: "Bob" });
    render(Lobby, { manager: c.manager });
    await fireEvent.click(screen.getByRole("button", { name: "Remove Bob" }));
    expect(screen.getByText("Remove?")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(c.room.requests).toEqual([]);
    await fireEvent.click(screen.getByRole("button", { name: "Remove Bob" }));
    await fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(c.room.requests).toEqual([
      { type: "ACTION", payload: { playerId: "bob-12345", type: "KICK_PLAYER" } },
    ]);
  });
});
