import { connectedClient, type FetchStub, fakeFetch } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WelcomeViewModel } from "../src/WelcomeViewModel.svelte.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const stubFetch = (reply: unknown): FetchStub => {
  const stub = fakeFetch(reply);
  vi.stubGlobal("fetch", stub.fetch);
  return stub;
};

const client = () => connectedClient({ stateClass: BaseGameState });

describe("WelcomeViewModel", () => {
  it("cleans a typed code to four capital letters", () => {
    const vm = new WelcomeViewModel(client().manager);
    vm.setCode("ab1c-dxyz");
    expect(vm.code).toBe("ABCD");
    expect(vm.codeIsValid).toBe(true);
    vm.setCode("ab");
    expect(vm.codeIsValid).toBe(false);
  });

  it("hosts, and shows why it could not", async () => {
    const network = stubFetch(new Error("Server down"));
    const { manager } = client();
    manager.dispose();
    const vm = new WelcomeViewModel(manager);
    await vm.host();
    expect(vm.localError).toBe("Server down");
    expect(network.urls.some((url) => url.includes("/matchmake/create/"))).toBe(true);
    vm.dismissError();
    expect(vm.localError).toBeUndefined();
  });

  it("joins with the typed code, and shows why it could not", async () => {
    const network = stubFetch({ error: "Game code not found" });
    const { manager } = client();
    manager.dispose();
    const vm = new WelcomeViewModel(manager);
    vm.setCode("wxyz");
    await vm.join();
    expect(network.urls).toEqual([expect.stringContaining("code=WXYZ")]);
    expect(vm.localError).toBe("Game code not found");
  });

  it("shows a failure that is not an Error as text", async () => {
    stubFetch("plain failure");
    const { manager } = client();
    manager.dispose();
    const vm = new WelcomeViewModel(manager);
    vm.setCode("wxyz");
    await vm.join();
    expect(vm.localError).toBe("plain failure");
  });

  it("explains a code that is too short without asking the network", async () => {
    const network = stubFetch({ error: "unused" });
    const { manager } = client();
    manager.dispose();
    const vm = new WelcomeViewModel(manager);
    vm.setCode("ab");
    await vm.join();
    expect(vm.localError).toBe("Game code must be 4 letters (A-Z)");
    expect(network.urls).toEqual([]);
  });

  it("is busy only while connecting", () => {
    const { manager } = client();
    const vm = new WelcomeViewModel(manager);
    expect(vm.busy).toBe(false);
    manager.status = "connecting";
    expect(vm.busy).toBe(true);
  });

  it("joins once from a share link", async () => {
    const network = stubFetch({ error: "Game code not found" });
    const { manager } = client();
    manager.dispose();
    const vm = new WelcomeViewModel(manager, "ABCD");
    await vm.autoJoinIfRequested();
    await vm.autoJoinIfRequested();
    expect(network.urls).toHaveLength(1);
    expect(vm.code).toBe("ABCD");
  });

  it("does nothing without a share link", async () => {
    const network = stubFetch({ error: "unused" });
    const { manager } = client();
    manager.dispose();
    await new WelcomeViewModel(manager).autoJoinIfRequested();
    expect(network.urls).toEqual([]);
  });

  it("watches the typed code as a spectator", async () => {
    const { manager } = client();
    const watch = vi
      .spyOn(manager, "joinAsSpectator")
      .mockRejectedValueOnce(new Error("No such room"));
    const vm = new WelcomeViewModel(manager);
    vm.setCode("wxyz");
    await vm.watch();
    expect(watch).toHaveBeenCalledWith("WXYZ");
    expect(vm.localError).toBe("No such room");
    watch.mockResolvedValueOnce();
    await vm.watch();
    expect(vm.localError).toBeUndefined();
  });

  it("watches once from a TV link, ahead of a share link", async () => {
    const { manager } = client();
    const watch = vi.spyOn(manager, "joinAsSpectator").mockResolvedValue();
    const join = vi.spyOn(manager, "join").mockResolvedValue();
    const vm = new WelcomeViewModel(manager, "AAAA", "BBBB");
    await vm.autoJoinIfRequested();
    await vm.autoJoinIfRequested();
    expect(watch).toHaveBeenCalledExactlyOnceWith("BBBB");
    expect(join).not.toHaveBeenCalled();
    expect(vm.code).toBe("BBBB");
  });
});
