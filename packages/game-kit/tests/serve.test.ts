import { type NodeServerHandle, startNodeServer } from "@partygame/server/node";
import { freePort, ServerProbe } from "@partygame/server/probe";
import { describe, expect, it } from "vitest";
import { defineGamePackage, type GameKitIo, type ServeOptions, serve } from "../src/index.js";
import { fakeIo } from "./fixtures/fakeIo.js";
import { TAP_ROOM, TapGame, TapState, tapKit } from "./fixtures/tapGame.js";

const ioWith = (
  env: NodeJS.ProcessEnv,
  started: NodeServerHandle[],
  seens: ServeOptions[],
): GameKitIo =>
  fakeIo([], {
    env,
    startServer: async (options) => {
      seens.push(options);
      const handle = await startNodeServer(options);
      started.push(handle);
      return handle;
    },
  }).io;

describe("serve", () => {
  it("loads content and leaves the ports to the server starter", async () => {
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

    await serve(game, ioWith({ PORT: String(port), API_PORT: String(apiPort) }, started, seens));

    expect(seen).toEqual([`loaded:${port}`]);
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

    await serve(game, ioWith({}, started, seens));

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

  it("prints one line and exits 1 when load rejects", async () => {
    const game = defineGamePackage({
      meta: { roomName: TAP_ROOM, minPlayers: 2, maxPlayers: 6 },
      load: async () => {
        throw new Error("bad content");
      },
      definition: () => TapGame,
      stateClass: TapState,
      isFinished: () => true,
      botKit: tapKit(),
    });
    const { io, err, exits } = fakeIo([]);
    await serve(game, io);
    expect(err).toEqual(["bad content"]);
    expect(exits).toEqual([1]);
  });

  it("prints one line and exits 1 when the server cannot start", async () => {
    const game = defineGamePackage({
      meta: { roomName: TAP_ROOM, minPlayers: 2, maxPlayers: 6 },
      definition: () => TapGame,
      stateClass: TapState,
      isFinished: () => true,
      botKit: tapKit(),
    });
    const { io, err, exits } = fakeIo([], {
      startServer: () => Promise.reject(new Error("port taken")),
    });
    await serve(game, io);
    expect(err).toEqual(["port taken"]);
    expect(exits).toEqual([1]);
  });

  it("prints a thrown non-Error as text", async () => {
    const game = defineGamePackage({
      meta: { roomName: TAP_ROOM, minPlayers: 2, maxPlayers: 6 },
      definition: () => TapGame,
      stateClass: TapState,
      isFinished: () => true,
      botKit: tapKit(),
    });
    const { io, err } = fakeIo([], { startServer: () => Promise.reject("nope") });
    await serve(game, io);
    expect(err).toEqual(["nope"]);
  });
});
