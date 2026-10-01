import { describe, expect, it } from "vitest";
import { createApiHandler } from "../src/api/createApiHandler.js";
import { RoomCodeService } from "../src/services/RoomCodeService.js";

const codes = new RoomCodeService();
codes.register("ABCD", "room-1");
const handle = createApiHandler(codes);
const call = (path: string, method = "GET") => handle(new Request(`http://x${path}`, { method }));

describe("createApiHandler", () => {
  it("resolves a registered code", async () => {
    const res = call("/api/resolve-code?code=ABCD");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ roomId: "room-1" });
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("404s an unknown code", async () => {
    const res = call("/api/resolve-code?code=ZZZZ");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Game code not found" });
  });

  it.each(["", "?code=abcd", "?code=ABC", "?code=ABCDE", "?code=AB1D"])(
    "400s the query %j",
    async (query) => {
      const res = call(`/api/resolve-code${query}`);
      expect(res.status).toBe(400);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    },
  );

  it("405s other methods on the route", async () => {
    const res = call("/api/resolve-code?code=ABCD", "POST");
    expect(res.status).toBe(405);
    expect(await res.json()).toEqual({ error: "Method not allowed" });
  });

  it("404s other paths", async () => {
    const res = call("/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("answers CORS preflight with 204", () => {
    const res = call("/api/resolve-code", "OPTIONS");
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
  });
});
