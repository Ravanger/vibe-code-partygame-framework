import { BaseGameState } from "@partygame/shared/schema";
import { describe, expect, it } from "vitest";
import { bootTestServer, waitUntil } from "../src/testing/index.js";
import { PlainGame } from "./fixtures/buzzer.js";

describe("waitUntil", () => {
  it("resolves once the predicate holds", async () => {
    let ready = false;
    setTimeout(() => {
      ready = true;
    }, 30);
    await waitUntil(() => ready, "ready");
  });

  it("rejects with the label on timeout", async () => {
    await expect(waitUntil(() => false, "never", 30, 5)).rejects.toThrow(
      "Timed out waiting for never",
    );
  });
});

describe("TestServer.serveApi", () => {
  it("serves the code-resolution API for the booted rooms and stops on shutdown", async () => {
    const t = await bootTestServer({
      games: [{ roomName: "plain", definition: PlainGame, stateClass: BaseGameState }],
    });
    const room = await t.createRoom("plain");
    const port = await t.serveApi();
    expect(t.endpoint).toBe(`ws://127.0.0.1:${t.sdk.settings.port}`);
    const code = (room.state as BaseGameState).roomCode;
    const found = await fetch(`http://127.0.0.1:${port}/api/resolve-code?code=${code}`);
    expect(await found.json()).toEqual({ roomId: room.roomId });
    const missing = await fetch(`http://127.0.0.1:${port}/api/resolve-code?code=ZZZZ`);
    expect(missing.status).toBe(404);
    await t.shutdown();
    await expect(fetch(`http://127.0.0.1:${port}/api/resolve-code?code=${code}`)).rejects.toThrow();
  });
});
