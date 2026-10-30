import { render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import { Podium } from "../../src/components/index.js";
import { type PodiumRow, type PodiumStep, podiumSteps, rankRows } from "../../src/index.js";

function steps(): PodiumStep<PodiumRow>[] {
  const rows = [
    { playerId: "a", name: "Ann", score: 30, hasLeft: false, isMe: true },
    { playerId: "b", name: "Bo", score: 20, hasLeft: false, isMe: false },
    { playerId: "c", name: "Cy", score: 10, hasLeft: false, isMe: false },
  ];
  return podiumSteps(rankRows(rows));
}

describe("Podium", () => {
  it("renders nothing without steps", () => {
    render(Podium, { steps: [] });
    expect(screen.queryByRole("list", { name: "Podium" })).not.toBeInTheDocument();
  });

  it("lists step labels, names and scores, marks me, and puts the star on tier 1 only", () => {
    const { container } = render(Podium, { steps: steps() });
    expect(screen.getByRole("list", { name: "Podium" })).toBeInTheDocument();
    for (const label of ["1st", "2nd", "3rd"]) expect(screen.getByText(label)).toBeInTheDocument();
    for (const name of ["Ann", "Bo", "Cy"]) expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getByText("30 pts")).toBeInTheDocument();
    const marker = container.querySelector<HTMLElement>(".you");
    expect(marker).not.toBeNull();
    expect(marker?.querySelector('[aria-hidden="true"]')?.textContent).toBe("←");
    expect(marker?.querySelector(".sr-only")?.textContent).toBe("This is you");
    expect(screen.getByText("you")).toBeInTheDocument();
    expect(container.querySelectorAll(".star")).toHaveLength(1);
    expect(container.querySelector(".tier-1 .star")).toBeInTheDocument();
  });

  it("hides the visible you marker from screen readers and keeps the sr-only text", () => {
    const { container } = render(Podium, { steps: steps() });
    const marker = container.querySelector<HTMLElement>(".you");
    if (marker === null) throw new Error("the you marker did not render");
    const visible = [...marker.querySelectorAll("span")].find((s) => s.textContent === "you");
    expect(visible).not.toBeUndefined();
    expect(visible).toHaveAttribute("aria-hidden", "true");
    expect(marker.querySelector(".sr-only")?.textContent).toBe("This is you");
  });

  it("sizes stickers by tier, smaller when a tie shares a step", () => {
    const sizes = (container: HTMLElement): string[] =>
      [...container.querySelectorAll<SVGElement>(".player-sticker")].map((s) =>
        s.style.getPropertyValue("--size"),
      );
    expect(sizes(render(Podium, { steps: steps() }).container)).toEqual(["52px", "64px", "52px"]);
    const tied = podiumSteps(
      rankRows([
        { playerId: "a", name: "Ann", score: 30, hasLeft: false, isMe: false },
        { playerId: "b", name: "Bo", score: 30, hasLeft: false, isMe: false },
      ]),
    );
    expect(sizes(render(Podium, { steps: tied }).container).slice(-2)).toEqual(["36px", "36px"]);
  });

  it("renders the extra snippet for every occupant", () => {
    const extra = createRawSnippet((player: () => PodiumRow) => ({
      render: () => `<span class="extra">${player().name}!</span>`,
    }));
    render(Podium, { steps: steps(), extra });
    expect(screen.getByText("Ann!")).toBeInTheDocument();
    expect(screen.getByText("Cy!")).toBeInTheDocument();
  });

  it("reads block heights from custom properties and never styles main.tv", () => {
    render(Podium, { steps: steps() });
    const sheet = [...document.querySelectorAll("style")]
      .map((s) => s.textContent ?? "")
      .filter((css) => css.includes(".podium"))
      .join("\n");
    expect(sheet).not.toContain("main.tv");
    for (const tier of [1, 2, 3]) {
      expect(sheet).toContain(`var(--podium-block-height-${tier}`);
    }
  });
});
