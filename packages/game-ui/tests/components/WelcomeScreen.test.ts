import { connectedClient } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { render, screen, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WelcomeViewModel } from "../../src/WelcomeViewModel.svelte.js";
import WelcomeScreenHeroProvider from "../fixtures/WelcomeScreenHeroProvider.svelte";
import WelcomeScreenHowToProvider from "../fixtures/WelcomeScreenHowToProvider.svelte";
import WelcomeScreenProvider from "../fixtures/WelcomeScreenProvider.svelte";

const client = () => connectedClient({ stateClass: BaseGameState });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WelcomeScreen", () => {
  it("shows the wordmark title, tagline and host button", () => {
    const vm = new WelcomeViewModel(client().manager);
    render(WelcomeScreenProvider, { vm });
    expect(screen.getByRole("heading", { name: "TestGame" })).toBeInTheDocument();
    expect(screen.getByText("A test tagline.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Host Game" })).toBeEnabled();
  });

  it("hosts a room from the host button", async () => {
    const c = client();
    const create = vi.spyOn(c.manager, "create").mockResolvedValue();
    render(WelcomeScreenProvider, { vm: new WelcomeViewModel(c.manager) });
    await userEvent.click(screen.getByRole("button", { name: "Host Game" }));
    expect(create).toHaveBeenCalledOnce();
  });

  it("joins with the typed code, disabled until it is valid", async () => {
    const c = client();
    const join = vi.spyOn(c.manager, "join").mockResolvedValue();
    render(WelcomeScreenProvider, { vm: new WelcomeViewModel(c.manager) });
    const input = screen.getByLabelText("Game code");
    expect(input).toHaveAttribute("inputmode", "text");
    expect(input).toHaveAttribute("autocapitalize", "characters");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("spellcheck", "false");
    const joinButton = screen.getByRole("button", { name: "Join" });
    expect(joinButton).toBeDisabled();
    await userEvent.type(input, "abcd");
    expect(joinButton).toBeEnabled();
    await userEvent.click(joinButton);
    expect(join).toHaveBeenCalledOnce();
  });

  it("watches on a TV with the typed code", async () => {
    const c = client();
    const vm = new WelcomeViewModel(c.manager);
    vi.spyOn(c.manager, "joinAsSpectator").mockResolvedValue();
    render(WelcomeScreenProvider, { vm });
    await userEvent.type(screen.getByLabelText("Game code"), "wxyz");
    const watch = vi.spyOn(vm, "watch");
    await userEvent.click(screen.getByRole("button", { name: /watch on a tv/i }));
    expect(watch).toHaveBeenCalledOnce();
  });

  it("shows a local error with a dismiss", async () => {
    const vm = new WelcomeViewModel(client().manager);
    vm.localError = "Could not reach the server";
    render(WelcomeScreenProvider, { vm });
    expect(screen.getByRole("alert")).toHaveTextContent("Could not reach the server");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("auto-joins from a share link once on mount", async () => {
    const c = client();
    const join = vi.spyOn(c.manager, "join").mockResolvedValue();
    render(WelcomeScreenProvider, { vm: new WelcomeViewModel(c.manager, "QRST") });
    await waitFor(() => expect(join).toHaveBeenCalledOnce());
  });

  it("auto-watches from a TV link on mount", async () => {
    const c = client();
    const watch = vi.spyOn(c.manager, "joinAsSpectator").mockResolvedValue();
    render(WelcomeScreenProvider, { vm: new WelcomeViewModel(c.manager, undefined, "WXYZ") });
    await waitFor(() => expect(watch).toHaveBeenCalledOnce());
  });

  it("lets a hero snippet replace the default hero", () => {
    const vm = new WelcomeViewModel(client().manager);
    render(WelcomeScreenHeroProvider, { vm });
    expect(screen.getByText("Custom hero.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "TestGame" })).not.toBeInTheDocument();
    expect(screen.queryByText("A test tagline.")).not.toBeInTheDocument();
  });

  it("disables the actions while connecting", () => {
    const c = client();
    c.manager.status = "connecting";
    render(WelcomeScreenProvider, { vm: new WelcomeViewModel(c.manager) });
    expect(screen.getByRole("button", { name: "Host Game" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Join" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /watch on a tv/i })).toBeDisabled();
  });

  it("renders an optional howToPlay slot, and nothing without it", () => {
    const plain = render(WelcomeScreenProvider, { vm: new WelcomeViewModel(client().manager) });
    expect(screen.queryByRole("button", { name: "How to play" })).not.toBeInTheDocument();
    plain.unmount();

    render(WelcomeScreenHowToProvider, { vm: new WelcomeViewModel(client().manager) });
    const welcome = document.querySelector<HTMLElement>(".welcome");
    expect(welcome).not.toBeNull();
    expect(welcome?.contains(screen.getByRole("button", { name: "How to play" }))).toBe(true);
  });
});
