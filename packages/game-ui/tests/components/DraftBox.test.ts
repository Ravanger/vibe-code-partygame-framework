import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import { DraftBox } from "../../src/components/index.js";
import { setStrings } from "../../src/strings.js";

afterEach(() => setStrings({}));

const base = {
  value: "Hello",
  label: "Your answer",
  maxLength: 200,
  remaining: 195,
  oninput: () => {},
  onsubmit: () => {},
};

describe("DraftBox", () => {
  it("names the textarea from the label prop and hints at sending", () => {
    render(DraftBox, base);
    const box = screen.getByLabelText("Your answer");
    expect(box).toBeInTheDocument();
    expect(box).toHaveAttribute("enterkeyhint", "send");
  });

  it("caps the textarea at the maxLength prop and shows a placeholder when given", () => {
    render(DraftBox, { ...base, placeholder: "Type your answer..." });
    const box = screen.getByLabelText("Your answer");
    expect(box).toHaveAttribute("maxlength", "200");
    expect(box).toHaveAttribute("placeholder", "Type your answer...");
  });

  it("reports edits through oninput", async () => {
    const seen: string[] = [];
    render(DraftBox, {
      ...base,
      oninput: (value: string) => {
        seen.push(value);
      },
    });
    await fireEvent.input(screen.getByLabelText("Your answer"), { target: { value: "Hi" } });
    expect(seen).toEqual(["Hi"]);
  });

  it("shows the remaining characters and turns low under the threshold", () => {
    const view = render(DraftBox, base);
    expect(screen.getByText("195 chars left")).not.toHaveClass("low");
    view.unmount();

    render(DraftBox, { ...base, remaining: 10 });
    expect(screen.getByText("10 chars left")).toHaveClass("low");
  });

  it("submits on Enter but not on Shift+Enter or other keys", async () => {
    const submitted: number[] = [];
    render(DraftBox, {
      ...base,
      onsubmit: () => {
        submitted.push(1);
      },
    });
    const box = screen.getByLabelText("Your answer");

    await fireEvent.keyDown(box, { key: "a" });
    await fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(submitted).toEqual([]);

    await fireEvent.keyDown(box, { key: "Enter" });
    expect(submitted).toHaveLength(1);
  });

  it("renders the rejection reason in an alert and none without one", () => {
    const view = render(DraftBox, base);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    view.unmount();

    render(DraftBox, { ...base, rejection: "That text was not allowed" });
    expect(screen.getByRole("alert")).toHaveTextContent("That text was not allowed");
  });
});
