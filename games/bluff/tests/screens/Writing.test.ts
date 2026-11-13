import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ANSWER_MAX_LENGTH } from "../../src/actionNames.js";
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
    const writers = screen.getByLabelText("Writers");
    expect(within(writers).getAllByRole("listitem")).toHaveLength(2);
    const me = screen.getByRole("listitem", { name: /me/i });
    expect(me).toHaveTextContent("0/1");
    expect(within(me).queryByRole("img")).not.toBeInTheDocument();
    const ann = screen.getByRole("listitem", { name: /ann/i });
    expect(ann).toHaveTextContent("1/1");
    expect(within(ann).getByRole("img", { name: "Done" })).toBeInTheDocument();
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

  it("caps the textarea at the answer limit", () => {
    const c = connectedClient({}, "Writing");
    render(Writing, { manager: c.manager });
    expect(screen.getByPlaceholderText("Write a fake answer…")).toHaveAttribute(
      "maxlength",
      String(ANSWER_MAX_LENGTH),
    );
  });

  it("keeps the draft and shows the filter's reason after a refusal, then clears on success", async () => {
    const c = connectedClient({}, "Writing");
    render(Writing, { manager: c.manager });
    const box = screen.getByPlaceholderText("Write a fake answer…");
    await fireEvent.input(box, { target: { value: "a rude line" } });
    c.room.reply = {
      ok: false,
      error: { code: "CONTENT_REJECTED", message: "That text was not allowed" },
    };
    await fireEvent.click(screen.getByRole("button", { name: /lock it in/i }));
    await vi.waitFor(() => expect(c.manager.lastServerError?.code).toBe("CONTENT_REJECTED"));
    expect(box).toHaveValue("a rude line");
    expect(screen.getByRole("alert")).toHaveTextContent("That text was not allowed");

    c.room.reply = { ok: true };
    await fireEvent.click(screen.getByRole("button", { name: /lock it in/i }));
    await screen.findByDisplayValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
