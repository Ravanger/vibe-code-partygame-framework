import { describe, expect, it } from "vitest";
import { createApiHandler } from "../src/api/createApiHandler.js";
import { RoomCodeService } from "../src/services/RoomCodeService.js";

const codes = new RoomCodeService();
codes.register("ABCD", "room-1");
const handle = createApiHandler(codes);
const call = (path: string, method = "GET", origin?: string) =>
  handle(new Request(`http://x${path}`, { method, headers: origin ? { Origin: origin } : {} }));

describe("createApiHandler", () => {
  it("resolves a registered code", async () => {
    const res = call("/api/resolve-code?code=ABCD");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ roomId: "room-1" });
    expect(res.headers.get("Content-Type")).toBe("application/json");
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
  });

  describe("origin allow-list", () => {
    it.each(["http://localhost:5173", "http://127.0.0.1:3000", "http://[::1]:8080"])(
      "allows loopback origin %s by default, echoing it with Vary: Origin",
      (origin) => {
        const res = call("/api/resolve-code?code=ABCD", "GET", origin);
        expect(res.status).toBe(200);
        expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
        expect(res.headers.get("Vary")).toBe("Origin");
      },
    );

    it("sends no CORS headers for a disallowed origin, but answers normally", async () => {
      const res = call("/api/resolve-code?code=ABCD", "GET", "http://evil.example.com:5173");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ roomId: "room-1" });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(res.headers.get("Vary")).toBeNull();
      expect(res.headers.get("Access-Control-Allow-Methods")).toBeNull();
    });

    it("sends no CORS headers when there is no Origin header", () => {
      const res = call("/api/resolve-code?code=ABCD");
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(res.headers.get("Vary")).toBeNull();
    });

    it("answers a preflight from an allowed origin with 204 and the echoed origin", () => {
      const res = call("/api/resolve-code", "OPTIONS", "http://localhost:5173");
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
      expect(res.headers.get("Vary")).toBe("Origin");
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
      expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
    });

    it("answers a preflight from a disallowed origin with 204 and no CORS headers", () => {
      const res = call("/api/resolve-code", "OPTIONS", "http://evil.example.com");
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(res.headers.get("Access-Control-Allow-Methods")).toBeNull();
    });

    it('sends * for any origin when allowedOrigins is "*"', () => {
      const open = createApiHandler(codes, { allowedOrigins: "*" });
      const res = open(
        new Request("http://x/api/resolve-code?code=ABCD", {
          headers: { Origin: "http://anywhere.example" },
        }),
      );
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("matches an explicit list exactly, including the port", () => {
      const listed = createApiHandler(codes, { allowedOrigins: ["http://party.example:5173"] });
      const ok = listed(
        new Request("http://x/api/resolve-code?code=ABCD", {
          headers: { Origin: "http://party.example:5173" },
        }),
      );
      expect(ok.headers.get("Access-Control-Allow-Origin")).toBe("http://party.example:5173");
      const otherPort = listed(
        new Request("http://x/api/resolve-code?code=ABCD", {
          headers: { Origin: "http://party.example:9999" },
        }),
      );
      expect(otherPort.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });
  });
});
