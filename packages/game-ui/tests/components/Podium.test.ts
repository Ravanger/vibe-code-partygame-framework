import { render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import { Podium } from "../../src/components/index.js";
import { type PodiumRow, type PodiumStep, podiumSteps, rankRows } from "../../src/index.js";
import { expectNoViolations } from "../support/a11y.js";

function steps(): PodiumStep<PodiumRow>[] {
  const rows = [
    { playerId: "a", name: "Ann", score: 30, hasLeft: false, isMe: true },
    { playerId: "b", name: "Bo", score: 20, hasLeft: false, isMe: false },
    { playerId: "c", name: "Cy", score: 10, hasLeft: false, isMe: false },
  ];
  return podiumSteps(rankRows(rows));
}

describe("Podium", () => {
  it("renders nothing without steps", async () => {
    const { container } = render(Podium, { steps: [] });
    expect(screen.queryByRole("list", { name: "Podium" })).not.toBeInTheDocument();
    await expectNoViolations(container, "Podium");
  });

  it("lists step labels, names and scores, marks me, and puts the star on tier 1 only", async () => {
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
    await expectNoViolations(container, "Podium");
  });

  it("sizes stickers by tier, smaller when a tie shares a step", async () => {
    const sizes = (container: HTMLElement): string[] =>
      [...container.querySelectorAll<SVGElement>(".player-sticker")].map((s) =>
        s.style.getPropertyValue("--size"),
      );
    const first = render(Podium, { steps: steps() });
    expect(sizes(first.container)).toEqual(["52px", "64px", "52px"]);
    const tied = podiumSteps(
      rankRows([
        { playerId: "a", name: "Ann", score: 30, hasLeft: false, isMe: false },
        { playerId: "b", name: "Bo", score: 30, hasLeft: false, isMe: false },
      ]),
    );
    expect(sizes(render(Podium, { steps: tied }).container).slice(-2)).toEqual(["36px", "36px"]);
    await expectNoViolations(first.container, "Podium");
  });

  it("renders the extra snippet for every occupant", async () => {
    const extra = createRawSnippet((player: () => PodiumRow) => ({
      render: () => `<span class="extra">${player().name}!</span>`,
    }));
    const { container } = render(Podium, { steps: steps(), extra });
    expect(screen.getByText("Ann!")).toBeInTheDocument();
    expect(screen.getByText("Cy!")).toBeInTheDocument();
    await expectNoViolations(container, "Podium");
  });
});
