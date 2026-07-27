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

// Setup localStorage mock for jsdom environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Setup Testing Library matchers
// The vitest import above already extends expect with jest-dom matchers
