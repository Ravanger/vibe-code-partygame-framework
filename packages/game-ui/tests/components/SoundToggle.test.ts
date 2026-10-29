import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { SoundToggle } from "../../src/components/index.js";
import { SoundPolicy, type SoundStorage } from "../../src/SoundPolicy.svelte.js";

const memoryStorage = (): SoundStorage => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
};

const policy = () =>
  new SoundPolicy({ storage: memoryStorage(), storagePrefix: "g", target: window });

describe("SoundToggle", () => {
  it("is a native button (keyboard operable) with aria-pressed and the off label", () => {
    render(SoundToggle, { policy: policy() });
    const button = screen.getByRole("button");
    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveTextContent("Sound off");
  });

  it("toggles the policy and its label on click", () => {
    const p = policy();
    render(SoundToggle, { policy: p });
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(p.enabled).toBe(true);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("Sound on");
    fireEvent.click(button);
    expect(p.enabled).toBe(false);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveTextContent("Sound off");
  });

  it("uses the given labels", () => {
    render(SoundToggle, { policy: policy(), on: "On", off: "Off" });
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("Off");
    fireEvent.click(button);
    expect(button).toHaveTextContent("On");
  });
});
