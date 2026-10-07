import { fireEvent, render, screen } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../ui/App.svelte";
import JoinNextRound from "../ui/screens/JoinNextRound.svelte";
import { addSeat, connectedClient } from "./helpers/client.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("shows the welcome screen until a room is joined", () => {
    const { manager } = connectedClient();
    manager.dispose();
    render(App, { manager });
    expect(screen.getByRole("button", { name: /host game/i })).toBeInTheDocument();
  });

  it("follows the room from the lobby through the phases as patches arrive", () => {
    const c = connectedClient({ role: "host" });
    addSeat(c.state, "ann-12345");
    c.state.canStart = true;
    render(App, { manager: c.manager });

    expect(screen.getByText("ABCD", { selector: ".room-chip" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start/i })).toBeEnabled();

    c.state.phase = "Waving";
    c.patch();
    flushSync();
    expect(screen.getByRole("heading", { name: "Wave!" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wave! (0)" })).toBeEnabled();

    c.state.phase = "Mystery";
    c.patch();
    flushSync();
    expect(screen.getByText(/connecting to game server/i)).toBeInTheDocument();
  });

  it("shows a waiting screen to a late joiner", () => {
    const c = connectedClient({ isActive: false }, "Waving");
    render(App, { manager: c.manager });
    expect(screen.getByRole("heading", { name: /you'll join the next game/i })).toBeInTheDocument();
    expect(screen.getByText("Everyone is waving.")).toBeInTheDocument();
  });

  it("tells a late joiner to wait when the phase is unknown", () => {
    const c = connectedClient({ isActive: false }, "Mystery");
    render(App, { manager: c.manager });
    expect(screen.getByRole("heading", { name: /you'll join the next game/i })).toBeInTheDocument();
    expect(screen.getByText("Mystery.")).toBeInTheDocument();
  });

  it("renders the waiting screen before any room state arrives", () => {
    const { manager } = connectedClient();
    manager.dispose();
    render(JoinNextRound, { manager });
    expect(screen.getByRole("heading", { name: /you'll join the next game/i })).toBeInTheDocument();
    expect(screen.getByText("Waiting in the lobby.")).toBeInTheDocument();
  });

  it("asks an unnamed late joiner to pick a name and sends it", async () => {
    vi.useFakeTimers();
    const c = connectedClient({ isActive: false, isReady: false, name: "" }, "Waving");
    render(App, { manager: c.manager });
    expect(screen.getByRole("heading", { name: "Pick a name to join" })).toBeInTheDocument();
    await fireEvent.input(screen.getByLabelText("Your name"), { target: { value: "Maya" } });
    vi.advanceTimersByTime(300);
    expect(c.room.sent).toEqual([{ type: "SET_NAME", payload: "Maya" }]);
  });

  it("offers the host end-game in play phases but not on results", async () => {
    const c = connectedClient({ role: "host" }, "Waving");
    render(App, { manager: c.manager });
    await fireEvent.click(screen.getByRole("button", { name: "Game menu" }));
    expect(screen.getByRole("button", { name: "End game" })).toBeInTheDocument();

    c.state.phase = "Results";
    c.patch();
    flushSync();
    expect(screen.queryByRole("button", { name: "End game" })).not.toBeInTheDocument();
  });

  it("lets anyone leave from the menu", async () => {
    const c = connectedClient({}, "Waving");
    render(App, { manager: c.manager });
    await fireEvent.click(screen.getByRole("button", { name: "Game menu" }));
    const leave = vi.spyOn(c.manager, "leave").mockResolvedValue();
    await fireEvent.click(screen.getByRole("button", { name: "Leave game" }));
    expect(leave).toHaveBeenCalledOnce();
  });

  it("shows exactly one leave button in the lobby", () => {
    const c = connectedClient({ role: "host" });
    render(App, { manager: c.manager });
    expect(screen.getAllByRole("button", { name: /leave/i })).toHaveLength(1);
  });

  it("dims the game while reconnecting and restores it", () => {
    const c = connectedClient({ role: "host" }, "Waving");
    render(App, { manager: c.manager });
    c.room.dropConnection();
    flushSync();
    expect(screen.getByRole("status")).toHaveTextContent(/reconnecting/i);

    c.room.reconnected();
    flushSync();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders a TV display for a seatless client", () => {
    const c = connectedClient({}, "Waving");
    addSeat(c.state, "ann-12345", { name: "Ann" });
    c.state.players.delete(c.manager.playerId);
    render(App, { manager: c.manager });
    expect(document.querySelector("main")).toHaveClass("tv");
    expect(screen.getByText("Ann")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /wave/i })).not.toBeInTheDocument();
  });

  it("shows a dismissible toast for server errors", () => {
    const c = connectedClient({}, "Waving");
    render(App, { manager: c.manager });
    c.room.push("ERROR", { code: "NOT_ALLOWED", message: "No waving there" });
    flushSync();
    expect(screen.getByRole("alert")).toHaveTextContent("No waving there");
    const dismiss = vi.spyOn(c.manager, "dismissError");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it("flashes the phase banner when entering a phase", () => {
    const c = connectedClient({ role: "host" });
    render(App, { manager: c.manager });
    expect(document.querySelector(".phase-banner")).not.toBeInTheDocument();

    c.state.phase = "Waving";
    c.patch();
    flushSync();
    expect(screen.getByText("WAVE!", { selector: ".phase-banner span" })).toBeInTheDocument();
  });
});
