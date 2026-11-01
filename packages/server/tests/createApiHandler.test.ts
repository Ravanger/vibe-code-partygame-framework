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

    it("sends no allow headers for a disallowed origin, but still Vary: Origin", async () => {
      const res = call("/api/resolve-code?code=ABCD", "GET", "http://evil.example.com:5173");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ roomId: "room-1" });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
      // allow-list mode varies the response by Origin, so shared caches must not cross origins
      expect(res.headers.get("Vary")).toBe("Origin");
      expect(res.headers.get("Access-Control-Allow-Methods")).toBeNull();
    });

    it("sends Vary: Origin even when there is no Origin header", () => {
      const res = call("/api/resolve-code?code=ABCD");
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(res.headers.get("Vary")).toBe("Origin");
    });

    it("matches a :* pattern only against a port: digits, nothing else", () => {
      const res = call("/api/resolve-code?code=ABCD", "GET", "http://localhost:5173");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
      // a host that merely continues with letters is not a port
      const evil = call("/api/resolve-code?code=ABCD", "GET", "http://localhost:evil.example");
      expect(evil.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("answers a preflight from an allowed origin with 204 and the echoed origin", () => {
      const res = call("/api/resolve-code", "OPTIONS", "http://localhost:5173");
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
      expect(res.headers.get("Vary")).toBe("Origin");
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
      expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
    });

    it("answers a preflight from a disallowed origin with 204 and only Vary: Origin", () => {
      const res = call("/api/resolve-code", "OPTIONS", "http://evil.example.com");
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(res.headers.get("Vary")).toBe("Origin");
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
    const ask = (
      handler: ReturnType<typeof createApiHandler>,
      remoteAddress?: string,
      method = "GET",
    ): Response =>
      handler(new Request("http://x/api/resolve-code?code=ABCD", { method }), {
        ...(remoteAddress !== undefined ? { remoteAddress } : {}),
      });

    /** One request carrying an `X-Forwarded-For` header, as it arrives at the HTTP entries. */
    const viaProxy = (
      handler: ReturnType<typeof createApiHandler>,
      xff: string | undefined,
      remoteAddress?: string,
    ): Response => {
      const headers: Record<string, string> = {};
      if (xff !== undefined) headers["X-Forwarded-For"] = xff;
      const info = remoteAddress === undefined ? undefined : { remoteAddress };
      return handler(new Request("http://x/api/resolve-code?code=ABCD", { headers }), info);
    };

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

    it("does not spend the caller's budget on a preflight", () => {
      const limiter = new RateLimiter({ clock: () => 0 });
      const throttled = createApiHandler(codes, { limiter, resolveCode: { rate: 0, burst: 1 } });
      for (let i = 0; i < 3; ++i) expect(ask(throttled, "10.0.0.1", "OPTIONS").status).toBe(204);
      expect(ask(throttled, "10.0.0.1").status).toBe(200); // the whole burst is still intact
    });

    describe("trustProxy", () => {
      it("keys buckets by the last X-Forwarded-For hop behind one proxy address", () => {
        const limiter = new RateLimiter({ clock: () => 0 });
        const throttled = createApiHandler(codes, {
          limiter,
          resolveCode: { rate: 0, burst: 1 },
          trustProxy: true,
        });
        expect(viaProxy(throttled, "203.0.113.7", "10.0.0.1").status).toBe(200); // client A
        expect(viaProxy(throttled, "203.0.113.8", "10.0.0.1").status).toBe(200); // client B: same socket, own bucket
        expect(viaProxy(throttled, "203.0.113.7", "10.0.0.1").status).toBe(429); // A's bucket is spent
      });

      it("uses the last hop of a multi-hop chain, not the client-claimed first one", () => {
        const limiter = new RateLimiter({ clock: () => 0 });
        const throttled = createApiHandler(codes, {
          limiter,
          resolveCode: { rate: 0, burst: 1 },
          trustProxy: true,
        });
        expect(viaProxy(throttled, "spoofed.example, 203.0.113.9", "10.0.0.1").status).toBe(200);
      });

      it("ignores X-Forwarded-For when trustProxy is off", () => {
        const limiter = new RateLimiter({ clock: () => 0 });
        const plain = createApiHandler(codes, { limiter, resolveCode: { rate: 0, burst: 1 } });
        expect(viaProxy(plain, "203.0.113.7", "10.0.0.1").status).toBe(200);
        expect(viaProxy(plain, "203.0.113.8", "10.0.0.1").status).toBe(429); // the header changes nothing
      });

      it("falls back to the socket address when no X-Forwarded-For arrives", () => {
        const limiter = new RateLimiter({ clock: () => 0 });
        const throttled = createApiHandler(codes, {
          limiter,
          resolveCode: { rate: 0, burst: 1 },
          trustProxy: true,
        });
        expect(viaProxy(throttled, undefined, "10.0.0.5").status).toBe(200);
        expect(viaProxy(throttled, undefined, "10.0.0.5").status).toBe(429); // same socket -> same bucket
      });

      it("falls back to the socket address when X-Forwarded-For is blank", () => {
        const limiter = new RateLimiter({ clock: () => 0 });
        const throttled = createApiHandler(codes, {
          limiter,
          resolveCode: { rate: 0, burst: 1 },
          trustProxy: true,
        });
        expect(viaProxy(throttled, " , ", "10.0.0.6").status).toBe(200);
        expect(viaProxy(throttled, undefined, "10.0.0.6").status).toBe(429); // the blank header keyed on the socket too
      });
    });
  });
});
