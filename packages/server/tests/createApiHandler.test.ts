import { describe, expect, it } from "vitest";
import { createApiHandler } from "../src/api/createApiHandler.js";
import { RateLimiter } from "../src/RateLimiter.js";
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

  describe("resolve-code throttle", () => {
    const ask = (handler: ReturnType<typeof createApiHandler>, remoteAddress?: string): Response =>
      handler(new Request("http://x/api/resolve-code?code=ABCD"), {
        ...(remoteAddress !== undefined ? { remoteAddress } : {}),
      });

    it("allows the burst and then answers 429 with Retry-After", async () => {
      const limiter = new RateLimiter({ clock: () => 0 });
      const throttled = createApiHandler(codes, { limiter });
      for (let i = 0; i < 10; ++i) expect(ask(throttled, "10.0.0.1").status).toBe(200);
      const refused = ask(throttled, "10.0.0.1");
      expect(refused.status).toBe(429);
      expect(await refused.json()).toEqual({ error: "Too many requests" });
      expect(refused.headers.get("Retry-After")).toBe("1"); // default 1/s -> the next token in one second
    });

    it("throttles per remote address", () => {
      const limiter = new RateLimiter({ clock: () => 0 });
      const throttled = createApiHandler(codes, { limiter });
      for (let i = 0; i < 10; ++i) ask(throttled, "10.0.0.1");
      expect(ask(throttled, "10.0.0.1").status).toBe(429);
      expect(ask(throttled, "10.0.0.2").status).toBe(200); // a different address has its own bucket
    });

    it("refills as the clock advances", () => {
      let now = 0;
      const limiter = new RateLimiter({ clock: () => now });
      const throttled = createApiHandler(codes, { limiter });
      for (let i = 0; i < 10; ++i) ask(throttled, "10.0.0.1");
      expect(ask(throttled, "10.0.0.1").status).toBe(429);
      now += 1_000; // one token at the default 1/s
      expect(ask(throttled, "10.0.0.1").status).toBe(200);
    });

    it("never refuses in observe mode and reports the address", () => {
      const seen: string[] = [];
      const limiter = new RateLimiter({
        clock: () => 0,
        mode: "observe",
        onObserve: (key) => {
          seen.push(key);
        },
      });
      const throttled = createApiHandler(codes, { limiter });
      for (let i = 0; i < 11; ++i) expect(ask(throttled, "10.0.0.1").status).toBe(200);
      expect(seen).toEqual(["10.0.0.1"]);
    });

    it("buckets requests without a remote address under one shared key", () => {
      const limiter = new RateLimiter({ clock: () => 0 });
      const throttled = createApiHandler(codes, { limiter, resolveCode: { rate: 0, burst: 2 } });
      expect(ask(throttled).status).toBe(200);
      expect(ask(throttled).status).toBe(200);
      expect(ask(throttled).status).toBe(429); // the third addressless request shares their bucket
      expect(ask(throttled, "10.0.0.1").status).toBe(200); // an addressed caller still gets a fresh bucket
    });

    it("answers 429 with Retry-After 1 when the bucket never refills", () => {
      const limiter = new RateLimiter({ clock: () => 0 });
      const throttled = createApiHandler(codes, { limiter, resolveCode: { rate: 0, burst: 1 } });
      expect(ask(throttled, "10.0.0.1").status).toBe(200);
      const refused = ask(throttled, "10.0.0.1");
      expect(refused.status).toBe(429);
      expect(refused.headers.get("Retry-After")).toBe("1");
    });

    it("carries the allowed origin's CORS headers on the refusal", () => {
      const limiter = new RateLimiter({ clock: () => 0 });
      const throttled = createApiHandler(codes, { limiter });
      for (let i = 0; i < 10; ++i) ask(throttled, "10.0.0.1");
      const refused = throttled(
        new Request("http://x/api/resolve-code?code=ABCD", {
          headers: { Origin: "http://localhost:5173" },
        }),
        { remoteAddress: "10.0.0.1" },
      );
      expect(refused.status).toBe(429);
      expect(refused.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
      expect(refused.headers.get("Vary")).toBe("Origin");
    });
  });
});
