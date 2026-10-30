import { connectedClient } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GameControls } from "../../src/components/index.js";
import { GameControlsViewModel } from "../../src/GameControlsViewModel.svelte.js";
import { expectNoViolations } from "../support/a11y.js";

const setup = (role: "host" | "player" = "player", phase = "Play") => {
  const c = connectedClient({ stateClass: BaseGameState, seat: { role }, phase });
  return { c, vm: new GameControlsViewModel(c.manager) };
};

const menu = () => screen.getByRole("button", { name: "Game menu" });
const endGame = () => screen.queryByRole("button", { name: "End game" });
const leaveButton = () => screen.queryByRole("button", { name: "Leave game" });

/** The cssText of the first style rule whose selector matches `re`. */
function ruleCss(re: RegExp): string {
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule && re.test(rule.selectorText)) return rule.cssText;
    }
  }
  throw new Error(`no style rule matching ${re}`);
}

/** The scale-aware fs-1 declaration every TV text uses under main.tv. */
const SCALED_FS_1 = /font-size:\s*calc\(var\(--fs-1\) \* var\(--scale,\s*1\)\)/;

describe("GameControls", () => {
  it("renders nothing in the lobby", () => {
    const { vm } = setup("host", "Lobby");
    const { container } = render(GameControls, { vm });
    expect(container.querySelector(".game-controls")).not.toBeInTheDocument();
  });

  it("opens the menu, and the host confirms before ending", async () => {
    const { c, vm } = setup("host");
    const { container } = render(GameControls, { vm });
    expect(endGame()).not.toBeInTheDocument();
    await fireEvent.click(menu());
    expect(menu()).toHaveAttribute("aria-expanded", "true");
    await expectNoViolations(container, "GameControls");
    await fireEvent.click(endGame() as HTMLElement);
    expect(screen.getByText("End the game for everyone?")).toBeInTheDocument();
    await expectNoViolations(container, "GameControls");
    await fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(c.room.requests).toEqual([]);
    await fireEvent.click(endGame() as HTMLElement);
    await fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(c.room.requests).toEqual([{ type: "ACTION", payload: { type: "END_GAME" } }]);
  });

  it("leaves the room from the menu, with no end game for a guest", async () => {
    const { c, vm } = setup();
    const leave = vi.spyOn(c.manager, "leave").mockResolvedValue();
    const { container } = render(GameControls, { vm });
    await fireEvent.click(menu());
    expect(endGame()).not.toBeInTheDocument();
    await expectNoViolations(container, "GameControls");
    await fireEvent.click(leaveButton() as HTMLElement);
    expect(leave).toHaveBeenCalledOnce();
  });

  it("closes on Escape and on a click outside, not on a click inside", async () => {
    const { vm } = setup();
    const { container } = render(GameControls, { vm });
    await fireEvent.click(menu());
    await expectNoViolations(container, "GameControls");
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

  it("wires the menu to its popover and moves focus on open and back on close", async () => {
    const { vm } = setup();
    const { container } = render(GameControls, { vm });
    await expectNoViolations(container, "GameControls");
    await fireEvent.keyDown(document.body, { key: "Escape" });
    expect(menu()).not.toHaveFocus();
    await fireEvent.click(menu());
    const controls = document.getElementById(menu().getAttribute("aria-controls") as string);
    expect(controls).toBe((leaveButton() as HTMLElement).parentElement);
    await waitFor(() => expect(leaveButton()).toHaveFocus());
    await expectNoViolations(container, "GameControls");
    await fireEvent.keyDown(document.body, { key: "Escape" });
    expect(leaveButton()).not.toBeInTheDocument();
    expect(menu()).toHaveFocus();
    await fireEvent.click(menu());
    expect(leaveButton()).toBeInTheDocument();
    await fireEvent.click(menu());
    expect(leaveButton()).not.toBeInTheDocument();
  });

  it("closes the menu when Tab leaves the last item, and not otherwise", async () => {
    const { vm } = setup("host");
    const { container } = render(GameControls, { vm });
    await fireEvent.click(menu());
    await waitFor(() => expect(endGame()).toHaveFocus());
    await expectNoViolations(container, "GameControls");
    await fireEvent.keyDown(endGame() as HTMLElement, { key: "a" });
    expect(leaveButton()).toBeInTheDocument();
    await fireEvent.keyDown(endGame() as HTMLElement, { key: "Tab" });
    expect(leaveButton()).toBeInTheDocument();
    (leaveButton() as HTMLElement).focus();
    await fireEvent.keyDown(leaveButton() as HTMLElement, { key: "Tab", shiftKey: true });
    expect(leaveButton()).toBeInTheDocument();
    await fireEvent.keyDown(leaveButton() as HTMLElement, { key: "Tab" });
    expect(leaveButton()).not.toBeInTheDocument();
    expect(menu()).toHaveFocus();
  });

  it("presents the end-game confirm as a labelled alertdialog", async () => {
    const { vm } = setup("host");
    const { container } = render(GameControls, { vm });
    await fireEvent.click(menu());
    await fireEvent.click(endGame() as HTMLElement);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute(
      "aria-labelledby",
      screen.getByText("End the game for everyone?").id,
    );
    await expectNoViolations(container, "GameControls");
  });

  it("gives a spectator a leave button and no menu", async () => {
    const { c, vm } = setup();
    const leave = vi.spyOn(c.manager, "leave").mockResolvedValue();
    c.state.players.delete(c.manager.playerId);
    const { container } = render(GameControls, { vm });
    expect(screen.queryByRole("button", { name: "Game menu" })).not.toBeInTheDocument();
    expect(leaveButton()).toBeInTheDocument();
    expect(endGame()).not.toBeInTheDocument();
    await expectNoViolations(container, "GameControls");
    await fireEvent.click(leaveButton() as HTMLElement);
    expect(leave).toHaveBeenCalledOnce();
  });

  it("walks the open menu with Tab, and closes it with Escape or a final Tab", async () => {
    const { vm } = setup("host");
    render(GameControls, { vm });
    const user = userEvent.setup();
    await user.click(menu());
    await waitFor(() => expect(endGame()).toHaveFocus());
    await user.tab();
    expect(leaveButton()).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(leaveButton()).not.toBeInTheDocument();
    expect(menu()).toHaveFocus();
    await user.click(menu());
    await waitFor(() => expect(endGame()).toHaveFocus());
    await user.tab();
    expect(leaveButton()).toHaveFocus();
    await user.tab();
    expect(leaveButton()).not.toBeInTheDocument();
    expect(menu()).toHaveFocus();
  });

  it("scales the spectator leave button with the TV font scale", () => {
    const { c, vm } = setup();
    c.state.players.delete(c.manager.playerId);
    render(GameControls, { vm });
    expect(ruleCss(/leave-small/)).toMatch(SCALED_FS_1);
  });
});
