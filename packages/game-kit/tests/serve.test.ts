import { type NodeServerHandle, startNodeServer } from "@partygame/server/node";
import { freePort, ServerProbe } from "@partygame/server/probe";
import { describe, expect, it } from "vitest";
import { defineGamePackage, type GameKitIo, type ServeOptions, serve } from "../src/index.js";
import { TAP_ROOM, TapGame, TapState, tapKit } from "./fixtures/tapGame.js";

const ioWith = (
  env: NodeJS.ProcessEnv,
  started: NodeServerHandle[],
  seens: ServeOptions[],
): GameKitIo => ({
  env,
  argv: [],
  exit: () => {},
  log: () => {},
  error: () => {},
  startServer: async (options) => {
    seens.push(options);
    const handle = await startNodeServer(options);
    started.push(handle);
    return handle;
  },
});

describe("serve", () => {
  it("loads content and starts a server on the env ports", async () => {
    const port = await freePort();
    const apiPort = await freePort();
    const started: NodeServerHandle[] = [];
    const seens: ServeOptions[] = [];
    const seen: unknown[] = [];
    const game = defineGamePackage({
      meta: { roomName: TAP_ROOM, minPlayers: 2, maxPlayers: 6 },
      load: async (env) => `loaded:${env.PORT}`,
      definition: (content: string | undefined) => {
        seen.push(content);
        return TapGame;
      },
      stateClass: TapState,
      isFinished: () => true,
      botKit: tapKit(),
    });

    await serve(
      game,
      { gameDir: "/nonexistent" },
      ioWith({ PORT: String(port), API_PORT: String(apiPort) }, started, seens),
    );

    expect(seen).toEqual([`loaded:${port}`]);
    expect(started).toHaveLength(1);
    const [handle] = started;
    if (handle === undefined) throw new Error("the server starter never ran");
    expect(await new ServerProbe().isGameServer(handle.port, handle.apiPort)).toBe(true);
    await handle.stop();

    expect(seens).toHaveLength(1);
    const [options] = seens;
    if (options === undefined) throw new Error("the server starter never ran");
    expect(options.port).toBe(port);
    expect(options.apiPort).toBe(apiPort);
    expect(options.games.map((each) => each.roomName)).toEqual([TAP_ROOM]);
  });

  it("calls definition with undefined and lets the starter pick ports when env has none", async () => {
    const started: NodeServerHandle[] = [];
    const seens: ServeOptions[] = [];
    const seen: unknown[] = [];
    const game = defineGamePackage({
      meta: { roomName: TAP_ROOM, minPlayers: 2, maxPlayers: 6 },
      definition: (content: undefined) => {
        seen.push(content);
        return TapGame;
      },
      stateClass: TapState,
      isFinished: () => true,
      botKit: tapKit(),
    });

    await serve(game, { gameDir: "/nonexistent" }, ioWith({}, started, seens));

    expect(seen).toEqual([undefined]);
    expect(started).toHaveLength(1);
    const [handle] = started;
    if (handle === undefined) throw new Error("the server starter never ran");
    expect(await new ServerProbe().isGameServer(handle.port, handle.apiPort)).toBe(true);
    await handle.stop();

    expect(seens).toHaveLength(1);
    const [options] = seens;
    if (options === undefined) throw new Error("the server starter never ran");
    expect(options.port).toBeUndefined();
    expect(options.apiPort).toBeUndefined();
    expect(options.games.map((each) => each.roomName)).toEqual([TAP_ROOM]);
  });
});
