import { render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import { ProgressStrip } from "../../src/components/index.js";
import type { ProgressRow } from "../../src/progressRow.js";
import { setStrings } from "../../src/strings.js";

afterEach(() => setStrings({}));

function row(over: Partial<ProgressRow> & Pick<ProgressRow, "playerId" | "name">): ProgressRow {
  return { answered: 0, expected: 2, done: false, typing: false, isMe: false, ...over };
}

describe("ProgressStrip", () => {
  it("renders nothing without rows", () => {
    const { container } = render(ProgressStrip, { rows: [], label: "Answer progress" });
    expect(container.querySelector("ul")).toBeNull();
  });

  it("names the list from the label prop and shows each row's count", () => {
    render(ProgressStrip, {
      rows: [
        row({ playerId: "a", name: "Ann" }),
        row({ playerId: "b", name: "Bo", answered: 2, done: true }),
      ],
      label: "Answer progress",
    });
    const list = screen.getByRole("list", { name: "Answer progress" });
    expect(list.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText("0/2")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("marks a done row with the strings' done label", () => {
    render(ProgressStrip, {
      rows: [row({ playerId: "a", name: "Ann", answered: 1, expected: 1, done: true })],
      label: "Answer progress",
    });
    expect(screen.getByRole("img", { name: "Done" })).toBeInTheDocument();
  });

  it("shows the strings' typing text for a typing row", () => {
    render(ProgressStrip, {
      rows: [row({ playerId: "a", name: "Ann", typing: true })],
      label: "L",
    });
    expect(screen.getByText("typing…")).toBeInTheDocument();
  });

  it("marks the viewer's own row", () => {
    const { container } = render(ProgressStrip, {
      rows: [row({ playerId: "a", name: "Ann", isMe: true })],
      label: "L",
    });
    expect(container.querySelector(".is-me")).not.toBeNull();
  });

  it("reads the done and typing labels from the strings table", () => {
    setStrings({ done: "Fertig", typing: "schreibt…" });
    render(ProgressStrip, {
      rows: [
        row({ playerId: "a", name: "Ann", answered: 1, expected: 1, done: true }),
        row({ playerId: "b", name: "Bo", typing: true }),
      ],
      label: "L",
    });
    expect(screen.getByRole("img", { name: "Fertig" })).toBeInTheDocument();
    expect(screen.getByText("schreibt…")).toBeInTheDocument();
  });
});
