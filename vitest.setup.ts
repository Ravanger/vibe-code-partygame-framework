import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock fs for @colyseus/tools which tries to use fs.existsSync in Bun environment
// where fs module isn't available in nested node_modules
vi.mock("fs", () => ({
  default: {
    existsSync: () => false,
  },
  existsSync: () => false,
}));

// Mock @colyseus/tools to avoid require() in ESM issues with Bun
vi.mock("@colyseus/tools", () => ({
  default: {},
  listen: () => {
    throw new Error("unused in tests");
  },
}));

// Setup Testing Library matchers
// The vitest import above already extends expect with jest-dom matchers
