import { connectedClient, type SeatConfig } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { LobbySettingsViewModel } from "../src/LobbySettingsViewModel.svelte.js";
import { TEST_DEFAULTS, TestOptionsSchema } from "./fixtures/optionsSchema.js";

const client = (seat: SeatConfig = {}) => connectedClient({ stateClass: BaseGameState, seat });

const model = (c: ReturnType<typeof client>) =>
  new LobbySettingsViewModel(c.manager, { schema: TestOptionsSchema, defaults: TEST_DEFAULTS });

describe("LobbySettingsViewModel", () => {
  it("has a field per bounded option and shows published values, with defaults for the rest", () => {
    const c = client({ role: "host" });
    c.state.options = JSON.stringify({ turnSeconds: 30 });
    const vm = model(c);
    expect(vm.fields.map((f) => f.key)).toEqual(["turnSeconds"]);
    expect(vm.valueOf("turnSeconds")).toBe("30");
    expect(vm.valueOf("label")).toBe("x");
    expect(vm.valueOf("nope")).toBe("");
  });

  it("applies label overrides", () => {
    const vm = new LobbySettingsViewModel(client().manager, {
      schema: TestOptionsSchema,
      labels: { turnSeconds: "Seconds per turn" },
    });
    expect(vm.fields[0]?.label).toBe("Seconds per turn");
  });

  it("falls back to the defaults for unusable options or no room, and to nothing without defaults", () => {
    const c = client();
    const vm = model(c);
    c.state.options = "{not json";
    expect(vm.valueOf("turnSeconds")).toBe("20");
    c.state.options = JSON.stringify({ turnSeconds: 99 });
    expect(vm.valueOf("turnSeconds")).toBe("20");
    c.manager.dispose();
    expect(vm.valueOf("turnSeconds")).toBe("20");
    expect(
      new LobbySettingsViewModel(c.manager, { schema: TestOptionsSchema }).valueOf("turnSeconds"),
    ).toBe("20");
  });

  it("shows nothing for a schema that does not publish an object and has no defaults", () => {
    const c = client();
    c.state.options = "5";
    const vm = new LobbySettingsViewModel(c.manager, { schema: z.number() });
    expect(vm.valueOf("turnSeconds")).toBe("");
    c.state.options = "{}";
    expect(vm.valueOf("turnSeconds")).toBe("");
  });

  it("lets only the host edit", async () => {
    const guest = client();
    const vm = model(guest);
    expect(vm.canEdit).toBe(false);
    vm.setDraft("turnSeconds", "40");
    await vm.commit("turnSeconds");
    expect(guest.room.requests).toEqual([]);
    expect(model(client({ role: "host" })).canEdit).toBe(true);
  });

  it("shows what is being typed and sends the number on commit", async () => {
    const host = client({ role: "host" });
    const vm = model(host);
    vm.setDraft("turnSeconds", "40");
    expect(vm.valueOf("turnSeconds")).toBe("40");
    await vm.commit("turnSeconds");
    expect(host.room.requests).toEqual([
      { type: "ACTION", payload: { turnSeconds: 40, type: "SET_OPTIONS" } },
    ]);
    expect(vm.valueOf("turnSeconds")).toBe("40");
  });

  it("sends nothing when nothing was typed", async () => {
    const host = client({ role: "host" });
    await model(host).commit("turnSeconds");
    expect(host.room.requests).toEqual([]);
  });

  it("puts the published value back when the server rejects", async () => {
    const host = client({ role: "host" });
    host.room.reply = { ok: false, error: { code: "INVALID_ACTION", message: "Too long" } };
    const vm = model(host);
    vm.setDraft("turnSeconds", "99");
    await vm.commit("turnSeconds");
    expect(vm.valueOf("turnSeconds")).toBe("20");
    expect(host.manager.lastServerError?.message).toBe("Too long");
  });

  it("starts open for the host and a spectator, folded for a player", () => {
    expect(model(client({ role: "host" })).startsOpen).toBe(true);
    const guest = client();
    expect(model(guest).startsOpen).toBe(false);
    guest.state.players.delete(guest.manager.playerId);
    expect(model(guest).startsOpen).toBe(true);
  });
});
