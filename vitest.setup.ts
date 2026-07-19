import "@testing-library/jest-dom/vitest";
import { Window } from "happy-dom";
import { vi } from "vitest";

// Fix Bun + Colyseus schema decorator incompatibility FIRST
// In Bun's ESM, the @type decorator from @colyseus/schema tries to access
// target.constructor during module initialization, but target is undefined.
// Use vi.mock at top level for hoisting
vi.mock("@colyseus/schema", async (importOriginal) => {
  const original = (await importOriginal()) as {
    Schema: unknown;
    ArraySchema: unknown;
    MapSchema: unknown;
    type: unknown;
  };

  // Patch the type decorator to avoid target.constructor access
  const mockType = (_spec: unknown) => {
    return (target: unknown, _propertyKey?: unknown) => {
      // No-op decorator - just return target
      return target;
    };
  };

  return {
    ...original,
    // Keep other exports intact
    Schema: original.Schema,
    ArraySchema: original.ArraySchema,
    MapSchema: original.MapSchema,
    // Replace the problematic decorator
    type: mockType,
  };
});

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
}));

// Setup Happy DOM for Bun environment
// Happy DOM is more compatible with Bun than jsdom
const window = new Window();
globalThis.window = window;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.HTMLBodyElement = window.HTMLBodyElement;
globalThis.HTMLDivElement = window.HTMLDivElement;

// Setup Testing Library matchers
// The vitest import above already extends expect with jest-dom matchers
