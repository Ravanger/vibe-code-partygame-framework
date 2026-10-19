import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { ScoreEntry } from "../../src/state.js";
import Results from "../../ui/screens/Results.svelte";
import { connectedClient } from "../helpers/client.js";

const addScore = (
  c: ReturnType<typeof connectedClient>,
  id: string,
  name: string,
  score: number,
): void => {
  c.state.scoreboard.push(Object.assign(new ScoreEntry(), { playerId: id, name, score }));
};

describe("Results screen", () => {
  it("ranks the scoreboard and names the winner", () => {
    const c = connectedClient({}, "Results");
    addScore(c, "ann-12345", "Ann", 5);
    addScore(c, c.me.id, "Me", 3);
    render(Results, { manager: c.manager });

    expect(screen.getByRole("heading", { name: "Ann wins with 5 points!" })).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("#1");
    expect(rows[0]).toHaveTextContent("Ann");
    expect(rows[0]).toHaveTextContent("5");
    expect(rows[1]).toHaveTextContent("Me");
    expect(rows[1]).toHaveTextContent("3");
  });

  it("calls a tie when the top is shared", () => {
    const c = connectedClient({}, "Results");
    addScore(c, "ann-12345", "Ann", 4);
    addScore(c, c.me.id, "Me", 4);
    render(Results, { manager: c.manager });
    expect(screen.getByRole("heading", { name: "It's a tie!" })).toBeInTheDocument();
  });

  it("says nobody scored when all scores are zero", () => {
    const c = connectedClient({}, "Results");
    addScore(c, "ann-12345", "Ann", 0);
    render(Results, { manager: c.manager });
    expect(screen.getByRole("heading", { name: "Nobody scored." })).toBeInTheDocument();
  });

  it("marks leavers and keeps them on the board", () => {
    const c = connectedClient({}, "Results");
    addScore(c, "ann-12345", "Ann", 5);
    const ben = Object.assign(new ScoreEntry(), {
      playerId: "ben-12345",
      name: "Ben",
      score: 1,
      hasLeft: true,
    });
    c.state.scoreboard.push(ben);
    render(Results, { manager: c.manager });
    expect(screen.getByText("Ben (left)")).toBeInTheDocument();
  });

  it("offers play again to the host only", async () => {
    const host = connectedClient({ role: "host" }, "Results");
    addScore(host, "ann-12345", "Ann", 5);
    const { unmount } = render(Results, { manager: host.manager });
    await fireEvent.click(screen.getByRole("button", { name: /play again/i }));
    expect(host.room.requests).toContainEqual({ type: "ACTION", payload: { type: "PLAY_AGAIN" } });
    unmount();

    const guest = connectedClient({}, "Results");
    render(Results, { manager: guest.manager });
    expect(screen.queryByRole("button", { name: /play again/i })).not.toBeInTheDocument();
  });
});
