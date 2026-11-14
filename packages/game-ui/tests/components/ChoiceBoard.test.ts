import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import { ChoiceBoard } from "../../src/components/index.js";
import { setStrings } from "../../src/strings.js";

afterEach(() => setStrings({}));

const choices = [
  { id: "a", text: "Alpha" },
  { id: "b", text: "Beta", picked: true },
];

describe("ChoiceBoard", () => {
  it("renders a button per choice and calls onvote with the id", async () => {
    const voted: string[] = [];
    render(ChoiceBoard, { choices, canVote: true, onvote: (id: string) => voted.push(id) });
    await fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    expect(voted).toEqual(["a"]);
  });

  it("marks the picked choice pressed and stamped with the strings' stamp", () => {
    render(ChoiceBoard, { choices, canVote: true, onvote: () => {} });
    const beta = screen.getByRole("button", { name: "Beta" });
    expect(beta).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("VOTED!")).toBeInTheDocument();
  });

  it("shows the versus divider only when set, before the second choice", () => {
    const none = render(ChoiceBoard, { choices, canVote: true, onvote: () => {} });
    expect(none.container.querySelector(".vs")).toBeNull();
    none.unmount();

    const some = render(ChoiceBoard, { choices, canVote: true, onvote: () => {}, versus: "VS" });
    const divider = some.container.querySelector(".vs");
    if (divider === null) throw new Error("the versus divider did not render");
    expect(divider.textContent).toBe("VS");
    expect(some.container.querySelectorAll(".vs")).toHaveLength(1);
  });

  it("disables every choice when the player cannot vote", () => {
    render(ChoiceBoard, { choices, canVote: false, onvote: () => {} });
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });

  it("shows the switch hint from the strings when a pick can still be switched", () => {
    render(ChoiceBoard, { choices, canVote: true, onvote: () => {} });
    expect(screen.getByText("psst… tap the other one to switch")).toBeInTheDocument();
  });

  it("hides the switch hint without a pick and when voting is closed", () => {
    const noPick = render(ChoiceBoard, {
      choices: [{ id: "a", text: "Alpha" }],
      canVote: true,
      onvote: () => {},
    });
    expect(noPick.container.querySelector(".switch-hint")).toBeNull();
    noPick.unmount();

    const closed = render(ChoiceBoard, { choices, canVote: false, onvote: () => {} });
    expect(closed.container.querySelector(".switch-hint")).toBeNull();
  });

  it("renders an optional per-choice label badge", () => {
    const { container } = render(ChoiceBoard, {
      choices: [
        { id: "a", text: "Alpha", label: "A" },
        { id: "b", text: "Beta", label: "B" },
      ],
      canVote: true,
      onvote: () => {},
    });
    const badges = [...container.querySelectorAll(".badge")].map((badge) => badge.textContent);
    expect(badges).toEqual(["A", "B"]);
  });

  it("disables the player's own choice and chips it with the strings' yours text", () => {
    render(ChoiceBoard, {
      choices: [
        { id: "a", text: "Alpha", own: true },
        { id: "b", text: "Beta" },
      ],
      canVote: true,
      onvote: () => {},
    });
    expect(screen.getByRole("button", { name: /Alpha/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Beta" })).toBeEnabled();
    expect(screen.getByText("yours")).toBeInTheDocument();
  });

  it("reads the stamp, switch hint and yours chip from the strings table", () => {
    setStrings({ pickedStamp: "GEWÄHLT!", switchHint: "noch wechseln", yours: "deins" });
    render(ChoiceBoard, {
      choices: [
        { id: "a", text: "Alpha", own: true },
        { id: "b", text: "Beta", picked: true },
      ],
      canVote: true,
      onvote: () => {},
    });
    expect(screen.getByText("GEWÄHLT!")).toBeInTheDocument();
    expect(screen.getByText("noch wechseln")).toBeInTheDocument();
    expect(screen.getByText("deins")).toBeInTheDocument();
  });
});
