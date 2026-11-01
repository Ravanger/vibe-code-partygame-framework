import { describe, expect, it } from "vitest";
import { apiBaseOf } from "../src/index.js";

describe("apiBaseOf", () => {
  it.each([
    ["ws://example.com:2567", "http://example.com:3001"],
    ["wss://example.com", "https://example.com:3001"],
    ["http://example.com:2567", "http://example.com:3001"],
    ["https://example.com:2567", "https://example.com:3001"],
  ])("maps %s to %s", (endpoint, expected) => {
    expect(apiBaseOf(endpoint, 3001)).toBe(expected);
  });
});
