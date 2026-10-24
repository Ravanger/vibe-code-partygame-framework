import { afterEach, describe, expect, it, vi } from "vitest";
import { joinUrl, RoomCodeError, resolveRoomCode, tvUrl, waitFor } from "../src/index.js";

afterEach(() => vi.unstubAllGlobals());

describe("share links", () => {
  it("appends the code as ?code= and ?tv=", () => {
    expect(joinUrl("http://host:5173/", "ABCD")).toBe("http://host:5173/?code=ABCD");
    expect(tvUrl("http://host:5173/", "ABCD")).toBe("http://host:5173/?tv=ABCD");
  });

  it("encodes the code in both links", () => {
    expect(joinUrl("http://host:5173/", "AB&x=")).toBe("http://host:5173/?code=AB%26x%3D");
    expect(tvUrl("http://host:5173/", "AB&x=")).toBe("http://host:5173/?tv=AB%26x%3D");
  });
});

describe("resolveRoomCode", () => {
  function reply(body: unknown) {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body)));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("asks the API and returns the room id", async () => {
    const fetchMock = reply({ roomId: "r1" });
    await expect(resolveRoomCode("http://h:3001", "ABCD")).resolves.toBe("r1");
    expect(fetchMock).toHaveBeenCalledWith("http://h:3001/api/resolve-code?code=ABCD");
  });

  it("throws the API's error", async () => {
    reply({ error: "No such room" });
    await expect(resolveRoomCode("http://h:3001", "ABCD")).rejects.toThrow("No such room");
  });

  it("tells a missing room from a malformed reply by a typed reason", async () => {
    reply({ error: "No such room" });
    await expect(resolveRoomCode("http://h:3001", "ABCD")).rejects.toMatchObject({
      name: "RoomCodeError",
      reason: "not-found",
    });
    reply({ nope: true });
    const error = await resolveRoomCode("http://h:3001", "ABCD").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RoomCodeError);
    expect(error).toMatchObject({ reason: "bad-reply" });
  });

  it("throws on a reply of the wrong shape", async () => {
    reply({ nope: true });
    await expect(resolveRoomCode("http://h:3001", "ABCD")).rejects.toThrow(
      "Unexpected reply from the game server",
    );
  });

  it("rejects an invalid code without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(resolveRoomCode("http://h:3001", "AB&x=")).rejects.toThrow("Invalid room code");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-2xx reply with its status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "boom" }), { status: 500 })),
    );
    await expect(resolveRoomCode("http://h:3001", "ABCD")).rejects.toThrow(
      "The game server answered 500",
    );
  });

  it("keeps the API's reason on a 404 JSON reply", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ error: "Game code not found" }), { status: 404 }),
      ),
    );
    await expect(resolveRoomCode("http://h:3001", "ABCD")).rejects.toMatchObject({
      name: "RoomCodeError",
      reason: "not-found",
      message: "Game code not found",
    });
  });

  it("reports the status when a 404 reply is not a JSON error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>nope</html>", { status: 404 })),
    );
    await expect(resolveRoomCode("http://h:3001", "ABCD")).rejects.toThrow(
      "The game server answered 404",
    );
  });

  it("reports the status when a 404 reply carries no error text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ roomId: "r1" }), { status: 404 })),
    );
    await expect(resolveRoomCode("http://h:3001", "ABCD")).rejects.toThrow(
      "The game server answered 404",
    );
  });

  it("rejects a non-JSON reply as a bad reply, not a SyntaxError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>oops</html>")),
    );
    await expect(resolveRoomCode("http://h:3001", "ABCD")).rejects.toMatchObject({
      name: "RoomCodeError",
      reason: "bad-reply",
      message: "Unexpected reply from the game server",
    });
  });

  it("rejects a network failure with a safe message", async () => {
    const fail = async (): Promise<never> => {
      throw new TypeError("fetch failed");
    };
    vi.stubGlobal("fetch", fail);
    await expect(resolveRoomCode("http://h:3001", "ABCD")).rejects.toThrow(
      "Could not reach the game server",
    );
  });
});

describe("waitFor", () => {
  it("resolves once the predicate holds", async () => {
    let n = 0;
    await waitFor(() => ++n > 2, "three polls", 1000, 1);
    expect(n).toBe(3);
  });

  it("stops at once when the predicate throws", async () => {
    const stop = () => {
      throw new Error("gone");
    };
    await expect(waitFor(stop, "anything", 1000, 1)).rejects.toThrow("gone");
  });

  it("throws naming what it waited for", async () => {
    await expect(waitFor(() => false, "never", 20, 5)).rejects.toThrow(
      "Timed out waiting for never",
    );
  });
});
