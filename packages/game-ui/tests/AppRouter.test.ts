import { connectedClient, type SeatConfig } from "@partygame/game-client/testing";
import { ErrorCode } from "@partygame/shared";
import { BaseGameState } from "@partygame/shared/schema";
import { describe, expect, it } from "vitest";
import { AppRouter, createAppRouter } from "../src/AppRouter.js";

const screens = {
  Lobby: {},
  Play: { banner: "GO!" },
  Done: {},
} as const;

const client = (phase = "Lobby", seat: SeatConfig = {}) =>
  connectedClient({ stateClass: BaseGameState, phase, seat });

describe("AppRouter.screen", () => {
  it.each(["Lobby", "Play", "Done"])("routes the %s phase to its screen", (phase) => {
    const router = createAppRouter(client(phase).manager, screens);
    expect(router.screen).toEqual({ kind: "phase", phase });
  });

  it("waits for a phase it does not know", () => {
    const router = createAppRouter(client("Intermission").manager, screens);
    expect(router.screen).toEqual({ kind: "connecting" });
    const inherited = createAppRouter(client("toString").manager, screens);
    expect(inherited.screen).toEqual({ kind: "connecting" });
  });

  it("shows the welcome screen until connected", () => {
    const c = client();
    const router = createAppRouter(c.manager, screens);
    c.manager.status = "idle";
    expect(router.screen).toEqual({ kind: "welcome" });
    c.manager.status = "connecting";
    expect(router.screen).toEqual({ kind: "welcome" });
    c.manager.status = "disconnected";
    expect(router.screen).toEqual({ kind: "welcome" });
  });

  it("keeps the game on screen while reconnecting", () => {
    const c = client("Play");
    const router = createAppRouter(c.manager, screens);
    c.room.dropConnection();
    expect(router.isReconnecting).toBe(true);
    expect(router.screen).toEqual({ kind: "phase", phase: "Play" });
    c.room.reconnected();
    expect(router.isReconnecting).toBe(false);
  });

  it("sends an inactive seat to join-next-round, except in the lobby", () => {
    const c = client("Play", { isActive: false });
    const router = createAppRouter(c.manager, screens);
    expect(router.screen).toEqual({ kind: "join-next-round" });
    c.state.phase = "Lobby";
    expect(router.screen).toEqual({ kind: "phase", phase: "Lobby" });
  });

  it("shows a client without a seat the phase screens", () => {
    const c = client("Play");
    const router = createAppRouter(c.manager, screens);
    expect(router.isSpectator).toBe(false);
    c.state.players.delete(c.manager.playerId);
    expect(router.isSpectator).toBe(true);
    expect(router.screen).toEqual({ kind: "phase", phase: "Play" });
  });
});

describe("AppRouter", () => {
  it("keys the screen by phase, and by route outside the phases", () => {
    const c = client("Play");
    const router = createAppRouter(c.manager, screens);
    expect(router.screenKey).toBe("Play");
    c.state.phase = "Intermission";
    expect(router.screenKey).toBe("connecting");
    c.manager.status = "disconnected";
    expect(router.screenKey).toBe("welcome");
  });

  it("reads the banner from the table, empty without one and off the phases", () => {
    const c = client("Play");
    const router = createAppRouter(c.manager, screens);
    expect(router.banner).toBe("GO!");
    c.state.phase = "Done";
    expect(router.banner).toBe("");
    c.state.phase = "Intermission";
    expect(router.banner).toBe("");
    c.manager.status = "disconnected";
    expect(router.banner).toBe("");
  });

  it("reports the phase and room code, defaulting to the lobby when not in a room", () => {
    const c = client("Done");
    const router = createAppRouter(c.manager, screens);
    expect(router.phase).toBe("Done");
    expect(router.roomCode).toBe("ABCD");
    c.manager.dispose();
    expect(router.phase).toBe("Lobby");
    expect(router.roomCode).toBe("");
  });

  it("exposes the last server error until dismissed", () => {
    const c = client();
    const router = createAppRouter(c.manager, screens);
    expect(router.error).toBeUndefined();
    c.room.push("ERROR", { code: ErrorCode.WRONG_PHASE, message: "Not now" });
    expect(router.error?.message).toBe("Not now");
    router.dismissError();
    expect(router.error).toBeUndefined();
  });

  it("is what createAppRouter returns, and a subclass can override the banner", () => {
    const c = client("Play");
    expect(createAppRouter(c.manager, screens)).toBeInstanceOf(AppRouter);

    class Quiet extends AppRouter<BaseGameState, typeof screens> {
      override get banner(): string {
        return this.manager.state?.phase === "Play" ? "" : super.banner;
      }
    }
    expect(new Quiet(c.manager, screens).banner).toBe("");
  });
});
