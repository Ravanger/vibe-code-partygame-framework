import { beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeViewModel } from "../../ui/viewmodels/WelcomeViewModel.svelte.js";
import { fakeManager } from "../helpers/fakes.js";

beforeEach(() => localStorage.clear());

describe("code input sanitising", () => {
  it("uppercases letters", () => {
    const vm = new WelcomeViewModel(fakeManager() as never);
    vm.setCode("abcd");
    expect(vm.code).toBe("ABCD");
  });
  it("strips digits and symbols", () => {
    const vm = new WelcomeViewModel(fakeManager() as never);
    vm.setCode("a1b-2c!d");
    expect(vm.code).toBe("ABCD");
  });
  it("caps at four characters", () => {
    const vm = new WelcomeViewModel(fakeManager() as never);
    vm.setCode("ABCDEFG");
    expect(vm.code).toBe("ABCD");
  });
});

describe("validation", () => {
  it("is invalid below four letters", () => {
    const vm = new WelcomeViewModel(fakeManager() as never);
    vm.setCode("AB");
    expect(vm.codeIsValid).toBe(false);
  });
  it("is valid at exactly four letters", () => {
    const vm = new WelcomeViewModel(fakeManager() as never);
    vm.setCode("ABCD");
    expect(vm.codeIsValid).toBe(true);
  });
  it("refuses to join with a short code and explains why", async () => {
    const m = fakeManager();
    const vm = new WelcomeViewModel(m as never);
    vm.setCode("AB");
    await vm.join();
    expect(m.joinByCode).not.toHaveBeenCalled();
    expect(vm.localError).toMatch(/4 letters/i);
  });
});

describe("actions", () => {
  it("host() creates the wit_clash room", async () => {
    const m = fakeManager();
    await new WelcomeViewModel(m as never).host();
    expect(m.create).toHaveBeenCalledWith("wit_clash");
  });

  it("join() passes the sanitised code", async () => {
    const m = fakeManager();
    const vm = new WelcomeViewModel(m as never);
    vm.setCode("wxyz");
    await vm.join();
    expect(m.joinByCode).toHaveBeenCalledWith("WXYZ");
  });

  it("surfaces a join failure without throwing", async () => {
    const m = fakeManager();
    m.joinByCode = vi.fn().mockRejectedValue(new Error("Game code not found"));
    const vm = new WelcomeViewModel(m as never);
    vm.setCode("ZZZZ");
    await expect(vm.join()).resolves.toBeUndefined();
    expect(vm.localError).toMatch(/not found/i);
  });

  it("clears a stale error when a new attempt begins", async () => {
    const m = fakeManager();
    const vm = new WelcomeViewModel(m as never);
    vm.setCode("AB"); await vm.join();
    expect(vm.localError).toBeTruthy();
    vm.setCode("ABCD"); await vm.join();
    expect(vm.localError).toBeUndefined();
  });
});

describe("hosting is always available (D7 regression)", () => {
  it("canHost stays true even with a stored lastRoomCode", () => {
    localStorage.setItem("lastRoomCode", "PNVW");
    expect(new WelcomeViewModel(fakeManager() as never).canHost).toBe(true);
  });
  it("offers rejoin as an extra option, not a replacement", () => {
    localStorage.setItem("lastRoomCode", "PNVW");
    const vm = new WelcomeViewModel(fakeManager() as never);
    expect(vm.canHost).toBe(true);
    expect(vm.previousRoomCode).toBe("PNVW");
  });
  it("has no previous code on a clean browser", () => {
    expect(new WelcomeViewModel(fakeManager() as never).previousRoomCode).toBeUndefined();
  });
});

describe("auto-join from ?code= (D3 regression)", () => {
  it("joins once with the code from the URL", async () => {
    const m = fakeManager();
    const vm = new WelcomeViewModel(m as never, "PNVW");
    await vm.autoJoinIfRequested();
    expect(m.joinByCode).toHaveBeenCalledWith("PNVW");
  });
  it("never fires twice", async () => {
    const m = fakeManager();
    const vm = new WelcomeViewModel(m as never, "PNVW");
    await vm.autoJoinIfRequested();
    await vm.autoJoinIfRequested();
    expect(m.joinByCode).toHaveBeenCalledTimes(1);
  });
  it("ignores a malformed URL code", async () => {
    const m = fakeManager();
    await new WelcomeViewModel(m as never, "12").autoJoinIfRequested();
    expect(m.joinByCode).not.toHaveBeenCalled();
  });
  it("does nothing when no code is supplied", async () => {
    const m = fakeManager();
    await new WelcomeViewModel(m as never).autoJoinIfRequested();
    expect(m.joinByCode).not.toHaveBeenCalled();
  });
});

describe("busy state", () => {
  it("is busy while connecting", () => {
    const m = fakeManager(); m.connectionStatus = "connecting";
    expect(new WelcomeViewModel(m as never).busy).toBe(true);
  });
});
