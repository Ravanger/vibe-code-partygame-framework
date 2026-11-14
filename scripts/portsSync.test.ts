import { describe, expect, it } from "vitest";
import { resolveEndpoints } from "../packages/game-client/src/urls.js";
import { DEFAULT_PORTS } from "../packages/launcher/src/ports.js";
import { DEFAULT_API_PORT, DEFAULT_ENDPOINT } from "../packages/terminal/src/args.js";

// The launcher owns the port defaults; these copies cannot import it (package boundaries), so they are pinned equal here.
describe("port default copies stay in sync with DEFAULT_PORTS", () => {
  it("keeps the terminal endpoint and API port on the launcher ports", () => {
    expect(DEFAULT_ENDPOINT).toBe(`ws://localhost:${DEFAULT_PORTS.game}`);
    expect(DEFAULT_API_PORT).toBe(DEFAULT_PORTS.api);
  });

  it("keeps the browser client's endpoint defaults on the launcher ports", () => {
    const resolved = resolveEndpoints({}, "example.com");
    expect(resolved.endpoint).toBe(`http://example.com:${DEFAULT_PORTS.game}`);
    expect(resolved.apiPort).toBe(DEFAULT_PORTS.api);
  });
});
