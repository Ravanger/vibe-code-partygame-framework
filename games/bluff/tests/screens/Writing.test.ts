import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import Writing from "../../ui/screens/Writing.svelte";
import { addSeat, connectedClient } from "../helpers/client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Writing screen", () => {
  it("shows the prompt, the round and who has written", () => {
    const c = connectedClient({}, "Writing");
    addSeat(c.state, "ann-12345", { name: "Ann" });
    c.state.promptText = "What is the capital of Australia?";
    c.state.roundNumber = 2;
    c.state.totalRounds = 3;
    c.state.progress.set("ann-12345", true);
    render(Writing, { manager: c.manager });

    expect(
      screen.getByRole("heading", { name: "What is the capital of Australia?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Round 2 of 3")).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Me");
    expect(rows[0]).not.toHaveTextContent("wrote it");
    expect(rows[1]).toHaveTextContent("Ann");
    expect(rows[1]).toHaveTextContent("wrote it");
  });

  it("submits a fake on click and clears the box", async () => {
    const c = connectedClient({}, "Writing");
    render(Writing, { manager: c.manager });
    const box = screen.getByPlaceholderText("Write a fake answer…");
    expect(screen.getByRole("button", { name: /lock it in/i })).toBeDisabled();

    await fireEvent.input(box, { target: { value: "Sydney" } });
    await fireEvent.click(screen.getByRole("button", { name: /lock it in/i }));

    expect(c.room.requests).toContainEqual({
      type: "ACTION",
      payload: { text: "Sydney", type: "SUBMIT_FAKE" },
    });
    await screen.findByDisplayValue("");
  });

  it("submits on Enter but not on Shift+Enter or other keys", async () => {
    const c = connectedClient({}, "Writing");
    render(Writing, { manager: c.manager });
    const box = screen.getByPlaceholderText("Write a fake answer…");

    await fireEvent.keyDown(box, { key: "Enter" });
    expect(c.room.requests).toEqual([]);

    await fireEvent.input(box, { target: { value: "Sydney" } });

    await fireEvent.keyDown(box, { key: "a" });
    await fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(c.room.requests).toEqual([]);

    await fireEvent.keyDown(box, { key: "Enter" });
    expect(c.room.requests).toHaveLength(1);
  });

  it("hides the input once the player has written", () => {
    const c = connectedClient({}, "Writing");
    c.state.progress.set(c.me.id, true);
    render(Writing, { manager: c.manager });
    expect(screen.getByText(/your fake is in/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Write a fake answer…")).not.toBeInTheDocument();
  });

  it("shows spectators the board without any input", () => {
    const c = connectedClient({}, "Writing");
    addSeat(c.state, "ann-12345", { name: "Ann" });
    c.state.players.delete(c.manager.playerId);
    render(Writing, { manager: c.manager });
    expect(screen.getByText(/watch the fakes come in/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Write a fake answer…")).not.toBeInTheDocument();
  });
});
