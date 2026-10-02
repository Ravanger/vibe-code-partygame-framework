import { ErrorCode } from "@partygame/shared";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { describe, expect, it, vi } from "vitest";
import App from "../ui/App.svelte";
import { addMine, addSeat, connectedClient, option } from "./helpers/client.js";

describe("App", () => {
  it("shows the welcome screen until a room is joined", () => {
    const { manager } = connectedClient();
    manager.dispose();
    render(App, { manager });
    expect(screen.getByRole("button", { name: /host game/i })).toBeInTheDocument();
  });

  it("follows the room from the lobby through the phases as patches arrive", () => {
    const c = connectedClient({ role: "host" });
    addSeat(c.state, "b-1234567");
    addSeat(c.state, "c-1234567");
    c.state.canStart = true;
    render(App, { manager: c.manager });
    expect(screen.getByRole("button", { name: /start game/i })).toBeEnabled();
    expect(screen.getByText("ABCD", { selector: ".room-chip" })).toBeInTheDocument();

    c.state.phase = "CategorySelection";
    const first = option("a");
    c.state.categoryOptions.push(first, option("b"));
    addMine(c.state, c.manager.playerId);
    c.patch();
    flushSync();
    expect(screen.getByRole("heading", { name: /pick a category/i })).toBeInTheDocument();

    first.votes = 1;
    c.patch();
    flushSync();
    expect(screen.getByText("1 vote")).toBeInTheDocument();

    c.state.phase = "Intermission";
    c.patch();
    flushSync();
    expect(screen.getByText(/connecting to game server/i)).toBeInTheDocument();
  });

  it("shows the waiting screen to a late joiner", () => {
    const c = connectedClient({ isActive: false }, "Prompting");
    render(App, { manager: c.manager });
    expect(screen.getByRole("heading", { name: /join next round/i })).toBeInTheDocument();
    c.me.isActive = true;
    c.patch();
    flushSync();
    expect(screen.getByText(/sitting this round out/i)).toBeInTheDocument();
  });

  it("offers leave and end game in the game menu, and the host confirms before ending", async () => {
    const c = connectedClient({ role: "host" }, "Prompting");
    addMine(c.state, c.manager.playerId);
    render(App, { manager: c.manager });
    expect(screen.queryByRole("button", { name: "End game" })).not.toBeInTheDocument();
    const menu = screen.getByRole("button", { name: "Game menu" });
    await fireEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    await fireEvent.click(screen.getByRole("button", { name: "End game" }));
    expect(screen.getByText("End the game for everyone?")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(c.room.requests).toEqual([]);
    await fireEvent.click(screen.getByRole("button", { name: "End game" }));
    await fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(c.room.requests).toEqual([{ type: "ACTION", payload: { type: "END_GAME" } }]);
    expect(screen.queryByRole("button", { name: "Leave game" })).not.toBeInTheDocument();
    const leave = vi.spyOn(c.manager, "leave").mockResolvedValue();
    await fireEvent.click(menu);
    await fireEvent.click(screen.getByRole("button", { name: "Leave game" }));
    expect(leave).toHaveBeenCalledOnce();
  });

  it("closes the game menu on Escape, on a click elsewhere and with its own button", async () => {
    const c = connectedClient({}, "Prompting");
    addMine(c.state, c.manager.playerId);
    render(App, { manager: c.manager });
    const menu = screen.getByRole("button", { name: "Game menu" });
    await fireEvent.click(menu);
    const leave = screen.getByRole("button", { name: "Leave game" });
    await fireEvent.keyDown(document.body, { key: "a" });
    expect(leave).toBeInTheDocument();
    await fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Leave game" })).not.toBeInTheDocument();
    await fireEvent.click(menu);
    await fireEvent.click(screen.getByRole("button", { name: "Leave game" }).parentElement ?? menu);
    expect(screen.getByRole("button", { name: "Leave game" })).toBeInTheDocument();
    await fireEvent.click(document.body);
    expect(screen.queryByRole("button", { name: "Leave game" })).not.toBeInTheDocument();
    await fireEvent.click(menu);
    await fireEvent.click(menu);
    expect(screen.queryByRole("button", { name: "Leave game" })).not.toBeInTheDocument();
    await fireEvent.click(document.body);
  });

  it("gives a guest only the leave button in the menu, and the lobby no menu", async () => {
    const guest = connectedClient({}, "Prompting");
    addMine(guest.state, guest.manager.playerId);
    const { unmount } = render(App, { manager: guest.manager });
    await fireEvent.click(screen.getByRole("button", { name: "Game menu" }));
    expect(screen.queryByRole("button", { name: "End game" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave game" })).toBeInTheDocument();
    unmount();
    const lobby = connectedClient({ role: "host" });
    render(App, { manager: lobby.manager });
    expect(screen.queryByRole("button", { name: "Game menu" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Leave game" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "End game" })).not.toBeInTheDocument();
  });

  it("hides end game once the game is over", async () => {
    const c = connectedClient({ role: "host" }, "Results");
    c.state.isFinalRound = true;
    render(App, { manager: c.manager });
    await fireEvent.click(screen.getByRole("button", { name: "Game menu" }));
    expect(screen.queryByRole("button", { name: "End game" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave game" })).toBeInTheDocument();
  });

  it("slaps a banner on screen for a phase, and none for the lobby or the welcome screen", () => {
    const lobby = connectedClient({ role: "host" });
    const first = render(App, { manager: lobby.manager });
    expect(first.container.querySelector(".phase-banner")).not.toBeInTheDocument();
    first.unmount();
    const c = connectedClient({}, "Prompting");
    addMine(c.state, c.manager.playerId);
    const game = render(App, { manager: c.manager });
    const banner = game.container.querySelector(".phase-banner");
    expect(banner).toHaveTextContent("GET WRITING!");
    expect(banner).toHaveAttribute("aria-hidden", "true");
    game.unmount();
    const welcome = connectedClient();
    welcome.manager.dispose();
    const away = render(App, { manager: welcome.manager });
    expect(away.container.querySelector(".phase-banner")).not.toBeInTheDocument();
    expect(away.container.querySelector("header")).not.toBeInTheDocument();
  });

  it("shows a quiet indicator while reconnecting, keeping the game on screen", () => {
    const c = connectedClient({}, "CategorySelection");
    const { container } = render(App, { manager: c.manager });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    c.room.dropConnection();
    flushSync();
    expect(screen.getByRole("status")).toHaveTextContent(/reconnecting/i);
    expect(screen.getByRole("heading", { name: /pick a category/i })).toBeInTheDocument();
    expect(container.querySelector<HTMLElement>(".game-view")?.inert).toBe(true);
    c.room.reconnected();
    flushSync();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(container.querySelector<HTMLElement>(".game-view")?.inert).toBe(false);
  });

  it("shows a seatless client the room as a TV display", () => {
    const c = connectedClient({}, "Prompting");
    c.state.players.delete(c.manager.playerId);
    addSeat(c.state, "ann-12345", { name: "Ann" });
    c.state.progress.set("ann-12345", 1);
    c.state.answersPerPlayer = 2;
    const { container } = render(App, { manager: c.manager });
    expect(container.querySelector("main")).toHaveClass("tv");
    expect(screen.getByText("1 of 2 answers in")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("gives a TV display a small leave button instead of the menu", async () => {
    const c = connectedClient({}, "Prompting");
    c.state.players.delete(c.manager.playerId);
    const leave = vi.spyOn(c.manager, "leave").mockResolvedValue();
    render(App, { manager: c.manager });
    expect(screen.queryByRole("button", { name: "Game menu" })).not.toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Leave game" }));
    expect(leave).toHaveBeenCalledOnce();
  });

  it("does not use the TV layout for a seated player", () => {
    const c = connectedClient();
    const { container } = render(App, { manager: c.manager });
    expect(container.querySelector("main")).not.toHaveClass("tv");
  });

  it("shows server errors in a toast that can be dismissed", async () => {
    const c = connectedClient();
    render(App, { manager: c.manager });
    c.room.push("ERROR", { code: ErrorCode.NOT_ENOUGH_PLAYERS, message: "Need more players" });
    flushSync();
    expect(screen.getByRole("alert")).toHaveTextContent("Need more players");
    await fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("returns a kicked player to the welcome screen with the reason", () => {
    const c = connectedClient({}, "Results");
    render(App, { manager: c.manager });
    c.room.push("ERROR", { code: ErrorCode.KICKED, message: "Removed by the host" });
    c.room.closed();
    flushSync();
    expect(screen.getByRole("button", { name: /host game/i })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Removed by the host");
  });
});
