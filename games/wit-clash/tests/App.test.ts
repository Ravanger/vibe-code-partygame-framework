import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import App from "../ui/App.svelte";
import { fakeManager } from "./helpers/fakes.js";

describe("App.svelte routing", () => {
  it("renders the Welcome screen, not an error, when disconnected", () => {
    const manager = fakeManager({ connectionStatus: "disconnected" });
    render(App, { manager });
    expect(screen.getByRole("button", { name: /host game/i })).toBeInTheDocument();
  });

  it("shows Host Game button on Welcome screen", () => {
    const manager = fakeManager({ connectionStatus: "disconnected" });
    render(App, { manager });
    expect(screen.getByRole("button", { name: /host game/i })).toBeInTheDocument();
  });
});
