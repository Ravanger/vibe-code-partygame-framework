import { connectedClient, type SeatConfig } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { LobbySettings } from "../../src/components/index.js";
import { LobbySettingsViewModel } from "../../src/LobbySettingsViewModel.svelte.js";
import { TEST_DEFAULTS, TestOptionsSchema } from "../fixtures/optionsSchema.js";
import { expectNoViolations } from "../support/a11y.js";

const setup = (seat: SeatConfig = {}) => {
  const c = connectedClient({ stateClass: BaseGameState, seat });
  c.state.options = JSON.stringify({ turnSeconds: 30 });
  const vm = new LobbySettingsViewModel(c.manager, {
    schema: TestOptionsSchema,
    defaults: TEST_DEFAULTS,
  });
  return { c, vm };
};

describe("LobbySettings", () => {
  it("gives the host a number input per field that commits a change", async () => {
    const { c, vm } = setup({ role: "host" });
    const { container } = render(LobbySettings, { vm });
    const input = screen.getByLabelText("Turn seconds");
    expect(input).toHaveValue(30);
    await fireEvent.input(input, { target: { value: "40" } });
    await fireEvent.change(input);
    expect(c.room.requests).toEqual([
      { type: "ACTION", payload: { type: "SET_OPTIONS", turnSeconds: 40 } },
    ]);
    await expectNoViolations(container, "LobbySettings");
  });

  it("reaches the editable fields by tabbing from the summary", async () => {
    const { vm } = setup({ role: "host" });
    const { container } = render(LobbySettings, { vm });
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(container.querySelector("summary"));
    await user.tab();
    expect(screen.getByLabelText("Turn seconds")).toHaveFocus();
  });

  it("gives the host choice buttons per string-enum field that commit a pick", async () => {
    const c = connectedClient({ stateClass: BaseGameState, seat: { role: "host" } });
    c.state.options = JSON.stringify({ level: "moderate" });
    const vm = new LobbySettingsViewModel(c.manager, {
      schema: z.object({ level: z.enum(["off", "moderate", "strict"]).default("moderate") }),
    });
    const { container } = render(LobbySettings, { vm });
    expect(screen.getByRole("button", { name: "moderate" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await fireEvent.click(screen.getByRole("button", { name: "strict" }));
    expect(c.room.requests).toEqual([
      { type: "ACTION", payload: { level: "strict", type: "SET_OPTIONS" } },
    ]);
    await expectNoViolations(container, "LobbySettings");
  });

  it("gives every instance distinct input ids that its own labels target", () => {
    const a = setup({ role: "host" });
    const b = setup({ role: "host" });
    const first = render(LobbySettings, { vm: a.vm });
    const second = render(LobbySettings, { vm: b.vm });
    const inputs = [
      ...first.container.querySelectorAll<HTMLInputElement>("input[id]"),
      ...second.container.querySelectorAll<HTMLInputElement>("input[id]"),
    ];
    expect(inputs.length).toBeGreaterThan(1);
    expect(new Set(inputs.map((input) => input.id)).size).toBe(inputs.length);
    for (const input of inputs) {
      expect(document.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    }
  });

  it("renders editable rows as a list, never a definition list", async () => {
    const { vm } = setup({ role: "host" });
    const { container } = render(LobbySettings, { vm });
    expect(container.querySelector("dl")).not.toBeInTheDocument();
    expect(container.querySelectorAll("ul li.setting").length).toBeGreaterThan(0);
    await expectNoViolations(container, "LobbySettings");
  });

  it("shows everyone else read-only lines, collapsed", async () => {
    const { vm } = setup();
    const { container } = render(LobbySettings, { vm });
    expect(screen.getByText("Game settings")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(container.querySelector("dl > div")).not.toBeInTheDocument();
    expect(screen.getByText("Turn seconds").tagName).toBe("DT");
    expect(screen.getByText("30").tagName).toBe("DD");
    expect(container.querySelector("details")).not.toHaveAttribute("open");
    await expectNoViolations(container, "LobbySettings");
  });

  it("opens for the host", async () => {
    const { vm } = setup({ role: "host" });
    const { container } = render(LobbySettings, { vm });
    expect(container.querySelector("details")).toHaveAttribute("open");
    await expectNoViolations(container, "LobbySettings");
  });
});
