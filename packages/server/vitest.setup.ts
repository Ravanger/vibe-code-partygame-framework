import { vi } from "vitest";

// Mock @colyseus/tools to avoid require() in ESM issues with Bun
// Use vi.mock at top level for hoisting
vi.mock("@colyseus/tools", () => ({
  default: {},
}));

// Mock fs for any tests that might need it
vi.mock("fs", () => ({
  default: {
    existsSync: () => false,
  },
  existsSync: () => false,
}));

// Also mock @colyseus/schema decorators to avoid issues
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
