import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { PlayerSticker } from "../../src/components/index.js";
import { expectNoViolations } from "../support/a11y.js";

describe("PlayerSticker", () => {
  it("shows the first letter on the shape and colour picked for the player, hidden from assistive tech", async () => {
    const { container } = render(PlayerSticker, { name: "maya", playerId: "p-1", size: 56 });
    const sticker = container.querySelector(".player-sticker");
    expect(sticker).toHaveTextContent("M");
    expect(sticker).toHaveAttribute("aria-hidden", "true");
    expect(sticker?.getAttribute("style")).toContain("--size: 56px");
    expect(sticker?.getAttribute("data-color")).toMatch(/^[0-3]$/);
    expect(sticker?.getAttribute("style")).not.toContain("--fill");
    expect(container.querySelectorAll("path")).toHaveLength(3);
    await expectNoViolations(container, "PlayerSticker");
  });

  it("draws the same player the same way every time, and different players differently", async () => {
    const first = render(PlayerSticker, { name: "A", playerId: "p-1" });
    const again = render(PlayerSticker, { name: "A", playerId: "p-1" });
    expect(again.container.innerHTML).toBe(first.container.innerHTML);
    const shapes = new Set<string | null | undefined>();
    for (let i = 0; i < 40; ++i) {
      const other = render(PlayerSticker, { name: "A", playerId: `friend-${i}` });
      shapes.add(other.container.querySelector(".fill")?.getAttribute("d"));
    }
    expect(shapes.size).toBe(6);
    await expectNoViolations(first.container, "PlayerSticker");
  });

  it("can stand in for a player who has not chosen a name", async () => {
    const { container } = render(PlayerSticker, { name: "", playerId: "p-1", ghost: true });
    const sticker = container.querySelector(".player-sticker");
    expect(sticker).toHaveClass("ghost");
    expect(sticker).toHaveTextContent("?");
    expect(sticker?.getAttribute("data-color")).toMatch(/^[0-3]$/);
    expect(sticker?.getAttribute("style")).toContain("--fill: var(--disabled)");
    await expectNoViolations(container, "PlayerSticker");
  });
});
