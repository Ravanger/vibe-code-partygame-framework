import { connectedClient } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import { GameControls } from "../../src/components/index.js";
import { GameControlsViewModel } from "../../src/GameControlsViewModel.svelte.js";

const setup = (role: "host" | "player" = "player", phase = "Play") => {
  const c = connectedClient({ stateClass: BaseGameState, seat: { role }, phase });
  return { c, vm: new GameControlsViewModel(c.manager) };
};

const menu = () => screen.getByRole("button", { name: "Game menu" });
const endGame = () => screen.queryByRole("button", { name: "End game" });
const leaveButton = () => screen.queryByRole("button", { name: "Leave game" });

describe("GameControls", () => {
  it("renders nothing in the lobby", () => {
    const { vm } = setup("host", "Lobby");
    const { container } = render(GameControls, { vm });
    expect(container.querySelector(".game-controls")).not.toBeInTheDocument();
  });

  it("opens the menu, and the host confirms before ending", async () => {
    const { c, vm } = setup("host");
    render(GameControls, { vm });
    expect(endGame()).not.toBeInTheDocument();
    await fireEvent.click(menu());
    expect(menu()).toHaveAttribute("aria-expanded", "true");
    await fireEvent.click(endGame() as HTMLElement);
    expect(screen.getByText("End the game for everyone?")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(c.room.requests).toEqual([]);
    await fireEvent.click(endGame() as HTMLElement);
    await fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(c.room.requests).toEqual([{ type: "ACTION", payload: { type: "END_GAME" } }]);
  });

  it("leaves the room from the menu, with no end game for a guest", async () => {
    const { c, vm } = setup();
    const leave = vi.spyOn(c.manager, "leave").mockResolvedValue();
    render(GameControls, { vm });
    await fireEvent.click(menu());
    expect(endGame()).not.toBeInTheDocument();
    await fireEvent.click(leaveButton() as HTMLElement);
    expect(leave).toHaveBeenCalledOnce();
  });

  it("closes on Escape and on a click outside, not on a click inside", async () => {
    const { vm } = setup();
    render(GameControls, { vm });
    await fireEvent.click(menu());
    await fireEvent.keyDown(document.body, { key: "a" });
    expect(leaveButton()).toBeInTheDocument();
    await fireEvent.keyDown(document.body, { key: "Escape" });
    expect(leaveButton()).not.toBeInTheDocument();
    await fireEvent.click(menu());
    await fireEvent.click(leaveButton()?.parentElement as HTMLElement);
    expect(leaveButton()).toBeInTheDocument();
    await fireEvent.click(document.body);
    expect(leaveButton()).not.toBeInTheDocument();
    await fireEvent.click(document.body);
  });

  it("gives a spectator a leave button and no menu", async () => {
    const { c, vm } = setup();
    const leave = vi.spyOn(c.manager, "leave").mockResolvedValue();
    c.state.players.delete(c.manager.playerId);
    render(GameControls, { vm });
    expect(screen.queryByRole("button", { name: "Game menu" })).not.toBeInTheDocument();
    expect(leaveButton()).toBeInTheDocument();
    expect(endGame()).not.toBeInTheDocument();
    await fireEvent.click(leaveButton() as HTMLElement);
    expect(leave).toHaveBeenCalledOnce();
  });
});
