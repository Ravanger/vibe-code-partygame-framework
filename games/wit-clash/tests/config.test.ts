import { describe, expect, it, vi } from "vitest";
import { resolveEndpoints } from "../ui/config.js";

describe("resolveEndpoints", () => {
  it("uses the current hostname so LAN devices reach the right machine", () => {
    vi.stubGlobal("window", { location: { hostname: "192.168.1.50" } });
    expect(resolveEndpoints()).toEqual({ endpoint: "http://192.168.1.50:2567", apiPort: 3001 });
  });

  it("works on localhost", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    expect(resolveEndpoints().endpoint).toBe("http://localhost:2567");
  });
});
