import { connectedClient, type SeatConfig } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { LobbySettings } from "../../src/components/index.js";
import { LobbySettingsViewModel } from "../../src/LobbySettingsViewModel.svelte.js";
import { TEST_DEFAULTS, TestOptionsSchema } from "../fixtures/optionsSchema.js";

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
    render(LobbySettings, { vm });
    const input = screen.getByLabelText("Turn seconds");
    expect(input).toHaveValue(30);
    await fireEvent.input(input, { target: { value: "40" } });
    await fireEvent.change(input);
    expect(c.room.requests).toEqual([
      { type: "ACTION", payload: { type: "SET_OPTIONS", turnSeconds: 40 } },
    ]);
  });

  it("shows everyone else read-only lines, collapsed", () => {
    const { vm } = setup();
    const { container } = render(LobbySettings, { vm });
    expect(screen.getByText("Game settings")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.getByText("Turn seconds").tagName).toBe("DT");
    expect(screen.getByText("30").tagName).toBe("DD");
    expect(container.querySelector("details")).not.toHaveAttribute("open");
  });

  it("opens for the host", () => {
    const { vm } = setup({ role: "host" });
    const { container } = render(LobbySettings, { vm });
    expect(container.querySelector("details")).toHaveAttribute("open");
  });
});
