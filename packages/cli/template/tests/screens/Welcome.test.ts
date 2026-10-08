import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import Welcome from "../../ui/screens/Welcome.svelte";
import { connectedClient, stubFetch } from "../helpers/client.js";

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("Welcome screen", () => {
  it("hosts a game", async () => {
    const network = stubFetch(new Error("Server down"));
    const { manager } = connectedClient();
    manager.dispose();
    render(Welcome, { manager });
    await fireEvent.click(screen.getByRole("button", { name: /host game/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/server down/i);
    expect(network.urls.some((url) => url.includes("/matchmake/create/"))).toBe(true);
  });

  it("joins only with a complete code", async () => {
    const network = stubFetch({ error: "Game code not found" });
    const { manager } = connectedClient();
    manager.dispose();
    render(Welcome, { manager });
    const joinButton = screen.getByRole("button", { name: "Join" });
    expect(joinButton).toBeDisabled();
    await fireEvent.input(screen.getByLabelText("Game code"), { target: { value: "ab" } });
    expect(joinButton).toBeDisabled();
    await fireEvent.input(screen.getByLabelText("Game code"), { target: { value: "wxyz" } });
    expect(joinButton).toBeEnabled();
    await fireEvent.click(joinButton);
    await screen.findByRole("alert");
    expect(network.urls).toEqual([expect.stringContaining("code=WXYZ")]);
  });

  it("shows why joining failed and lets the player dismiss it", async () => {
    stubFetch({ error: "Game code not found" });
    const { manager } = connectedClient();
    manager.dispose();
    render(Welcome, { manager });
    await fireEvent.input(screen.getByLabelText("Game code"), { target: { value: "wxyz" } });
    await fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Game code not found");
    await fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("joins straight away from a share link", async () => {
    window.history.replaceState({}, "", "/?code=qrst");
    const network = stubFetch({ error: "Game code not found" });
    const { manager } = connectedClient();
    manager.dispose();
    render(Welcome, { manager });
    expect(await screen.findByRole("alert")).toHaveTextContent("Game code not found");
    expect(network.urls).toEqual([expect.stringContaining("code=QRST")]);
  });

  it("watches straight away from a TV link", async () => {
    window.history.replaceState({}, "", "/?tv=qrst");
    const network = stubFetch({ error: "Game code not found" });
    const { manager } = connectedClient();
    manager.dispose();
    render(Welcome, { manager });
    expect(await screen.findByRole("alert")).toHaveTextContent("Game code not found");
    expect(network.urls).toEqual([expect.stringContaining("code=QRST")]);
  });
});
