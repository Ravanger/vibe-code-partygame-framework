import { describe, expect, it } from "vitest";
import { qrCode } from "../src/qr.js";

describe("qrCode", () => {
  it("draws the dark modules as horizontal runs on a square grid", () => {
    const { size, path } = qrCode("http://localhost/?code=ABCD");
    expect(size).toBe(27);
    expect(path).toMatch(/^M1 1h7v1h-7z/);
    expect(path).not.toMatch(/[^MhvzM\d\s-]/);
  });

  it("differs per link", () => {
    expect(qrCode("a").path).not.toBe(qrCode("b").path);
  });
});
