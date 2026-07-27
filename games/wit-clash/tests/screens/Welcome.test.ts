import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import Welcome from "../../ui/screens/Welcome.svelte";
import { fakeManager, makeFakeState } from "../helpers/fakes.js";

describe.skip("Welcome", () => {
  it("renders the host button", () => {
    const manager = fakeManager({ connectionStatus: "disconnected" });
    render(Welcome, { manager });
    expect(screen.getByRole("button", { name: /host game/i })).toBeInTheDocument();
  });

  it("renders the join section with code input", () => {
    const manager = fakeManager({ connectionStatus: "disconnected" });
    render(Welcome, { manager });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /join/i })).toBeInTheDocument();
  });

  it("clicking host button calls manager.create", async () => {
    const manager = fakeManager({ connectionStatus: "disconnected" });
    render(Welcome, { manager });
    const hostBtn = screen.getByRole("button", { name: /host game/i });
    await fireEvent.click(hostBtn);
    expect(manager.create).toHaveBeenCalledWith("wit_clash");
  });

  it("shows error message when connection fails", () => {
    const manager = fakeManager({
      connectionStatus: "error",
      error: "Room not found",
    });
    render(Welcome, { manager });
    expect(screen.getByText(/room not found/i)).toBeInTheDocument();
  });

  it("displays room code once connected", () => {
    const manager = fakeManager({
      connectionStatus: "connected",
      stateVersion: 1,
      room: {
        sessionId: "test",
        roomId: "room123",
        reconnectionToken: "token",
        state: makeFakeState({ phase: "Lobby", roomCode: "PNVW" }),
        leave: () => Promise.resolve(),
        onLeave: () => {},
        onStateChange: () => {},
        onMessage: () => {},
        send: () => {},
      },
    });
    render(Welcome, { manager });
    expect(screen.getByText(/PNVW/)).toBeInTheDocument();
  });

  it("join button is disabled when code is invalid", () => {
    const manager = fakeManager({ connectionStatus: "disconnected" });
    render(Welcome, { manager });
    const input = screen.getByRole("textbox");
    const joinBtn = screen.getByRole("button", { name: /join/i });
    fireEvent.change(input, { target: { value: "AB" } });
    expect(joinBtn).toBeDisabled();
  });

  it("join button is enabled when code is valid", () => {
    const manager = fakeManager({ connectionStatus: "disconnected" });
    render(Welcome, { manager });
    const input = screen.getByRole("textbox");
    const joinBtn = screen.getByRole("button", { name: /join/i });
    fireEvent.change(input, { target: { value: "ABCD" } });
    expect(joinBtn).not.toBeDisabled();
  });
});
