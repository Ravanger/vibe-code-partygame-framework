import { connectedClient } from "@partygame/game-client/testing";
import { ErrorCode } from "@partygame/shared";
import { BaseGameState } from "@partygame/shared/schema";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GameControls,
  LobbySettings,
  NameInput,
  Podium,
  QrCode,
} from "../../src/components/index.js";
import { GameControlsViewModel } from "../../src/GameControlsViewModel.svelte.js";
import { type PodiumRow, type PodiumStep, podiumSteps, rankRows } from "../../src/index.js";
import { LobbySettingsViewModel } from "../../src/LobbySettingsViewModel.svelte.js";
import { NameField } from "../../src/NameField.svelte.js";
import { PhaseClock } from "../../src/PhaseClock.js";
import { errorText, getStrings, setStrings } from "../../src/strings.js";
import { WelcomeViewModel } from "../../src/WelcomeViewModel.svelte.js";
import NameInputProvider from "../fixtures/NameInputProvider.svelte";
import { TEST_DEFAULTS, TestOptionsSchema } from "../fixtures/optionsSchema.js";

afterEach(() => {
  setStrings({});
  vi.restoreAllMocks();
});

describe("defaultUiStrings and the table", () => {
  it("holds the English label for every component string", () => {
    const strings = getStrings();
    expect(strings.gameMenu).toBe("Game menu");
    expect(strings.leaveGame).toBe("Leave game");
    expect(strings.endGame).toBe("End game");
    expect(strings.confirmEndGame).toBe("End the game for everyone?");
    expect(strings.yes).toBe("Yes");
    expect(strings.no).toBe("No");
    expect(strings.gameSettings).toBe("Game settings");
    expect(strings.yourName).toBe("Your name");
    expect(strings.enterYourName).toBe("Enter your name");
    expect(strings.podium).toBe("Podium");
    expect(strings.you).toBe("you");
    expect(strings.qrCode).toBe("QR code that opens the join link");
    expect(strings.secondsRemaining(5)).toBe("5 seconds remaining");
  });

  it("lets setStrings and getStrings work outside a component", () => {
    setStrings({ you: "du" });
    const table = getStrings();
    expect(table.you).toBe("du");
    expect(table.leaveGame).toBe("Leave game");
  });

  it("reads the table set by a provider component through the context", () => {
    const field = new NameField(connectedClient({ stateClass: BaseGameState }).manager);
    render(NameInputProvider, { field });
    expect(screen.getByLabelText("Context")).toBeInTheDocument();
  });

  it("keeps the server message in errorText unless the table names the code", () => {
    expect(errorText(ErrorCode.KICKED, "Removed by the host")).toBe("Removed by the host");
    setStrings({ clientStrings: { errors: { KICKED: "Entfernt vom Host" } } });
    expect(errorText(ErrorCode.KICKED, "Removed by the host")).toBe("Entfernt vom Host");
    expect(errorText(ErrorCode.WRONG_PHASE, "Not now")).toBe("Not now");
  });
});

describe("GameControls", () => {
  it("renders the English labels without a provider", async () => {
    const c = connectedClient({ stateClass: BaseGameState, seat: { role: "host" }, phase: "Play" });
    render(GameControls, { vm: new GameControlsViewModel(c.manager) });
    expect(screen.getByRole("button", { name: "Game menu" })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Game menu" }));
    expect(screen.getByRole("button", { name: "End game" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave game" })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "End game" }));
    expect(screen.getByText("End the game for everyone?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
  });

  it("renders the replaced labels from the table", async () => {
    setStrings({
      gameMenu: "Spielmenü",
      leaveGame: "Spiel verlassen",
      endGame: "Spiel beenden",
      confirmEndGame: "Spiel für alle beenden?",
      yes: "Ja",
      no: "Nein",
    });
    const c = connectedClient({ stateClass: BaseGameState, seat: { role: "host" }, phase: "Play" });
    render(GameControls, { vm: new GameControlsViewModel(c.manager) });
    expect(screen.getByRole("button", { name: "Spielmenü" })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Spielmenü" }));
    expect(screen.getByRole("button", { name: "Spiel beenden" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Spiel verlassen" })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Spiel beenden" }));
    expect(screen.getByText("Spiel für alle beenden?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ja" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nein" })).toBeInTheDocument();
  });
});

describe("LobbySettings", () => {
  const setup = () => {
    const c = connectedClient({ stateClass: BaseGameState, seat: { role: "host" } });
    c.state.options = JSON.stringify({ turnSeconds: 30 });
    const vm = new LobbySettingsViewModel(c.manager, {
      schema: TestOptionsSchema,
      defaults: TEST_DEFAULTS,
    });
    render(LobbySettings, { vm });
  };

  it("renders the English summary without a provider", () => {
    setup();
    expect(screen.getByText("Game settings")).toBeInTheDocument();
  });

  it("renders the replaced summary from the table", () => {
    setStrings({ gameSettings: "Spieler Einstellungen" });
    setup();
    expect(screen.getByText("Spieler Einstellungen")).toBeInTheDocument();
  });
});

describe("NameInput", () => {
  it("renders the English label and placeholder without a provider", () => {
    const field = new NameField(connectedClient({ stateClass: BaseGameState }).manager);
    render(NameInput, { field });
    expect(screen.getByLabelText("Your name")).toHaveAttribute("placeholder", "Enter your name");
  });

  it("renders the replaced label and placeholder from the table", () => {
    setStrings({ yourName: "Dein Name", enterYourName: "Namen eingeben" });
    const field = new NameField(connectedClient({ stateClass: BaseGameState }).manager);
    render(NameInput, { field });
    expect(screen.getByLabelText("Dein Name")).toHaveAttribute("placeholder", "Namen eingeben");
  });
});

describe("Podium", () => {
  function steps(): PodiumStep<PodiumRow>[] {
    return podiumSteps(
      rankRows([
        { playerId: "a", name: "Ann", score: 30, hasLeft: false, isMe: true },
        { playerId: "b", name: "Bo", score: 20, hasLeft: false, isMe: false },
      ]),
    );
  }

  it("renders the English aria-label and you-marker without a provider", () => {
    render(Podium, { steps: steps() });
    expect(screen.getByRole("list", { name: "Podium" })).toBeInTheDocument();
    expect(screen.getAllByText("← you")).toHaveLength(1);
  });

  it("renders the replaced aria-label and you-marker from the table", () => {
    setStrings({ podium: "Treppchen", you: "du" });
    render(Podium, { steps: steps() });
    expect(screen.getByRole("list", { name: "Treppchen" })).toBeInTheDocument();
    expect(screen.getAllByText("← du")).toHaveLength(1);
  });
});

describe("QrCode", () => {
  it("renders the English aria-label without a provider", () => {
    render(QrCode, { text: "http://join/ABCD" });
    expect(
      screen.getByRole("img", { name: "QR code that opens the join link" }),
    ).toBeInTheDocument();
  });

  it("renders the replaced aria-label from the table", () => {
    setStrings({ qrCode: "QR-Code für den Join-Link" });
    render(QrCode, { text: "http://join/ABCD" });
    expect(screen.getByRole("img", { name: "QR-Code für den Join-Link" })).toBeInTheDocument();
  });
});

describe("PhaseClock", () => {
  const clock = () => {
    const c = connectedClient({ stateClass: BaseGameState });
    c.state.serverNow = 5_000_000;
    c.state.phaseEndsAt = 5_030_000;
    return new PhaseClock(c.manager, () => 30);
  };

  it("announces the default English text at the thresholds", () => {
    expect(clock().announcement).toBe("30 seconds remaining");
  });

  it("builds the announcement from the secondsRemaining function entry", () => {
    setStrings({ secondsRemaining: (n) => `Noch ${n} Sekunden` });
    expect(clock().announcement).toBe("Noch 30 Sekunden");
  });
});

describe("WelcomeViewModel error text", () => {
  const failingJoin = (c: ReturnType<typeof connectedClient>) => {
    vi.spyOn(c.manager, "join").mockImplementation(async () => {
      c.manager.lastServerError = {
        code: ErrorCode.ROOM_NOT_FOUND,
        message: "Game code not found",
      };
      throw new Error("down");
    });
  };

  it("keeps the server message when the table has no entry for the code", async () => {
    const c = connectedClient({ stateClass: BaseGameState });
    failingJoin(c);
    const vm = new WelcomeViewModel(c.manager);
    vm.setCode("ABCD");
    await vm.join();
    expect(vm.localError).toBe("Game code not found");
  });

  it("uses the table's text when it names the code", async () => {
    setStrings({ clientStrings: { errors: { ROOM_NOT_FOUND: "Spielcode nicht gefunden" } } });
    const c = connectedClient({ stateClass: BaseGameState });
    failingJoin(c);
    const vm = new WelcomeViewModel(c.manager);
    vm.setCode("ABCD");
    await vm.join();
    expect(vm.localError).toBe("Spielcode nicht gefunden");
  });
});
