import { connectedClient } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { NameInput } from "../../src/components/index.js";
import { NameField } from "../../src/NameField.svelte.js";

const field = () => new NameField(connectedClient({ stateClass: BaseGameState }).manager);

describe("NameInput", () => {
  it("shows the draft under a label", () => {
    render(NameInput, { field: field() });
    expect(screen.getByLabelText("Your name")).toHaveValue("Me");
  });

  it("takes focus only when asked", () => {
    const first = render(NameInput, { field: field() });
    expect(screen.getByLabelText("Your name")).not.toHaveFocus();
    first.unmount();
    render(NameInput, { field: field(), focus: true });
    expect(screen.getByLabelText("Your name")).toHaveFocus();
  });

  it("writes typing to the field", async () => {
    const f = field();
    render(NameInput, { field: f });
    await fireEvent.input(screen.getByLabelText("Your name"), { target: { value: "Ann" } });
    expect(f.draft).toBe("Ann");
    f.destroy();
  });

  it("gives every instance a distinct input id that its own label targets", () => {
    const first = render(NameInput, { field: field() });
    const second = render(NameInput, { field: field() });
    const inputs = screen.getAllByLabelText("Your name");
    expect(inputs).toHaveLength(2);
    expect(new Set(inputs.map((input) => input.id)).size).toBe(2);
    for (const input of inputs) {
      expect(document.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    }
    first.unmount();
    second.unmount();
  });
});
