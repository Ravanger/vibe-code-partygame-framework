import { connectedClient } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NameInput } from "../../src/components/index.js";
import { NameField } from "../../src/NameField.svelte.js";
import { expectNoViolations } from "../support/a11y.js";

const field = () => new NameField(connectedClient({ stateClass: BaseGameState }).manager);

describe("NameInput", () => {
  it("shows the draft under a label", async () => {
    const { container } = render(NameInput, { field: field() });
    expect(screen.getByLabelText("Your name")).toHaveValue("Me");
    await expectNoViolations(container, "NameInput");
  });

  it("takes focus only when asked", async () => {
    const first = render(NameInput, { field: field() });
    expect(screen.getByLabelText("Your name")).not.toHaveFocus();
    first.unmount();
    const second = render(NameInput, { field: field(), focus: true });
    expect(screen.getByLabelText("Your name")).toHaveFocus();
    await expectNoViolations(second.container, "NameInput");
  });

  it("moves the draft with real keystrokes", async () => {
    const f = field();
    render(NameInput, { field: f });
    const input = screen.getByLabelText("Your name");
    const user = userEvent.setup();
    await user.click(input);
    expect(input).toHaveFocus();
    await user.clear(input);
    expect(f.draft).toBe("");
    await user.type(input, "ab");
    expect(f.draft).toBe("ab");
    f.destroy();
  });

  it("writes typing to the field", async () => {
    const f = field();
    render(NameInput, { field: f });
    await fireEvent.input(screen.getByLabelText("Your name"), { target: { value: "Ann" } });
    expect(f.draft).toBe("Ann");
    f.destroy();
  });

  it("gives every instance a distinct input id that its own label targets", async () => {
    const first = render(NameInput, { field: field() });
    const second = render(NameInput, { field: field() });
    const inputs = screen.getAllByLabelText("Your name");
    expect(inputs).toHaveLength(2);
    expect(new Set(inputs.map((input) => input.id)).size).toBe(2);
    for (const input of inputs) {
      expect(document.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    }
    await expectNoViolations(first.container, "NameInput");
    first.unmount();
    second.unmount();
  });
});
