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
  it("has a field per option kind and shows published values, with defaults for the rest", () => {
    const c = client({ role: "host" });
    c.state.options = JSON.stringify({ turnSeconds: 30 });
    const vm = model(c);
    expect(vm.fields.map((f) => f.key)).toEqual([
      "turnSeconds",
      "tolerance",
      "soundOn",
      "level",
      "label",
    ]);
    expect(vm.valueOf("turnSeconds")).toBe("30");
    expect(vm.valueOf("soundOn")).toBe("true");
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

  it("throws when the schema has no field defaults and none are given", () => {
    const c = client();
    expect(() => new LobbySettingsViewModel(c.manager, { schema: z.number() })).toThrow();
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

  it("sends a non-integer number for a stepped field", async () => {
    const host = client({ role: "host" });
    const vm = model(host);
    vm.setDraft("tolerance", "0.3");
    await vm.commit("tolerance");
    expect(host.room.requests).toEqual([
      { type: "ACTION", payload: { tolerance: 0.3, type: "SET_OPTIONS" } },
    ]);
  });

  it("sends a boolean for a checkbox draft and drops anything else", async () => {
    const host = client({ role: "host" });
    const vm = model(host);
    vm.setDraft("soundOn", "false");
    await vm.commit("soundOn");
    vm.setDraft("soundOn", "maybe");
    await vm.commit("soundOn");
    expect(host.room.requests).toEqual([
      { type: "ACTION", payload: { soundOn: false, type: "SET_OPTIONS" } },
    ]);
    expect(vm.valueOf("soundOn")).toBe("true");
  });

  it("sends the typed string for a text field, even an empty one", async () => {
    const host = client({ role: "host" });
    const vm = model(host);
    vm.setDraft("label", "hello");
    await vm.commit("label");
    vm.setDraft("label", "");
    await vm.commit("label");
    expect(host.room.requests).toEqual([
      { type: "ACTION", payload: { label: "hello", type: "SET_OPTIONS" } },
      { type: "ACTION", payload: { label: "", type: "SET_OPTIONS" } },
    ]);
  });

  it("sends nothing for a key the form does not have", async () => {
    const host = client({ role: "host" });
    const vm = model(host);
    vm.setDraft("nope", "5");
    await vm.commit("nope");
    expect(host.room.requests).toEqual([]);
  });

  it("passes onUnsupported through to the field builder", () => {
    const seen: string[] = [];
    new LobbySettingsViewModel(client().manager, {
      schema: z.object({ tags: z.array(z.string()).default([]) }),
      onUnsupported: (key) => {
        seen.push(key);
      },
    });
    expect(seen).toEqual(["tags"]);
  });

  it("clearing a field sends nothing and restores the published value", async () => {
    const host = client({ role: "host" });
    host.state.options = JSON.stringify({ turnSeconds: 30 });
    const vm = model(host);
    expect(vm.valueOf("turnSeconds")).toBe("30");
    vm.setDraft("turnSeconds", "");
    await vm.commit("turnSeconds");
    expect(host.room.requests).toEqual([]);
    expect(vm.valueOf("turnSeconds")).toBe("30");
  });

  it("drops a non-numeric draft without sending", async () => {
    const host = client({ role: "host" });
    const vm = model(host);
    vm.setDraft("turnSeconds", "abc");
    await vm.commit("turnSeconds");
    expect(host.room.requests).toEqual([]);
    expect(vm.valueOf("turnSeconds")).toBe("20");
  });

  const levelVm = (host: ReturnType<typeof client>) =>
    new LobbySettingsViewModel(host.manager, {
      schema: z.object({ level: z.enum(["off", "moderate", "strict"]).default("moderate") }),
    });

  it("has a field per string enum and sends the chosen value", async () => {
    const host = client({ role: "host" });
    const vm = levelVm(host);
    expect(vm.fields).toEqual([
      { key: "level", label: "Level", kind: "select", choices: ["off", "moderate", "strict"] },
    ]);
    await vm.choose("level", "strict");
    expect(host.room.requests).toEqual([
      { type: "ACTION", payload: { level: "strict", type: "SET_OPTIONS" } },
    ]);
  });

  it("drops an option draft that is not one of the choices", async () => {
    const host = client({ role: "host" });
    host.state.options = JSON.stringify({ level: "moderate" });
    const vm = levelVm(host);
    vm.setDraft("level", "loud");
    await vm.commit("level");
    expect(host.room.requests).toEqual([]);
    expect(vm.valueOf("level")).toBe("moderate");
  });

  it("puts the published value back when the server rejects an option change", async () => {
    const host = client({ role: "host" });
    host.state.options = JSON.stringify({ level: "moderate" });
    host.room.reply = { ok: false, error: { code: "INVALID_ACTION", message: "Nope" } };
    const vm = levelVm(host);
    vm.setDraft("level", "strict");
    await vm.commit("level");
    expect(vm.valueOf("level")).toBe("moderate");
  });

  it("still sends a value the schema would reject; the server validates", async () => {
    const host = client({ role: "host" });
    const vm = new LobbySettingsViewModel(host.manager, {
      schema: z.object({ n: z.number().int().min(1).max(9).default(2) }),
    });
    vm.setDraft("n", "0");
    await vm.commit("n");
    expect(host.room.requests).toEqual([
      { type: "ACTION", payload: { n: 0, type: "SET_OPTIONS" } },
    ]);
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
