# Testing Library Documentation

> **Packages:** `@testing-library/svelte@^5.3.1`, `@testing-library/jest-dom@^6.9.1`, `@testing-library/user-event@^14.6.1`

## Overview

Testing Library is a family of packages for testing user interfaces by simulating real user interactions. In the `vibe-coded` party game framework, Testing Library provides the foundation for testing Svelte 5 components, DOM interactions, and user event simulations across the client packages and games.

The project uses three complementary Testing Library packages:
- **`@testing-library/svelte`**: Svelte-specific rendering and queries for Svelte 5 (Runes)
- **`@testing-library/jest-dom`**: Custom Jest matchers for DOM assertions
- **`@testing-library/user-event`**: Realistic user event simulation (clicks, typing, etc.)

## Packages

### @testing-library/svelte

> **Version:** v5.3.1
> **Package:** `@testing-library/svelte@^5.3.1`

Svelte-specific utilities for rendering Svelte components and querying the DOM. Fully compatible with Svelte 5's Runes system.

#### Key Features

- **Svelte 5 Runes Support**: Works with `$state`, `$derived`, `$effect`, and other Runes
- **Automatic Cleanup**: Removes rendered components after tests
- **Queries**: `getBy*`, `findBy*`, `queryBy*` for accessing DOM elements
- **Debugging**: Built-in `screen.debug()` for inspecting rendered output

#### Installation

```bash
# Using Bun (recommended)
bun add -D @testing-library/svelte

# Using npm
npm install -D @testing-library/svelte
```

#### Common Methods

| Method | Description |
|--------|-------------|
| `render(component, options?)` | Renders a Svelte component into a container |
| `screen.getByRole(role, options?)` | Query DOM by ARIA role |
| `screen.getByText(text, options?)` | Query DOM by text content |
| `screen.getByTestId(id)` | Query DOM by `data-testid` attribute |
| `screen.debug()` | Log the current DOM to console |

#### Usage Example

```typescript
import { render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import Counter from "./Counter.svelte";

test("increments counter on button click", async () => {
  render(Counter);
  
  const button = screen.getByRole("button", { name: /increment/i });
  await userEvent.click(button);
  
  expect(screen.getByText("Count: 1")).toBeInTheDocument();
});
```

### @testing-library/jest-dom

> **Version:** v6.9.1
> **Package:** `@testing-library/jest-dom@^6.9.1`

Provides custom Jest matchers for asserting DOM element states, extending Jest's expect API with DOM-specific assertions.

#### Key Features

- **Custom Matchers**: `toBeInTheDocument()`, `toHaveClass()`, `toBeVisible()`, etc.
- **Vitest Support**: Works seamlessly with Vitest (the project's test runner)
- **Automatic Setup**: Import once in setup file for global availability

#### Installation

```bash
# Using Bun (recommended)
bun add -D @testing-library/jest-dom

# Using npm
npm install -D @testing-library/jest-dom
```

#### Setup

**`tests/setup.ts` or `vitest.setup.ts`:**
```typescript
import "@testing-library/jest-dom/vitest";
```

Include the setup file in your Vitest configuration:

**`vitest.config.ts`:**
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
    // ...
  },
});
```

#### Common Matchers

| Matcher | Description |
|---------|-------------|
| `toBeInTheDocument()` | Assert element is in the DOM |
| `toHaveTextContent(text)` | Assert element contains text |
| `toHaveClass(className)` | Assert element has CSS class |
| `toBeVisible()` | Assert element is visible |
| `toBeDisabled()` | Assert element is disabled |
| `toHaveAttribute(name, value)` | Assert element has attribute |

#### Usage Example

```typescript
import { expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import Button from "./Button.svelte";

test("button is disabled when loading", () => {
  render(Button, { props: { loading: true } });
  
  const button = screen.getByRole("button");
  
  expect(button).toBeDisabled();
  expect(button).toHaveClass("loading");
});
```

### @testing-library/user-event

> **Version:** v14.6.1
> **Package:** `@testing-library/user-event@^14.6.1`

Simulates real user interactions with DOM elements, providing more realistic testing than direct DOM manipulation. Events are dispatched as they would be in a real browser.

#### Key Features

- **Realistic Events**: Simulates browser-native events (click, keyboard, pointer, etc.)
- **Async API**: All interactions are async to match real user behavior
- **Compound Actions**: Supports drag-and-drop, copy-paste, and other complex interactions
- **Concurrency Safe**: Multiple users can interact simultaneously

#### Installation

```bash
# Using Bun (recommended)
bun add -D @testing-library/user-event

# Using npm
npm install -D @testing-library/user-event
```

#### Common Methods

| Method | Description |
|--------|-------------|
| `userEvent.click(element)` | Simulate mouse click |
| `userEvent.dblClick(element)` | Simulate double click |
| `userEvent.type(element, text)` | Simulate typing text |
| `userEvent.keyboard(text)` | Simulate keyboard input |
| `userEvent.hover(element)` | Simulate mouse hover |
| `userEvent.tab()` | Simulate Tab key navigation |
| `userEvent.copy()` | Simulate copy to clipboard |
| `userEvent.paste()` | Simulate paste from clipboard |

#### Usage Example

```typescript
import { render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import Form from "./Form.svelte";

test("submits form with user input", async () => {
  render(Form);
  
  const user = userEvent.setup();
  
  const nameInput = screen.getByLabelText(/name/i);
  const submitButton = screen.getByRole("button", { name: /submit/i });
  
  await user.type(nameInput, "Test User");
  await user.click(submitButton);
  
  expect(screen.getByText(/submitted/i)).toBeInTheDocument();
});
```

## Best Practices in This Project

- **Use `@testing-library/svelte` for all Svelte component tests.** Prefer it over directly manipulating component instances.
- **Use `userEvent` for interaction tests.** Avoid fireEvent from `@testing-library/dom` for user-triggered actions.
- **Import jest-dom matchers in setup files.** This makes matchers available globally without repeating imports.
- **Test user-facing behavior, not implementation details.** Focus on what users see and do, not internal component state.
- **Use `data-testid` sparingly.** Prefer semantic queries (`getByRole`, `getByLabelText`) but use `data-testid` when necessary.
- **Clean up after tests.** Testing Library automatically cleans up, but ensure any custom resources are also cleaned.

## Project Integration

### Example: Wit-Clash Game Tests

**`games/wit-clash/tests/App.test.ts`:**
```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import App from "../src/App.svelte";

describe("App", () => {
  it("shows game title", () => {
    render(App);
    expect(screen.getByText("Wit Clash")).toBeInTheDocument();
  });

  it("allows player to join game", async () => {
    render(App);
    const user = userEvent.setup();
    
    const nameInput = screen.getByLabelText(/player name/i);
    const joinButton = screen.getByRole("button", { name: /join/i });
    
    await user.type(nameInput, "Alice");
    await user.click(joinButton);
    
    await expect(screen.findByText(/lobby/i)).resolves.toBeInTheDocument();
  });
});
```

**`games/wit-clash/tests/setup.ts`:**
```typescript
import "@testing-library/jest-dom/vitest";
```

**`games/wit-clash/vitest.config.ts`:**
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
});
```

## References

- [Testing Library Docs](https://testing-library.com)
- [@testing-library/svelte](https://testing-library.com/docs/svelte-testing-library/main)
- [@testing-library/jest-dom](https://testing-library.com/docs/ecosystem-jest-dom/)
- [@testing-library/user-event](https://testing-library.com/docs/user-event/intro/)
- [Svelte Testing Library](https://github.com/testing-library/testing-library-svelte)
