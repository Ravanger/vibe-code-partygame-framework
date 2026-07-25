import { vi } from "vitest";

// Mock @colyseus/tools to avoid require() in ESM issues with Bun
vi.mock("@colyseus/tools", () => ({
  default: {},
  listen: () => {
    throw new Error("unused in tests");
  },
}));

// Mock fs for any tests that might need it
vi.mock("fs", () => ({
  default: {
    existsSync: () => false,
  },
  existsSync: () => false,
}));
