# JSDOM Documentation

> **Version:** v29.0.2
> **Package:** `jsdom@^29.0.2`
> **Related:** `@types/jsdom@^28.0.1`

## Overview

JSDOM is a pure-JavaScript implementation of the DOM and HTML standards for use in Node.js. In the `vibe-coded` party game framework, JSDOM provides a browser-like environment for testing client-side code without requiring a real browser, enabling fast, headless testing of Svelte components and client logic.

JSDOM is used as the test environment for Vitest when running client-side tests in `packages/client` and `games/wit-clash`, allowing tests to run DOM operations, manipulate elements, and trigger events as if running in a real browser.

## Key Concepts

| Concept | Description |
|---------|-------------|
| **DOM Implementation** | Full implementation of the W3C DOM API (Level 2 and partially Level 3) |
| **HTML Parsing** | Parses HTML strings into a DOM tree structure |
| **CSS Support** | Basic CSS selector and style support |
| **Navigation** | Simulates browser navigation (URL changes, history) |
| **Event System** | Full event dispatch and bubbling implementation |
| **Form Handling** | Form submission, validation, and serialization |

## Environment Configuration

### In Vitest

JSDOM is configured as the test environment in Vitest configurations across the project.

**Basic Configuration:**
```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

### JSDOM Options

Vitest allows customization of JSDOM through the `environmentOptions` property:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    environmentOptions: {
      // JSDOM-specific options
      jsdom: {
        url: "http://localhost/",
        referrer: "http://localhost/",
        contentType: "text/html",
        includeNodeLocations: false,
        storageQuota: 10000000,
      },
    },
  },
});
```

## Common JSDOM Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | `http://localhost/` | The URL the page is at |
| `referrer` | `string` | `about:blank` | The page's referrer |
| `contentType` | `string` | `text/html` | Content-Type header for navigation |
| `userAgent` | `string` | JSDOM default | User-Agent string |
| `includeNodeLocations` | `boolean` | `false` | Include source locations in error stacks |
| `storageQuota` | `number` | 5,000,000 | LocalStorage quota in bytes |

## Installation

```bash
# Using Bun (recommended)
bun add -D jsdom @types/jsdom

# Using npm
npm install -D jsdom @types/jsdom

# Using pnpm
pnpm add -D jsdom @types/jsdom

# Using Yarn
yarn add -D jsdom @types/jsdom
```

## Basic Usage

### No Configuration Needed

In most cases, simply setting `environment: "jsdom"` in Vitest is sufficient:

```typescript
// my-component.test.ts
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import MyComponent from "./MyComponent.svelte";

describe("MyComponent", () => {
  it("renders correctly", () => {
    render(MyComponent);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

### Accessing Global Browser APIs

JSDOM provides all standard browser globals:

```typescript
test("uses browser globals", () => {
  // Window
  expect(window.location.href).toBe("http://localhost/");
  
  // Document
  const element = document.createElement("div");
  expect(element).toBeInstanceOf(HTMLElement);
  
  // Navigator
  expect(navigator.userAgent).toContain("jsdom");
  
  // LocalStorage
  localStorage.setItem("test", "value");
  expect(localStorage.getItem("test")).toBe("value");
});
```

### Handling URLs

```typescript
test("navigates programmatically", () => {
  // Get current URL
  expect(window.location.href).toBe("http://localhost/");
  
  // Navigate
  window.location.href = "http://localhost/game";
  expect(window.location.pathname).toBe("/game");
  
  // Use History API
  window.history.pushState({}, "", "/lobby");
  expect(window.location.pathname).toBe("/lobby");
});
```

## Best Practices in This Project

- **Use JSDOM for client-side component tests.** All Svelte component tests in `packages/client` and games should use JSDOM environment.
- **Prefer Testing Library over direct DOM access.** Use `@testing-library/svelte` for querying and interacting with components.
- **Keep tests isolated.** Each test gets its own fresh JSDOM instance; no need to manually clean up the DOM.
- **Mock external resources.** Use Vitest's mocking capabilities for API calls and other external dependencies.
- **Set meaningful URLs.** Configure `url` in environment options when tests depend on location-based behavior.

## Project Integration

### Wit-Clash Configuration

**`games/wit-clash/vitest.config.ts`:**
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
  },
});
```

### Client Package Configuration

**`packages/client/vitest.config.ts`:**
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
```

## Limitations

JSDOM simulates a browser environment but has some differences from real browsers:

- **No Visual Rendering**: Cannot render or measure elements
- **No Layout Engine**: Computed styles are not pixel-perfect
- **No Image Loading**: Images don't actually load
- **No Audio/Video**: Media elements don't play
- **Limited CSS**: Some CSS features may not be implemented
- **No Graphics**: Canvas, WebGL not fully supported

For tests that require these features, consider using browser-based testing with `@vitest/browser`.

## Troubleshooting

### Type Errors with DOM APIs

**Symptom:** TypeScript errors for DOM APIs like `window`, `document`.
**Solution:** Ensure `@types/jsdom` is installed as a dev dependency.

### Missing Browser Features

**Symptom:** Tests fail because a browser API is not implemented.
**Solution:** Check if the feature is in JSDOM's [implementation status](https://github.com/jsdom/jsdom#implementation-status). Mock or polyfill as needed.

### Memory Leaks

**Symptom:** Tests run slowly or crash with memory errors.
**Solution:** Each Vitest test gets its own JSDOM instance, but ensure your code doesn't hold references to DOM nodes across tests.

## References

- [GitHub Repository](https://github.com/jsdom/jsdom)
- [API Documentation](https://github.com/jsdom/jsdom#api)
- [Implementation Status](https://github.com/jsdom/jsdom#implementation-status)
- [Changelog](https://github.com/jsdom/jsdom/blob/main/Changelog.md)
