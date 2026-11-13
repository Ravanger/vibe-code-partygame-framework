import { type ConnectedClient, connectedClient } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { describe, expect, it, vi } from "vitest";
import { JoinNextRoundViewModel } from "../src/JoinNextRoundViewModel.js";
import { SHELL_SCREENS } from "./fixtures/shellScreens.js";

const client = () => connectedClient({ stateClass: BaseGameState });
const make = (c: ConnectedClient<BaseGameState>) =>
  new JoinNextRoundViewModel(c.manager, SHELL_SCREENS);

describe("JoinNextRoundViewModel", () => {
  it("asks for a name while the seat is not ready", () => {
    const c = client();
    c.me.isReady = false;
    const vm = make(c);
    expect(vm.needsName).toBe(true);
    expect(vm.heading).toBe("Pick a name to join");
    expect(vm.hint).toBe("You need a name before you can play.");
  });

  it("needs no name once the seat is ready", () => {
    const vm = make(client());
    expect(vm.needsName).toBe(false);
    expect(vm.heading).toBe("You'll join the next game");
    expect(vm.hint).toBe("You'll join when the host starts a new game.");
  });

  it("treats a seatless client as not needing a name", () => {
    const c = client();
    c.state.players.delete(c.manager.playerId);
    expect(make(c).needsName).toBe(false);
  });

  it("labels a known phase with its waiting label", () => {
    const c = client();
    c.state.phase = "Play";
    expect(make(c).phaseLabel).toBe("Playing");
  });

  it("falls back to the raw phase when it has no screen", () => {
    const c = client();
    c.state.phase = "Mystery";
    expect(make(c).phaseLabel).toBe("Mystery");
  });

  it("labels the lobby before the state has synced", () => {
    const c = client();
    c.manager.dispose();
    expect(make(c).phaseLabel).toBe("Waiting in the lobby");
  });

  it("destroys the name field", () => {
    const vm = make(client());
    const destroy = vi.spyOn(vm.nameField, "destroy");
    vm.destroy();
    expect(destroy).toHaveBeenCalledOnce();
  });
});
