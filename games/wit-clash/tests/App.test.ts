import type { GameConnectionManager } from "@partygame/client/src/connection.svelte.js";
import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import App from "../ui/App.svelte";

describe("App.svelte", () => {
  const createMockManager = (phase: string) =>
    ({
      connectionStatus: "connected",
      room: {
        state: {
          phase,
          publicData: JSON.stringify({ votingOptions: [] }),
          roomCode: "TEST",
        },
        sessionId: "test-session",
        send: () => {},
      },
    }) as unknown as GameConnectionManager;

  it("should render Lobby phase", () => {
    render(App, { manager: createMockManager("Lobby") });
    expect(screen.getByText("WitClash")).toBeInTheDocument();
  });

  it("should render Prompting phase", () => {
    render(App, { manager: createMockManager("Prompting") });
    expect(screen.getByText("Answer the Prompt!")).toBeInTheDocument();
  });

  it("should render Voting phase", () => {
    render(App, { manager: createMockManager("Voting") });
    expect(screen.getByText("Vote!")).toBeInTheDocument();
  });

  it("should render Results phase", () => {
    render(App, { manager: createMockManager("Results") });
    expect(screen.getByText("Final Scores")).toBeInTheDocument();
  });

  it("should render unknown phase", () => {
    render(App, { manager: createMockManager("Unknown") });
    expect(screen.getByText("Phase: Unknown")).toBeInTheDocument();
  });
});
