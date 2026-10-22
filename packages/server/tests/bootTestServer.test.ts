import { describe, expect, it } from "vitest";
import { bootBuzzer } from "./support.js";

describe("bootTestServer", () => {
  it("refuses a second live server until the first is shut down", async () => {
    const first = await bootBuzzer();
    try {
      await expect(bootBuzzer()).rejects.toThrow(
        "bootTestServer: only one test server may be live per process; call shutdown() first",
      );
    } finally {
      await first.shutdown();
    }
    const second = await bootBuzzer();
    await second.shutdown();
  });
});
