import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import Welcome from "../../ui/screens/Welcome.svelte";
import { fakeManager, makeFakeState } from "../helpers/fakes.js";

describe("Welcome", () => {
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

  it("join button is disabled when code is invalid", async () => {
    const manager = fakeManager({ connectionStatus: "disconnected" });
    render(Welcome, { manager });
    const input = screen.getByRole("textbox");
    const joinBtn = screen.getByRole("button", { name: /join/i });
    await fireEvent.input(input, { target: { value: "AB" } });
    expect(joinBtn).toBeDisabled();
  });

  it("join button is enabled when code is valid", async () => {
    const manager = fakeManager({ connectionStatus: "disconnected" });
    render(Welcome, { manager });
    const input = screen.getByRole("textbox");
    const joinBtn = screen.getByRole("button", { name: /join/i });
    await fireEvent.input(input, { target: { value: "ABCD" } });
    expect(joinBtn).not.toBeDisabled();
  });

  describe("rejoin button", () => {
    afterEach(() => {
      localStorage.clear();
    });

    it("renders when a previous room code exists", () => {
      localStorage.setItem("lastRoomCode", "PNVW");
      const manager = fakeManager({ connectionStatus: "disconnected" });
      render(Welcome, { props: { manager } });
      expect(screen.getByRole("button", { name: /rejoin/i })).toBeInTheDocument();
    });

    it("does not render when no previous code exists", () => {
      localStorage.clear();
      const manager = fakeManager({ connectionStatus: "disconnected" });
      render(Welcome, { props: { manager } });
      expect(screen.queryByRole("button", { name: /rejoin/i })).not.toBeInTheDocument();
    });

    it("triggers rejoin when clicked", async () => {
      localStorage.setItem("lastRoomCode", "PNVW");
      const manager = fakeManager({ connectionStatus: "disconnected" });
      render(Welcome, { props: { manager } });
      const rejoinBtn = screen.getByRole("button", { name: /rejoin/i });
      await fireEvent.click(rejoinBtn);
      expect(manager.joinByCode).toHaveBeenCalledWith("PNVW");
    });
  });

  describe("error dismissal", () => {
    it("shows dismiss control on error", () => {
      const manager = fakeManager({
        connectionStatus: "error",
        error: "Game code not found",
      });
      render(Welcome, { props: { manager } });
      expect(screen.getByLabelText(/dismiss/i)).toBeInTheDocument();
    });

    it("calls manager.reset when dismiss is clicked", async () => {
      const manager = fakeManager();
      render(Welcome, { props: { manager } });
      // Trigger a local error by joining with an invalid code
      const input = screen.getByRole("textbox");
      const joinBtn = screen.getByRole("button", { name: /join/i });
      await fireEvent.input(input, { target: { value: "AB" } });
      await fireEvent.click(joinBtn);
      // Now there should be an error
      const dismissBtn = screen.getByLabelText(/dismiss/i);
      await fireEvent.click(dismissBtn);
      expect(manager.reset).toHaveBeenCalled();
    });
  });
});
