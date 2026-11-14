import { fireEvent, render, screen, within } from "@testing-library/svelte";
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
  const board = () => within(screen.getByRole("list", { name: "Standings" }));

  it("ranks the scoreboard and names the winner", () => {
    const c = connectedClient({}, "Results");
    addScore(c, "ann-12345", "Ann", 5);
    addScore(c, c.me.id, "Me", 3);
    render(Results, { manager: c.manager });

    expect(screen.getByRole("heading", { name: "Ann wins with 5 points!" })).toBeInTheDocument();
    const rows = board().getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("#1");
    expect(rows[0]).toHaveTextContent("Ann");
    expect(rows[0]).toHaveTextContent("5");
    expect(rows[1]).toHaveTextContent("#2");
    expect(rows[1]).toHaveTextContent("Me");
    expect(rows[1]).toHaveTextContent("3");
  });

  it("calls a tie when the top is shared, shares rank one and highlights them all", () => {
    const c = connectedClient({}, "Results");
    addScore(c, "ann-12345", "Ann", 4);
    addScore(c, c.me.id, "Me", 4);
    render(Results, { manager: c.manager });
    expect(screen.getByRole("heading", { name: "It's a tie!" })).toBeInTheDocument();
    const rows = board().getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("#1");
    expect(rows[1]).toHaveTextContent("#1");
    expect(rows[0]).toHaveClass("winner");
    expect(rows[1]).toHaveClass("winner");
  });

  it("skips a rank after a tie", () => {
    const c = connectedClient({}, "Results");
    addScore(c, "ann-12345", "Ann", 5);
    addScore(c, "ben-12345", "Ben", 5);
    addScore(c, c.me.id, "Me", 3);
    render(Results, { manager: c.manager });
    const rows = board().getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("#1");
    expect(rows[1]).toHaveTextContent("#1");
    expect(rows[2]).toHaveTextContent("#3");
    expect(rows[2]).not.toHaveClass("winner");
  });

  it("ranks leavers after seated players and does not highlight them", () => {
    const c = connectedClient({}, "Results");
    addScore(c, "ann-12345", "Ann", 5);
    addScore(c, c.me.id, "Me", 4);
    c.state.scoreboard.push(
      Object.assign(new ScoreEntry(), {
        playerId: "ben-12345",
        name: "Ben",
        score: 9,
        hasLeft: true,
      }),
    );
    render(Results, { manager: c.manager });
    const rows = board().getAllByRole("listitem");
    expect(rows[0]).toHaveClass("winner");
    expect(rows[2]).toHaveTextContent("#3");
    expect(rows[2]).toHaveTextContent("Ben (left)");
    expect(rows[2]).not.toHaveClass("winner");
  });

  it("says nobody scored when all scores are zero, with no winner highlight", () => {
    const c = connectedClient({}, "Results");
    addScore(c, "ann-12345", "Ann", 0);
    addScore(c, c.me.id, "Me", 0);
    render(Results, { manager: c.manager });
    expect(screen.getByRole("heading", { name: "Nobody scored." })).toBeInTheDocument();
    for (const row of board().getAllByRole("listitem")) expect(row).not.toHaveClass("winner");
  });

  it("shows the shared podium for the top three", () => {
    const c = connectedClient({}, "Results");
    addScore(c, "ann-12345", "Ann", 5);
    addScore(c, "ben-12345", "Ben", 3);
    addScore(c, c.me.id, "Me", 1);
    render(Results, { manager: c.manager });
    const podium = screen.getByRole("list", { name: "Podium" });
    expect(within(podium).getByText("Ann")).toBeInTheDocument();
    expect(within(podium).getByText("Ben")).toBeInTheDocument();
    expect(within(podium).getByText("Me")).toBeInTheDocument();
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
