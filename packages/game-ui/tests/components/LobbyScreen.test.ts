import type { SeatConfig } from "@partygame/game-client/testing";
import { addSeat, connectedClient } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LobbySettingsViewModel } from "../../src/LobbySettingsViewModel.svelte.js";
import { setStrings } from "../../src/strings.js";
import { WaitingRoomViewModel } from "../../src/WaitingRoomViewModel.svelte.js";
import LobbyScreenExtraProvider from "../fixtures/LobbyScreenExtraProvider.svelte";
import LobbyScreenProvider from "../fixtures/LobbyScreenProvider.svelte";
import { TEST_DEFAULTS, TestOptionsSchema } from "../fixtures/optionsSchema.js";
import { expectNoViolations } from "../support/a11y.js";

afterEach(() => {
  setStrings({});
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A client in a room that needs 3 of up to 8 players; `seat` overrides the own seat's defaults. */
function client(seat?: SeatConfig) {
  const c = connectedClient({ stateClass: BaseGameState, ...(seat === undefined ? {} : { seat }) });
  c.state.minPlayers = 3;
  c.state.maxPlayers = 8;
  return c;
}

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

describe("LobbyScreen", () => {
  it("shows the host the code, a copy button, the QR code and a disabled start below the minimum", async () => {
    const c = client({ role: "host" });
    addSeat(c.state, "bob-12345", { name: "Bob" });
    const vm = new WaitingRoomViewModel(c.manager);
    const { container } = render(LobbyScreenProvider, { vm });
    expect(screen.getByText("ABCD")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /qr code/i })).toBeInTheDocument();
    const heading = screen.getByRole("heading", { name: /players/i });
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("button", { name: /start game/i })).toBeDisabled();
    expect(screen.getByText("Need at least 3 players to start")).toBeInTheDocument();
    expect(screen.queryByText("Extra line.")).not.toBeInTheDocument();
    await expectNoViolations(container, "LobbyScreen");
  });

  it("lets the host start once the server allows it", async () => {
    const c = client({ role: "host" });
    addSeat(c.state, "bob-12345", { name: "Bob" });
    addSeat(c.state, "ann-12345", { name: "Ann" });
    c.state.canStart = true;
    const vm = new WaitingRoomViewModel(c.manager);
    render(LobbyScreenProvider, { vm });
    const start = screen.getByRole("button", { name: /start game/i });
    expect(start).toBeEnabled();
    await fireEvent.click(start);
    expect(c.room.requests).toEqual([{ type: "ACTION", payload: { type: "START_GAME" } }]);
  });

  it("shows a named guest the waiting panel and no code, copy or start", () => {
    const c = client({ name: "Me" });
    addSeat(c.state, "bob-12345", { name: "Bob" });
    c.state.notice = "The host ended the game.";
    const vm = new WaitingRoomViewModel(c.manager);
    render(LobbyScreenProvider, { vm });
    expect(screen.getByText(/waiting for the host/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("The host ended the game.");
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /qr code/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start game/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^remove/i })).not.toBeInTheDocument();
  });

  it("shows a spectator the code and QR but no copy button, no name card and no start", async () => {
    const c = client({ role: "host" });
    addSeat(c.state, "bob-12345", { name: "Bob" });
    c.state.players.delete(c.manager.playerId);
    c.state.spectatorCount = 2;
    c.patch();
    const vm = new WaitingRoomViewModel(c.manager);
    const { container } = render(LobbyScreenProvider, { vm });
    expect(screen.getByText("ABCD")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /qr code/i })).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/?code=ABCD`)).toBeInTheDocument();
    expect(screen.getByText("2 watching on a TV")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Leave game"]);
    await expectNoViolations(container, "LobbyScreen");
  });

  it("lists the seats with their badges", () => {
    const c = client({ role: "host" });
    addSeat(c.state, "away-12345", { name: "Away", isConnected: false });
    addSeat(c.state, "new-123456", { name: "", isReady: false });
    const vm = new WaitingRoomViewModel(c.manager);
    render(LobbyScreenProvider, { vm });
    expect(screen.getByText("(You)")).toBeInTheDocument();
    expect(screen.getByText("Host")).toBeInTheDocument();
    expect(screen.getByText("(Disconnected)")).toBeInTheDocument();
    expect(screen.getByText("Choosing a name...")).toBeInTheDocument();
  });

  it("asks twice before removing a player, and can back out", async () => {
    const c = client({ role: "host" });
    addSeat(c.state, "bob-12345", { name: "Bob" });
    const vm = new WaitingRoomViewModel(c.manager);
    render(LobbyScreenProvider, { vm });
    await fireEvent.click(screen.getByRole("button", { name: "Remove Bob" }));
    expect(screen.getByText("Remove?")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(screen.queryByText("Remove?")).not.toBeInTheDocument();
    expect(c.room.requests).toEqual([]);

    await fireEvent.click(screen.getByRole("button", { name: "Remove Bob" }));
    await fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(c.room.requests).toEqual([
      { type: "ACTION", payload: { playerId: "bob-12345", type: "KICK_PLAYER" } },
    ]);
  });

  it("offers an unnamed seat a generic removal label", () => {
    const c = client({ role: "host" });
    addSeat(c.state, "new-123456", { name: "", isReady: false });
    const vm = new WaitingRoomViewModel(c.manager);
    render(LobbyScreenProvider, { vm });
    expect(screen.getByRole("button", { name: "Remove player" })).toBeInTheDocument();
  });

  it("puts the name card first and focused for an unnamed joiner, and keeps it there", async () => {
    const c = client({ name: "", isReady: false });
    addSeat(c.state, "bob-12345", { name: "Bob" });
    const vm = new WaitingRoomViewModel(c.manager);
    const { container } = render(LobbyScreenProvider, { vm });
    const input = screen.getByLabelText("Your name");
    expect(input).toHaveFocus();
    expect(
      container.querySelector(".lobby-screen")?.firstElementChild?.firstElementChild,
    ).toContainElement(input);
    expect(screen.queryByText(/waiting for the host/i)).not.toBeInTheDocument();
    c.me.isReady = true;
    c.me.name = "Maya";
    c.patch();
    // nameFirst is decided once, so the card does not jump away while its owner typed it
    expect(screen.getByLabelText("Your name")).toBe(input);
    expect(
      container.querySelector(".lobby-screen")?.firstElementChild?.firstElementChild,
    ).toContainElement(input);
    expect(await screen.findByText(/waiting for the host/i)).toBeInTheDocument();
  });

  it("puts the name below the players once a player has one", () => {
    const c = client({ name: "Me" });
    addSeat(c.state, "bob-12345", { name: "Bob" });
    const vm = new WaitingRoomViewModel(c.manager);
    const { container } = render(LobbyScreenProvider, { vm });
    const input = screen.getByLabelText("Your name");
    expect(input).not.toHaveFocus();
    expect(
      container.querySelector(".lobby-screen")?.firstElementChild?.firstElementChild,
    ).not.toContainElement(input);
  });

  it("hides the name card from an unnamed client that becomes a spectator", () => {
    const c = client({ name: "", isReady: false });
    const vm = new WaitingRoomViewModel(c.manager); // nameFirst is decided now, while unnamed
    c.state.players.delete(c.manager.playerId);
    c.patch();
    render(LobbyScreenProvider, { vm });
    expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
  });

  it("renders settings only when a settings viewmodel is passed", () => {
    const guest = client({ name: "Me" });
    addSeat(guest.state, "bob-12345", { name: "Bob" });
    const guestVm = new WaitingRoomViewModel(guest.manager);
    render(LobbyScreenProvider, { vm: guestVm });
    expect(screen.queryByText("Game settings")).not.toBeInTheDocument();

    const host = client({ role: "host" });
    host.state.options = JSON.stringify({ turnSeconds: 30 });
    const hostSettings = new LobbySettingsViewModel(host.manager, {
      schema: TestOptionsSchema,
      defaults: TEST_DEFAULTS,
    });
    const hostVm = new WaitingRoomViewModel(host.manager);
    const { container } = render(LobbyScreenProvider, { vm: hostVm, settings: hostSettings });
    expect(screen.getByText("Game settings")).toBeInTheDocument();
    expect(container.querySelector("details")).toHaveAttribute("open");

    const guestSettings = new LobbySettingsViewModel(guest.manager, {
      schema: TestOptionsSchema,
      defaults: TEST_DEFAULTS,
    });
    const guestAgainVm = new WaitingRoomViewModel(guest.manager);
    const folded = render(LobbyScreenProvider, { vm: guestAgainVm, settings: guestSettings });
    expect(folded.container.querySelector("details")).not.toHaveAttribute("open");
  });

  it("renders the extra snippet when given and nothing otherwise", () => {
    const c = client({ name: "Me" });
    addSeat(c.state, "bob-12345", { name: "Bob" });
    const vm = new WaitingRoomViewModel(c.manager);
    const plain = render(LobbyScreenProvider, { vm });
    expect(plain.container.querySelector(".extra-line")).not.toBeInTheDocument();
    plain.unmount();
    const withExtra = render(LobbyScreenExtraProvider, { vm });
    expect(withExtra.container.querySelector(".extra-line")).toHaveTextContent("Extra line.");
  });

  it("copies the room code and announces the success in a live region", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const c = client({ role: "host" });
    addSeat(c.state, "bob-12345", { name: "Bob" });
    const vm = new WaitingRoomViewModel(c.manager);
    render(LobbyScreenProvider, { vm });
    await fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("ABCD");
    const status = screen.getByText("Copied!");
    expect(status.closest("[aria-live='polite']")).not.toBeNull();
  });

  it("tells the player to read the code out when the clipboard fails", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const c = client({ role: "host" });
    addSeat(c.state, "bob-12345", { name: "Bob" });
    const vm = new WaitingRoomViewModel(c.manager);
    render(LobbyScreenProvider, { vm });
    await fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    const status = screen.getByText("Copy failed, read the code out");
    expect(status.closest("[aria-live='polite']")).not.toBeNull();
  });

  it("lets anyone leave", async () => {
    const c = client({ name: "Me" });
    addSeat(c.state, "bob-12345", { name: "Bob" });
    const vm = new WaitingRoomViewModel(c.manager);
    const leave = vi.spyOn(c.manager, "leave").mockResolvedValue();
    render(LobbyScreenProvider, { vm });
    await fireEvent.click(screen.getByRole("button", { name: "Leave game" }));
    expect(leave).toHaveBeenCalledOnce();
  });

  it("scales the TV leave button with the font scale", () => {
    const c = client({ name: "Me" });
    addSeat(c.state, "bob-12345", { name: "Bob" });
    const vm = new WaitingRoomViewModel(c.manager);
    render(LobbyScreenProvider, { vm });
    expect(ruleCss(/main\.tv .*\.leave\b/)).toMatch(SCALED_FS_1);
  });

  it("reads every label from the strings table", async () => {
    setStrings({
      roomCodeLabel: "Raumcode",
      copyCode: "Kopieren",
      shareInstructions: "Scannen, um beizutreten, oder öffnen",
      playersHeading: (ready, min, max) => `Spieler (${ready} bereit, ${min} bis ${max})`,
      watchingOnTv: (count) => `${count} schauen auf einem TV zu`,
      choosingName: "Wählt einen Namen...",
      youBadge: "(Du)",
      hostBadge: "Gastgeber",
      disconnectedBadge: "(Getrennt)",
      removePlayer: (name) => `Entferne ${name}`,
      kickConfirm: "Entfernen?",
      startGame: (ready, min) => `Spiel starten (${ready}/${min})`,
      needAtLeast: (min) => `Mindestens ${min} Spieler nötig`,
      leaveGame: "Verlassen",
    });
    const c = client({ role: "host" });
    addSeat(c.state, "away-12345", { name: "", isReady: false, isConnected: false });
    c.state.spectatorCount = 1;
    c.patch();
    const vm = new WaitingRoomViewModel(c.manager);
    render(LobbyScreenProvider, { vm });
    expect(screen.getByText("Raumcode")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kopieren" })).toBeInTheDocument();
    expect(screen.getByText(/scannen, um beizutreten/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Spieler (1 bereit, 3 bis 8)" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 schauen auf einem TV zu")).toBeInTheDocument();
    expect(screen.getByText("Wählt einen Namen...")).toBeInTheDocument();
    expect(screen.getByText("(Du)")).toBeInTheDocument();
    expect(screen.getByText("Gastgeber")).toBeInTheDocument();
    expect(screen.getByText("(Getrennt)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entferne player" })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Entferne player" }));
    expect(screen.getByText("Entfernen?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /spiel starten \(1\/3\)/i })).toBeDisabled();
    expect(screen.getByText("Mindestens 3 Spieler nötig")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verlassen" })).toBeInTheDocument();
  });

  it("reads the waiting panel title from the strings table", () => {
    setStrings({ waitingForHost: "Warten auf den Gastgeber..." });
    const c = client({ name: "Me" });
    addSeat(c.state, "bob-12345", { name: "Bob" });
    const vm = new WaitingRoomViewModel(c.manager);
    render(LobbyScreenProvider, { vm });
    expect(screen.getByText("Warten auf den Gastgeber...")).toBeInTheDocument();
  });
});
