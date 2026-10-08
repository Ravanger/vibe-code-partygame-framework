import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import Results from "../../ui/screens/Results.svelte";
import { connectedClient } from "../helpers/client.js";

afterEach(() => vi.unstubAllGlobals());

describe("Results screen", () => {
  it("announces the winner and offers play-again to the host", async () => {
    const c = connectedClient({ role: "host" }, "Results");
    c.state.winnerName = "Me";
    c.state.winnerWaves = 4;
    render(Results, { manager: c.manager });
    expect(screen.getByRole("heading", { name: "Me wins with 4 waves!" })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Play Again" }));
    expect(c.room.requests).toEqual([{ type: "ACTION", payload: { type: "PLAY_AGAIN" } }]);
  });

  it("shows an empty result when nobody waved", () => {
    const c = connectedClient({ role: "host" }, "Results");
    render(Results, { manager: c.manager });
    expect(screen.getByRole("heading", { name: "Nobody waved." })).toBeInTheDocument();
  });

  it("tells a guest to wait for the host", () => {
    const c = connectedClient({}, "Results");
    c.state.winnerName = "Ann";
    c.state.winnerWaves = 7;
    render(Results, { manager: c.manager });
    expect(screen.getByRole("heading", { name: "Ann wins with 7 waves!" })).toBeInTheDocument();
    expect(screen.getByText(/waiting for the host/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("gives spectators the result with nothing to press", () => {
    const c = connectedClient({}, "Results");
    c.state.winnerName = "Ann";
    c.state.winnerWaves = 7;
    c.state.players.delete(c.manager.playerId);
    render(Results, { manager: c.manager });
    expect(screen.getByRole("heading", { name: "Ann wins with 7 waves!" })).toBeInTheDocument();
    expect(screen.queryByText(/waiting for the host/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders before room state arrives", () => {
    const { manager } = connectedClient({}, "Results");
    manager.dispose();
    render(Results, { manager });
    expect(screen.getByRole("heading", { name: "Nobody waved." })).toBeInTheDocument();
    expect(screen.getByText(/waiting for the host/i)).toBeInTheDocument();
  });
});
