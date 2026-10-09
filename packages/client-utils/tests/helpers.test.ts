import { afterEach, describe, expect, it, vi } from "vitest";
import { joinUrl, resolveRoomCode, tvUrl, waitFor } from "../src/index.js";

afterEach(() => vi.unstubAllGlobals());

describe("share links", () => {
  it("appends the code as ?code= and ?tv=", () => {
    expect(joinUrl("http://host:5173/", "ABCD")).toBe("http://host:5173/?code=ABCD");
    expect(tvUrl("http://host:5173/", "ABCD")).toBe("http://host:5173/?tv=ABCD");
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

  it("throws on a reply of the wrong shape", async () => {
    reply({ nope: true });
    await expect(resolveRoomCode("http://h:3001", "ABCD")).rejects.toThrow(
      "Unexpected reply from the game server",
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
