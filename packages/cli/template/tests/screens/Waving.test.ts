import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import Waving from "../../ui/screens/Waving.svelte";
import { addSeat, connectedClient } from "../helpers/client.js";

afterEach(() => vi.unstubAllGlobals());

describe("Waving screen", () => {
  it("shows the board sorted by wave count, with ties by name", () => {
    const c = connectedClient({}, "Waving");
    addSeat(c.state, "ann-12345", { name: "Ann" });
    addSeat(c.state, "ben-12345", { name: "Ben" });
    c.state.waves.set("ann-12345", 5);
    c.state.waves.set("ben-12345", 2);
    c.state.waves.set(c.me.id, 2);
    render(Waving, { manager: c.manager });

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Ann");
    expect(rows[1]).toHaveTextContent("Ben");
    expect(rows[2]).toHaveTextContent("Me");
  });

  it("waves on click and shows the running total", async () => {
    const c = connectedClient({}, "Waving");
    c.state.waves.set(c.me.id, 3);
    render(Waving, { manager: c.manager });
    await fireEvent.click(screen.getByRole("button", { name: "Wave! (3)" }));
    expect(c.room.requests).toEqual([{ type: "ACTION", payload: { type: "WAVE" } }]);
  });

  it("gives spectators a board without controls", () => {
    const c = connectedClient({}, "Waving");
    addSeat(c.state, "ann-12345", { name: "Ann" });
    c.state.players.delete(c.manager.playerId);
    render(Waving, { manager: c.manager });
    expect(screen.getByText("Ann")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders an empty board before room state arrives", () => {
    const { manager } = connectedClient({}, "Waving");
    manager.dispose();
    render(Waving, { manager });
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Wave! (0)" })).toBeInTheDocument();
  });
});
