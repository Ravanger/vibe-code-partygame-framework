import { render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import ActionBar from "../../ui/components/ActionBar.svelte";
import PlayerSticker from "../../ui/components/PlayerSticker.svelte";
import StatusPanel from "../../ui/components/StatusPanel.svelte";
import Timer from "../../ui/components/Timer.svelte";

describe("Timer", () => {
  const LENGTH = 92;
  const START = 6;

  function tip(container: HTMLElement): number {
    return Number(container.querySelector(".stick")?.getAttribute("x2"));
  }

  it("shows the seconds and burns the stick down in proportion", () => {
    const full = render(Timer, { seconds: 30, total: 30 });
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(tip(full.container)).toBeCloseTo(START + LENGTH);
    const half = render(Timer, { seconds: 15, total: 30 });
    expect(tip(half.container)).toBeCloseTo(START + LENGTH / 2);
  });

  it("stays on the stick, and is burnt out without a total", () => {
    const over = render(Timer, { seconds: 50, total: 30 });
    expect(tip(over.container)).toBeCloseTo(START + LENGTH);
    const under = render(Timer, { seconds: -2, total: 30 });
    expect(tip(under.container)).toBeCloseTo(START);
    const none = render(Timer, { seconds: 5, total: 0 });
    expect(tip(none.container)).toBeCloseTo(START);
  });

  it("turns urgent at ten seconds", () => {
    const calm = render(Timer, { seconds: 11, total: 30 });
    expect(calm.container.querySelector(".sparkler")).not.toHaveClass("urgent");
    const urgent = render(Timer, { seconds: 10, total: 30 });
    expect(urgent.container.querySelector(".sparkler")).toHaveClass("urgent");
  });

  it("announces politely", () => {
    const { container } = render(Timer, {
      seconds: 10,
      total: 30,
      announcement: "10 seconds remaining",
    });
    const live = container.querySelector("[aria-live='polite']");
    expect(live).toHaveTextContent("10 seconds remaining");
    expect(live).toHaveClass("sr-only");
  });

  it("announces nothing by default", () => {
    const { container } = render(Timer, { seconds: 10, total: 30 });
    expect(container.querySelector("[aria-live='polite']")?.textContent).toBe("");
  });
});

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

describe("ActionBar", () => {
  it("holds the primary action", () => {
    const children = createRawSnippet(() => ({
      render: () => "<button type='button'>Go</button>",
    }));
    const { container } = render(ActionBar, { children });
    expect(container.querySelector(".action-bar")).toContainElement(
      screen.getByRole("button", { name: "Go" }),
    );
  });
});

describe("StatusPanel", () => {
  it("shows a waiting message with breathing dots", () => {
    const { container } = render(StatusPanel, { title: "Hold on", tone: "wait" });
    expect(screen.getByText("Hold on")).toBeInTheDocument();
    expect(container.querySelector(".dots")).toBeInTheDocument();
    expect(container.querySelector(".detail")).not.toBeInTheDocument();
  });

  it("shows a detail line for the other tones, without dots", () => {
    const { container } = render(StatusPanel, { title: "Done", detail: "All set", tone: "done" });
    expect(screen.getByText("All set")).toBeInTheDocument();
    expect(container.querySelector(".dots")).not.toBeInTheDocument();
    expect(screen.getByText(/done/i, { selector: ".sticker" })).toBeInTheDocument();
    expect(container.querySelector(".status-panel")).toHaveClass("tone-done");
    const info = render(StatusPanel, { title: "Tip", tone: "info" });
    expect(info.container.querySelector(".status-panel")).toHaveClass("tone-info");
    expect(info.container.querySelector(".sticker")).not.toBeInTheDocument();
  });
});
