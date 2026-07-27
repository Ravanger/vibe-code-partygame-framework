import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import WaitingRoom from "../../ui/screens/WaitingRoom.svelte";
import { fakeManager, makeFakeRoom, makeFakeState, makePlayer } from "../helpers/fakes.js";

describe.skip("WaitingRoom", () => {
  function makeManager(stateOverrides = {}) {
    const state = makeFakeState({
      phase: "Lobby",
      roomCode: "PNVW",
      players: new Map([
        ["host-id", makePlayer({ id: "host-id", name: "Alice", role: "host", isConnected: true })],
        ["guest-id", makePlayer({ id: "guest-id", name: "Bob", role: "guest", isConnected: true })],
      ]),
      ...stateOverrides,
    });
    return fakeManager({
      connectionStatus: "connected",
      stateVersion: 1,
      room: makeFakeRoom({ state, sessionId: "host-id" }),
    });
  }

  it("renders player list", () => {
    const manager = makeManager();
    render(WaitingRoom, { manager });
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });

  it("marks the current player with (You)", () => {
    const manager = makeManager();
    render(WaitingRoom, { manager });
    expect(screen.getByText(/Alice.*You/)).toBeInTheDocument();
  });

  it("marks the host with Host badge", () => {
    const manager = makeManager();
    render(WaitingRoom, { manager });
    expect(screen.getByText(/Alice.*Host/)).toBeInTheDocument();
  });

  it("displays the room code", () => {
    const manager = makeManager();
    render(WaitingRoom, { manager });
    expect(screen.getByText(/PNVW/)).toBeInTheDocument();
  });

  it("provides a copy button for the room code", () => {
    const manager = makeManager();
    render(WaitingRoom, { manager });
    const copyBtn = screen.getAllByRole("button").find((btn) => btn.textContent?.includes("Copy"));
    expect(copyBtn).toBeInTheDocument();
  });

  it("shows start game button only for the host", () => {
    const manager = makeManager();
    render(WaitingRoom, { manager });
    expect(screen.getByRole("button", { name: /start game/i })).toBeInTheDocument();
  });

  it("start game button is disabled when fewer than 3 players", () => {
    const manager = makeManager({
      players: new Map([["host-id", makePlayer({ id: "host-id", name: "Alice", role: "host" })]]),
    });
    render(WaitingRoom, { manager });
    const startBtn = screen.getByRole("button", { name: /start game/i });
    expect(startBtn).toBeDisabled();
  });

  it("start game button is enabled when 3+ players connected", () => {
    const manager = makeManager();
    render(WaitingRoom, { manager });
    const startBtn = screen.getByRole("button", { name: /start game/i });
    expect(startBtn).not.toBeDisabled();
  });

  it("clicking start game sends START_GAME action", async () => {
    const manager = makeManager();
    render(WaitingRoom, { manager });
    const startBtn = screen.getByRole("button", { name: /start game/i });
    await fireEvent.click(startBtn);
    expect(manager.room?.send).toHaveBeenCalledWith("ACTION", { type: "START_GAME" });
  });

  it("shows name input field", () => {
    const manager = makeManager();
    render(WaitingRoom, { manager });
    expect(screen.getByDisplayValue(/Alice/)).toBeInTheDocument();
  });

  it("changing name sends SET_NAME action with debounce", async () => {
    vi.useFakeTimers();
    const manager = makeManager();
    render(WaitingRoom, { manager });
    const nameInput = screen.getByDisplayValue(/Alice/);
    await fireEvent.change(nameInput, { target: { value: "Charlie" } });
    vi.advanceTimersByTime(250);
    expect(manager.room?.send).toHaveBeenCalledWith("ACTION", {
      type: "SET_NAME",
      name: "Charlie",
    });
    vi.useRealTimers();
  });
});
