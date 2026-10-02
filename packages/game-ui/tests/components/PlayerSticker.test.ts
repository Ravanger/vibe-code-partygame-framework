import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { PlayerSticker } from "../../src/components/index.js";

describe("PlayerSticker", () => {
  it("shows the first letter on the shape and colour picked for the player, hidden from assistive tech", () => {
    const { container } = render(PlayerSticker, { name: "maya", playerId: "p-1", size: 56 });
    const sticker = container.querySelector(".player-sticker");
    expect(sticker).toHaveTextContent("M");
    expect(sticker).toHaveAttribute("aria-hidden", "true");
    expect(sticker?.getAttribute("style")).toContain("--size: 56px");
    expect(sticker?.getAttribute("style")).toMatch(/--fill: var\(--(pink|sun|mint|sky)\)/);
    expect(container.querySelectorAll("path")).toHaveLength(3);
  });

  it("draws the same player the same way every time, and different players differently", () => {
    const first = render(PlayerSticker, { name: "A", playerId: "p-1" });
    const again = render(PlayerSticker, { name: "A", playerId: "p-1" });
    expect(again.container.innerHTML).toBe(first.container.innerHTML);
    const shapes = new Set<string | null | undefined>();
    for (let i = 0; i < 40; ++i) {
      const other = render(PlayerSticker, { name: "A", playerId: `friend-${i}` });
      shapes.add(other.container.querySelector(".fill")?.getAttribute("d"));
    }
    expect(shapes.size).toBe(6);
  });

  it("can stand in for a player who has not chosen a name", () => {
    const { container } = render(PlayerSticker, { name: "", playerId: "p-1", ghost: true });
    const sticker = container.querySelector(".player-sticker");
    expect(sticker).toHaveClass("ghost");
    expect(sticker).toHaveTextContent("?");
    expect(sticker?.getAttribute("style")).toContain("var(--disabled)");
  });
});
