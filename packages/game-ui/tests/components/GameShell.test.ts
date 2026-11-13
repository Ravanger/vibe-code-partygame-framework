import { connectedClient, type SeatConfig } from "@partygame/game-client/testing";
import { ErrorCode } from "@partygame/shared";
import { BaseGameState } from "@partygame/shared/schema";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppRouter } from "../../src/AppRouter.js";
import { GameControlsViewModel } from "../../src/GameControlsViewModel.svelte.js";
import GameShellHarness from "../fixtures/GameShellHarness.svelte";
import { SHELL_SCREENS } from "../fixtures/shellScreens.js";

/** A connected client with the shell's router and controls, on `phase`. */
const setup = (phase: string = "Lobby", seat: SeatConfig = {}) => {
  const c = connectedClient({ stateClass: BaseGameState, phase, seat });
  return {
    ...c,
    router: createAppRouter(c.manager, SHELL_SCREENS),
    controls: new GameControlsViewModel(c.manager),
  };
};

const liveRegion = (container: HTMLElement) =>
  container.querySelector<HTMLElement>("[aria-live='polite'][aria-label='Phase updates']");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GameShell", () => {
  it("renders the welcome route without a header when disconnected", () => {
    const c = connectedClient({ stateClass: BaseGameState });
    c.manager.dispose();
    const { container } = render(GameShellHarness, {
      router: createAppRouter(c.manager, SHELL_SCREENS),
      controls: new GameControlsViewModel(c.manager),
    });
    expect(container.querySelector("header")).not.toBeInTheDocument();
    expect(screen.getByText("Welcome content.")).toBeInTheDocument();
  });

  it("renders the header with wordmark, room code and controls off welcome", () => {
    const s = setup("Play");
    const { container } = render(GameShellHarness, { router: s.router, controls: s.controls });
    expect(container.querySelector("header")).toBeInTheDocument();
    expect(screen.getByText("TestGame", { selector: ".wordmark" })).toBeInTheDocument();
    expect(screen.getByText("ABCD", { selector: ".room-chip" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Game menu" })).toBeInTheDocument();
    expect(container.querySelector("main")).not.toHaveClass("tv");
  });

  it("shows the connecting route for a phase missing from the screens", () => {
    const s = setup("Mystery");
    render(GameShellHarness, { router: s.router, controls: s.controls });
    expect(screen.getByText(/connecting to game server/i)).toBeInTheDocument();
  });

  it("shows the join-next-round route to a late joiner", () => {
    const s = setup("Play", { isActive: false });
    render(GameShellHarness, { router: s.router, controls: s.controls });
    expect(screen.getByRole("heading", { name: "Join heading" })).toBeInTheDocument();
    expect(screen.queryByText("Play content.")).not.toBeInTheDocument();
  });

  it("renders the phase screen for a known phase", () => {
    const s = setup("Play");
    render(GameShellHarness, { router: s.router, controls: s.controls });
    expect(screen.getByRole("heading", { name: "Play heading" })).toBeInTheDocument();
  });

  it("marks main.tv for a seatless client", () => {
    const s = setup("Play");
    s.state.players.delete(s.manager.playerId);
    s.patch();
    flushSync();
    const { container } = render(GameShellHarness, { router: s.router, controls: s.controls });
    expect(container.querySelector("main")).toHaveClass("tv");
  });

  it("shows a reconnecting status and makes the game view inert", () => {
    const s = setup("Play");
    const { container } = render(GameShellHarness, { router: s.router, controls: s.controls });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    s.room.dropConnection();
    flushSync();
    expect(screen.getByRole("status")).toHaveTextContent(/reconnecting/i);
    expect(container.querySelector<HTMLElement>(".game-view")?.inert).toBe(true);
    s.room.reconnected();
    flushSync();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(container.querySelector<HTMLElement>(".game-view")?.inert).toBe(false);
  });

  it("shows server errors in a toast that can be dismissed", async () => {
    const s = setup("Lobby");
    render(GameShellHarness, { router: s.router, controls: s.controls });
    s.room.push("ERROR", { code: ErrorCode.NOT_ALLOWED, message: "No fakes around" });
    flushSync();
    expect(screen.getByRole("alert")).toHaveTextContent("No fakes around");
    const dismiss = vi.spyOn(s.manager, "dismissError");
    await fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it("flashes the phase banner, aria-hidden, and none for the lobby or welcome", () => {
    const lobby = setup("Lobby");
    const first = render(GameShellHarness, { router: lobby.router, controls: lobby.controls });
    expect(first.container.querySelector(".phase-banner")).not.toBeInTheDocument();
    first.unmount();

    const game = setup("Play");
    const second = render(GameShellHarness, { router: game.router, controls: game.controls });
    const banner = second.container.querySelector<HTMLElement>(".phase-banner");
    expect(banner).toHaveTextContent("GO!");
    expect(banner).toHaveAttribute("aria-hidden", "true");
    second.unmount();

    const away = connectedClient({ stateClass: BaseGameState });
    away.manager.dispose();
    const third = render(GameShellHarness, {
      router: createAppRouter(away.manager, SHELL_SCREENS),
      controls: new GameControlsViewModel(away.manager),
    });
    expect(third.container.querySelector(".phase-banner")).not.toBeInTheDocument();
  });
});

describe("GameShell focus on screen change", () => {
  it("does not move focus on the initial mount, leaving a mounted input alone", () => {
    const s = setup("Name");
    render(GameShellHarness, { router: s.router, controls: s.controls });
    expect(screen.getByLabelText("Lobby name")).toHaveFocus();
  });

  it("moves focus to the new screen's heading and makes it focusable", () => {
    const s = setup("Plain");
    render(GameShellHarness, { router: s.router, controls: s.controls });
    s.state.phase = "Play";
    s.patch();
    flushSync();
    const heading = screen.getByRole("heading", { name: "Play heading" });
    expect(heading).toHaveFocus();
    expect(heading).toHaveAttribute("tabindex", "-1");
  });

  it("keeps a hand-set tabindex on the focused heading", () => {
    const s = setup("Plain");
    render(GameShellHarness, { router: s.router, controls: s.controls });
    s.state.phase = "Lobby";
    s.patch();
    flushSync();
    const heading = screen.getByRole("heading", { name: "Lobby heading" });
    expect(heading).toHaveFocus();
    expect(heading).toHaveAttribute("tabindex", "-1");
  });

  it("falls back to the screen container when there is no heading", () => {
    const s = setup("Play");
    const { container } = render(GameShellHarness, { router: s.router, controls: s.controls });
    s.state.phase = "Plain";
    s.patch();
    flushSync();
    expect(container.querySelector<HTMLElement>(".screen")).toHaveFocus();
  });

  it("honours an injected heading selector", () => {
    const s = setup("Plain");
    render(GameShellHarness, {
      router: s.router,
      controls: s.controls,
      headingSelector: ".screen h3",
    });
    s.state.phase = "Play";
    s.patch();
    flushSync();
    expect(screen.getByRole("heading", { name: "Play subheading" })).toHaveFocus();
    expect(screen.queryByRole("heading", { name: "Play heading" })).not.toHaveFocus();
  });

  it("keeps focus on a form field that just mounted", () => {
    const s = setup("Play");
    render(GameShellHarness, { router: s.router, controls: s.controls });
    s.me.isActive = false;
    s.patch();
    flushSync();
    expect(screen.getByLabelText("Late name")).toHaveFocus();
    expect(screen.queryByRole("heading", { name: "Join heading" })).not.toHaveFocus();
  });

  it("announces phase changes in the named live region", () => {
    const s = setup("Lobby");
    const { container } = render(GameShellHarness, { router: s.router, controls: s.controls });
    expect(liveRegion(container)?.textContent).toBe("");
    s.state.phase = "Play";
    s.patch();
    flushSync();
    expect(liveRegion(container)?.textContent).toBe("GO!");
  });

  it("keeps both the heading focus and the banner announcement", () => {
    const s = setup("Plain");
    const { container } = render(GameShellHarness, { router: s.router, controls: s.controls });
    s.state.phase = "Play";
    s.patch();
    flushSync();
    expect(screen.getByRole("heading", { name: "Play heading" })).toHaveFocus();
    expect(liveRegion(container)?.textContent).toBe("GO!");
  });
});
